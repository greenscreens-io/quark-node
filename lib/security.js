/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */
const crypto = require('../webcrypto/lib');
const EngineBuffer = require('./Buffer.js');

class Security {

    static #ECDH_TYPE = { name: 'ECDH', namedCurve: "P-256" };
    static #AES_TYPE= { name: "AES-CTR", length: 128 };
    
    #publicKey = null;
    #aesKey = null;

    get publicKey() { return this.#publicKey;}

    cookie(path = "/") {
        return `gs-public-key=${this.#publicKey||''};path=${path}`;
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
    
    /**
     * Import Async key received from server
     * Key is publicKey used to send encrypted AES key
     *
     * @param {String} key PEM encoded key
     * @param {Object} type Crypto API key definition format
     * @param {String} mode Comma separted list of key usages 
     */
    async importKey(key, type, mode) {
        const der = Buffer.fromBase64(key);
        const use = mode ? mode.split(',') : [];
        return crypto.subtle.importKey('spki', der, type, true, use);
    }
    
    /**
     * Export key in hex form
     * @param {CryptoKey} key
     * @returns {string}
     */
    async exportKey(key) {
        const ab = await crypto.subtle.exportKey('raw',  key);
        return Buffer.toHex(ab);
    }

    /**
     * Verify signature
     *
     * @param {CryptoKey} Public key used for verification
     * @param {ArrayBuffer} signature Signature of received data
     * @param {ArrayBuffer} challenge Challenge to verify with signature (ts + pemENCDEC + pemVERSGN)
     */
    async verify(key, signature, challenge) {
        signature = Buffer.fromBase64(signature);
        challenge = Buffer.toBuffer(challenge);
        const type = { name: "ECDSA", hash: { name: "SHA-384" } };
        return crypto.subtle.verify(type, key, signature, challenge);
    }

    async #initVerify(cfg) {
        const me = this;
        const type = { name: 'ECDSA', namedCurve: "P-384" };
        const verKey = await me.importKey(cfg.keyVer, type, 'verify');
        const status = await me.verify(verKey, cfg.signature, me.#getChallenge(cfg));
        if (!status) throw new Error('Signature invalid');
    }

    /**
     * Initialize server public key
     * @param {object} cfg 
     */
    #initPublic(cfg) {        
        return this.importKey(cfg.keyEnc, Security.#ECDH_TYPE, '');
    }

    /**
     * Initialize browser ECDH key pair 
     */
    #initKeyPair() {
        const use = ['deriveKey','deriveBits'];
        return crypto.subtle.generateKey(Security.#ECDH_TYPE, true, use);
    }

    /**
     * Derive shared secret from server public ECDH and browser keypair.private ECDH
     * @returns {CryptoKey}
     */
    #deriveAES(priv, pub) {
        const pubDef = { name: "ECDH", public: pub };
        const use = ['encrypt', 'decrypt'];
        const derivedKey = {name:'AES-CTR', length: 128};
        return crypto.subtle.deriveKey(pubDef, priv, derivedKey, false, use);
    }

    /**
	 * Create random bytes
	 *
	 * @param {int} size
	 *     length of data (required)
	 */
	getRandom(size) {
		const array = new Uint8Array(size);
		crypto.getRandomValues(array);
		return array;
	}

    /**
     * Encrypt message with AES
     * @param {CryptoKey} key 
     * @param {String|ArrayBuffer} iv IV as Hex string 
     * @param {String|ArrayBuffer} data as Hex string 
     */
    async encryptRaw(key, iv, data) {        
        const ivbin = Buffer.toBuffer(iv);
        const databin = Buffer.toBuffer(data);
        const type = Object.assign({counter: ivbin}, Security.#AES_TYPE);
        return crypto.subtle.encrypt(type, key, databin);
    }

    /**
     * Decrypt AES encrypted message
     * @param {CryptoKey} key 
     * @param {String|ArrayBuffer} iv IV as Hex string 
     * @param {String|ArrayBuffer} data as Hex string 
     */
    async decryptRaw(key, iv, data) {
        const ivbin = Buffer.toBuffer(iv);
        const databin = Buffer.toBuffer(data);
        const type = Object.assign({counter: ivbin}, Security.#AES_TYPE);
        return crypto.subtle.decrypt(type, key, databin);
    }

    async decryptAsString(key, iv, data) {
        const result = await this.decryptRaw(key, iv, data);
        return Buffer.toText(result);
    }

    async encryptAsHex(key, iv, data) {   
        const result = await this.encryptRaw(key, iv, data);
        return Buffer.toHex(result);
    }

	get isValid() {
		const me = this;
		return me.#publicKey !== null && me.#aesKey !== null;
	}

	static get isAvailable() {
		return crypto.subtle != null;
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
        const keyPair = await me.#initKeyPair();
        
        me.#publicKey = await me.exportKey(keyPair.publicKey);
        me.#aesKey = await me.#deriveAES(keyPair.privateKey, publicKey);
        
		console.log('Security Initialized!');
        
    }

    /**
     * Data encryptor, encrypt aes with async and data with aes
     */    
    async encrypt(data) {

		data = (typeof data === 'string') ? data : JSON.stringify(data);

        const me = this;
        const iv = me.getRandom(16);
        
        const d = await me.encryptAsHex(me.#aesKey, iv, data);
        const k = Buffer.toHex(iv);

        return { d: d, k: k, t: 1, b:6};

    }

	/**
	 * Decrypt received data in format {d:.., k:...}
	 *
	 * @param
	 * 		cfg  - data elements to decrypt
	 * 		cfg.d - aes encrypted server resposne
	 * 		cfg.k - aes IV used for masking
	 *
	 */
	async decrypt(cfg) {

		const me = this;
		const iv = cfg.iv;
		const data = cfg.d;

		const message = await me.decryptAsString(me.#aesKey, iv, data);
		const obj = JSON.parse(message);

		if (obj && obj.type == 'ws' && obj.cmd === 'data') {
			return obj.data;
		}

		return obj;
	}

	static async init(cfg) {
		const security = new Security();
		await security.init(cfg);
		return security;
	}

}

module.exports = Security;
