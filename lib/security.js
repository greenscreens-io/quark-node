/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */
const {
	crypto
} = require('../webcrypto');
const Util = require('./util');

/**
 * Security engine using Web Crypto API to encrypt / decrypt
 * messages between browser and server.
 *
 * Received RSA public key is signed and verified at the
 * browser side to prevent tampering
 */

var VERSION = 0;
var encKEY = null;
var aesKEY = null;
var exportedAES = null;

const Encoder = new TextEncoder();

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
	let buffer = await crypto.subtle.exportKey("raw", key);
	return new Uint8Array(buffer);
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
async function encryptRSA(data) {

	let encoded = data;

	if (typeof data === 'string') {
		encoded = Encoder.encode(data);
	}

	return crypto.subtle.encrypt(
		"RSA-OAEP",
		encKEY,
		encoded
	);
}

/**
 * Encrypt message with AES
 */
async function encryptAesMessage(key, iv, data) {

	let encoded = Encoder.encode(data);
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

	let databin = Util.hex2ab(data);
	let ivbin = Util.hex2ab(iv);

	let counter = new Uint8Array(ivbin);
	let dataArray = new Uint8Array(databin);
	let type = {
		name: "AES-CTR",
		counter: counter,
		length: 128
	};

	return crypto.subtle.decrypt(type, key, dataArray);
}

/********************************************************************/
/*                   P U B L I C  F U N C T I O N S                 */
/********************************************************************/

/**
 * Initialize encryption and verification keys
 * Verifies data signatures to prevent tampering
 */
async function init(cfg) {

	console.log('Security Initializing...');
	//console.log(JSON.stringify(cfg));

	VERSION++;
	encKEY = await importRsaKey(cfg.keyEnc, {
		name: 'RSA-OAEP',
		hash: 'SHA-256'
	}, 'encrypt');
	aesKEY = await generateAesKey();
	exportedAES = await exportAesKey(aesKEY);

	let verKey = await importRsaKey(cfg.keyVer, {
		name: 'ECDSA',
		namedCurve: "P-384"
	}, 'verify');
	let status = await verify(verKey, cfg.signature, getChallenge(cfg || {}));

	if (!status) {
		encKEY = null;
		aesKEY = null;
		exportedAES = null;
		throw new Error('Signature invalid');
	}

	console.log('Security Initialized!');

}

/**
 *  Decrypt received data in format {d:.., k:...}
 * @param
 * 		data  - string to encrypt
 */
async function encrypt(data, bin) {

	let iv = getRandom(16);
	let key = new Uint8Array(iv.length + exportedAES.length);

	key.set(iv);
	key.set(exportedAES, iv.length);

	let encryptedKey = await encryptRSA(key);
	let encryptedData = await encryptAesMessage(aesKEY, iv, data);

	if (bin === true) {
		return {
			d: encryptedData,
			k: encryptedKey
		};
	}
	return {
		d: Util.buf2hex(encryptedData),
		k: Util.buf2hex(encryptedKey)
	};

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
async function decrypt(cfg) {

	let iv = cfg.iv;
	let data = cfg.d;

	let message = await decryptAesMessage(aesKEY, iv, data);

	var str = Util.stringFromUTF8Array(new Uint8Array(message));
	var obj = JSON.parse(str);

	if (obj.type == 'ws' && obj.cmd === 'data') {
		obj = obj.data;
	}

	return obj;
}

/**
 * Exported object with external methods
 */
const Security = {

	isActive: function() {
		return encKEY !== null && aesKEY !== null;
	},

	init: function(cfg) {
		return init(cfg);
	},

	encrypt: function(cfg, bin) {
		return encrypt(cfg, bin);
	},

	decrypt: function(cfg) {
		return decrypt(cfg);
	}
};
Object.freeze(Security);

module.exports = Security;
