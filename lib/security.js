/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */
const {
	crypto
} = require('../webcrypto/lib');

/**
 * Security engine using Web Crypto API to encrypt / decrypt
 * messages between browser and server.
 *
 * Received RSA public key is signed and verified at the
 * browser side to prevent tampering
 */

const Encoder = new TextEncoder();
const Decoder = new TextDecoder();

/**
 *  Use local challenge, to verify received data signature
 *
 *  @param {Object} cfg
 *      Data received from server contins public key and signature
 */
function getChallenge(cfg) {
	return [cfg.challenge || '', cfg.keyEnc || '', cfg.keyVer || ''].join('');
}

/**
 * Create random bytes
 *
 * @param {int} size
 *     length of data (required)
 */
function getRandom(size) {
	let array = new Uint8Array(size);
	crypto.getRandomValues(array);
	return array;
}

/**
 * Create AES key for data encryption
 * @returns CryptoKey
 */
async function generateAesKey() {
	let type = {
		name: "AES-CTR",
		length: 128
	};
	let mode = ["encrypt", "decrypt"];
	return crypto.subtle.generateKey(type, true, mode);
}

/**
 * Extract CryptoKey into RAW bytes
 * @param {CryptoKey} key
 * @returns Uin8Array
 */
async function exportAesKey(key) {
	return await crypto.subtle.exportKey("raw", key);
}

/**
 * Import RSA key received from server
 * Key is publicKey used to send encrypted AES key
 *
 * @param {String} key
 *          PEM encoded key without headers,
 *          flattened in a single line
 *
 * @param {Object} type
 *          Crypto API key definition format
 *
 * @param {String} mode
 *          Key usage 'encrypt' or 'decrypt'
 */
async function importRsaKey(key, type, mode) {

	let binaryDer = Buffer.from(key, 'base64');

	return crypto.subtle.importKey(
		"spki",
		binaryDer,
		type,
		true,
		[mode]
	);
}

/**
 * Verify signature
 *
 * @param {CryptoKey}
 *      Public key used for verification
 *
 * @param {ArrayBuffer} signature
 *        Signature of received data
 *
 * @param {ArrayBuffer} challenge
 *        Challenge to verify with signature (ts + pemENCDEC + pemVERSGN)
 */
async function verify(key, signature, challenge) {

	let binSignature = Buffer.from(signature, 'base64');
	let binChallenge = Encoder.encode(challenge);
	let type = {
		name: "ECDSA",
		hash: {
			name: "SHA-384"
		}
	};

	return crypto.subtle.verify(
		type,
		key,
		binSignature,
		binChallenge
	);
}

/**
 * Encrypt message with RSA key
 *
 * @param {String || ArrayBuffer} data
 *        String or AraryBuffer to encrypt
 */
async function encryptRSA(key, data) {

	let encoded = data;

	if (typeof data === 'string') {
		encoded = Encoder.encode(data);
	}

	return crypto.subtle.encrypt(
		"RSA-OAEP",
		key,
		encoded
	);
}

/**
 * Encrypt message with AES
 */
async function encryptAesMessage(key, iv, data) {

	let encoded = Encoder.encode(toString(data));
	let type = {
		name: "AES-CTR",
		counter: iv,
		length: 128
	};

	return crypto.subtle.encrypt(type, key, encoded);
}

/**
 * Decrypt AES encrypted message
 */
async function decryptAesMessage(key, iv, data) {

	let databin = Buffer.from(data, "hex");
	let counter = Buffer.from(iv, "hex");

	let type = {
		name: "AES-CTR",
		counter: counter,
		length: 128
	};

	return crypto.subtle.decrypt(type, key, databin);
}

/**
 * Generic safe string converter
 */
function toString(val) {
	if (typeof val === 'string') return val;
	return JSON.stringify(val);
}

/********************************************************************/
/*                   P U B L I C  F U N C T I O N S                 */
/********************************************************************/

class Security {

	version = 0;
	encKEY = null;
	aesKEY = null;
	exportedAES = null;
	
	cookie(path = "/") {
		return `gs-public-key=${this.#publicKey||''};path=${path}`;
	}

	updateCookie(path = "/") {
		// document.cookie = this.cookie(path);
	}

	/**
	 * Initialize encryption and verification keys
	 * Verifies data signatures to prevent tampering
	 */
	async init(cfg) {

		console.log('Security Initializing...');
		//console.log(JSON.stringify(cfg));

		let challenge = getChallenge(cfg || {});
		let me = this;
		me.version++;

		let verKey = await importRsaKey(cfg.keyVer, {
			name: 'ECDSA',
			namedCurve: "P-384"
		}, 'verify');

		let status = await verify(verKey, cfg.signature, challenge);
		if (!status) {
			me.encKEY = null;
			me.aesKEY = null;
			me.exportedAES = null;
			throw new Error('Signature invalid');
		}

		me.encKEY = await importRsaKey(cfg.keyEnc, {
			name: 'RSA-OAEP',
			hash: 'SHA-256'
		}, 'encrypt');

		me.aesKEY = await generateAesKey();
		me.exportedAES = await exportAesKey(me.aesKEY);

		console.log('Security Initialized!');

	}

	/**
	 *  Decrypt received data in format {d:.., k:...}
	 * @param
	 * 		data  - string to encrypt
	 * @param
	 * 		isBin  - if true, return as byte array insted of hex string
	 */
	async encrypt(data, isBin) {

		let me = this;
		let iv = getRandom(16);
		let key = new Uint8Array(iv.length + me.exportedAES.length);

		key.set(iv);
		key.set(me.exportedAES, iv.length);

		let encryptedKey = await encryptRSA(me.encKEY, key);
		let encryptedData = await encryptAesMessage(me.aesKEY, iv, data);

		if (isBin === true) {
			return {
				t: "1",
				d: encryptedData,
				k: encryptedKey
			};
		}

		return {
			t: "1",
			d: encryptedData.toString('hex'),
			k: encryptedKey.toString('hex')
		};

	}

	/**
	 * Decrypt received data in format {d:.., k:...}
	 *
	 * @param
	 * 		cfg  - data elements to decrypt
	 * 		cfg.d - aes encrypted server resposne
	 * 		cfg.iv - aes IV used for masking
	 *
	 */
	async decrypt(cfg) {

		let me = this;
		let iv = cfg.iv;
		let data = cfg.d;

		let message = await decryptAesMessage(me.aesKEY, iv, data);

		let str = Decoder.decode(message);
		let obj = JSON.parse(str);

		if (obj.type == 'ws' && obj.cmd === 'data') {
			obj = obj.data;
		}

		return obj;
	}

	/**
	 * Check if security is initialized
	 */
	isValid() {
		return this.encKEY !== null && this.aesKEY !== null;
	}

	static get isAvailable() {
		return true;
	}

	static async init(cfg) {
		let security = new Security();
		await security.init(cfg);
		return security;
	}

}

module.exports = Security;
