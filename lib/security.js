/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */
const QuarkBuffer = require('./Buffer.js');

class Security {

    static #ECDH_TYPE = { name: 'ECDH', namedCurve: "P-256" };
    static #AES_TYPE = { name: "AES-CTR", length: 256 };

    #publicKey = null;
    #keyPair = null;
    #aesKey = null;

    /**
     * Create random bytes
     *
     * @param {int} size
     *     length of data (required)
     */
    static getRandom(size) {
        const array = new Uint8Array(size);
        crypto.getRandomValues(array);
        return array;
    }

    /**
     * Initialize browser ECDH key pair 
     */
    static initKeyPair() {
        const use = ['deriveKey', 'deriveBits'];
        return crypto.subtle.generateKey(Security.#ECDH_TYPE, true, use);
    }

    /**
     * Import Async key received from server
     * Key is publicKey used to send encrypted AES key
     *
     * @param {String} key PEM encoded key
     * @param {Object} type Crypto API key definition format
     * @param {String} mode Comma separted list of key usages 
     */
    static async importKey(key, type, mode) {
        const der = QuarkBuffer.fromBase64(key);
        const use = mode ? mode.split(',') : [];
        return crypto.subtle.importKey('spki', der, type, true, use);
    }

    /**
     * Export key in hex form
     * @param {CryptoKey} key
     * @returns {string}
     */
    static async exportKey(key) {
        const ab = await crypto.subtle.exportKey('raw', key);
        return QuarkBuffer.toHex(ab);
    }

    /**
     * Verify signature
     *
     * @param {CryptoKey} Public key used for verification
     * @param {ArrayBuffer} signature Signature of received data
     * @param {ArrayBuffer} challenge Challenge to verify with signature (ts + pemENCDEC + pemVERSGN)
     */
    static async verify(key, signature, challenge) {
        signature = QuarkBuffer.fromBase64(signature);
        challenge = QuarkBuffer.toBuffer(challenge);
        const type = { name: "ECDSA", hash: { name: "SHA-384" } };
        return crypto.subtle.verify(type, key, signature, challenge);
    }

    get publicKey() { return this.#publicKey; }


    cookie(path = "/") {
        return `gs-public-key=${this.#publicKey || ''};path=${path}`;
    }

    updateCookie(path = "/") {
        document.cookie = this.cookie(path);
    }

    /**
     *  Use local challenge, to verify received data signature
     *
     *  @param {Object} cfg Data received from server contins public key and signature
     */
    #getChallenge(cfg) {
        return [cfg.challenge || '', cfg.keyEnc || '', cfg.keyVer || ''].join('');
    }

    async #initVerify(cfg) {
        const me = this;
        const type = { name: 'ECDSA', namedCurve: "P-384" };
        const verKey = await Security.importKey(cfg.keyVer, type, 'verify');
        const status = await Security.verify(verKey, cfg.signature, me.#getChallenge(cfg));
        if (!status) throw new Error('Signature invalid');
    }

    /**
     * Initialize server public key
     * @param {object} cfg 
     */
    #initPublic(cfg) {
        return Security.importKey(cfg.keyEnc, Security.#ECDH_TYPE, '');
    }

    /**
     * Derive shared secret from server public ECDH and browser keypair.private ECDH
     * @returns {CryptoKey}
     */
    #deriveAES(priv, pub) {
        const pubDef = { name: "ECDH", public: pub };
        const use = ['encrypt', 'decrypt'];
        const derivedKey = Security.#AES_TYPE;
        return crypto.subtle.deriveKey(pubDef, priv, derivedKey, false, use);
    }

    #toAlgo(iv) {
        iv = QuarkBuffer.toBuffer(iv);
        const type = Object.assign({ counter: iv }, Security.#AES_TYPE);
        type.length = 128;
        return type;
    }

    /**
     * Encrypt message with AES
     * @param {CryptoKey} key 
     * @param {ArrayBuffer} iv IV as Hex string 
     * @param {ArrayBuffer} data as Hex string 
     */
    async encryptRaw(key, iv, data) {
        const databin = QuarkBuffer.toBuffer(data);
        const type = this.#toAlgo(iv);
        return crypto.subtle.encrypt(type, key, databin);
    }

    /**
     * Decrypt AES encrypted message
     * @param {CryptoKey} key 
     * @param {ArrayBuffer} iv IV as Hex string 
     * @param {ArrayBuffer} data as Hex string 
     */
    async decryptRaw(key, iv, data) {
        const databin = QuarkBuffer.toBuffer(data);
        const type = this.#toAlgo(iv);
        return crypto.subtle.decrypt(type, key, databin);
    }

    async decryptAsBuffer(key, iv, data) {
        const result = await this.decryptRaw(key, iv, data);
        return QuarkBuffer.toBuffer(result);
    }

    async encryptAsBuffer(key, iv, data) {
        const result = await this.encryptRaw(key, iv, data);
        return QuarkBuffer.toBuffer(result);
    }

    async decryptAsString(key, iv, data) {
        const result = await this.decryptRaw(key, iv, data);
        return QuarkBuffer.toText(result);
    }

    async encryptAsHex(key, iv, data) {
        const result = await this.encryptRaw(key, iv, data);
        return QuarkBuffer.toHex(result);
    }

    get isValid() {
        const me = this;
        return me.#publicKey !== null && me.#aesKey !== null;
    }

    static get isAvailable() {
        return crypto.subtle ? true : false;
    }

    /**
     * Initialize encryption and verification keys
     * Verifies data signatures to prevent tampering
     */
    async init(cfg) {

        if (!Security.isAvailable) {
            console.log('Security mode not available, TLS protocol required.');
            return;
        }

        console.log('Security Initializing...');
        const me = this;

        await me.#initVerify(cfg);

        const publicKey = await me.#initPublic(cfg);
        me.#aesKey = await me.#deriveAES(me.#keyPair.privateKey, publicKey);
        me.#keyPair = null;

        console.log('Security Initialized!');

    }

    /**
     * Encrypt provided data
     * @param {Uint8Array} data Data to encrypt
     * @returns {Uint8Array} [head+iv+data]
     */
    async encrypt(data) {
        const me = this;
        if (!me.isValid) return data;
        if (!data instanceof Uint8Array) return data;
        const iv = Security.getRandom(16);
        const d = await me.encryptAsBuffer(me.#aesKey, iv, data);

        const raw = new Uint8Array(iv.length + d.length);
        raw.set(iv, 0);
        raw.set(d, iv.length);
        return raw;
    }

    /**
     * Decrypt received data in format {d:.., k:...}
     *
     * @param {ArrayBuffer|Uint8Array} data
     * @param {ArrayBuffer|Uint8Array} iv
     * @return 
     */
    async decrypt(data, iv) {

        const me = this;
        if (!iv) {
            iv = data.slice(0, 16);
            data = data.slice(16);
        }

        return await me.decryptAsBuffer(me.#aesKey, iv, data);
    }

    async #preInit() {
        const me = this;
        if (me.#publicKey) return me.#publicKey;
        me.#keyPair = await Security.initKeyPair();
        me.#publicKey = await Security.exportKey(me.#keyPair.publicKey);
        return me.#publicKey;
    }

    static async create(cfg) {
        const security = new Security();
        await security.#preInit();
        if (cfg) await security.init(cfg);
        return security;
    }

}

module.exports = Security;
