/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

const zlib = require('node:zlib');
const { promisify } = require('node:util');
const QuarkBuffer = require('./Buffer');

/**
 * Native compression for gzip
 */
class QuarkStreams {

	// 'gzip'

	static get isAvailable() {
		return true;
	}

	/**
	 * Stream header GS[version(5)][type(0|1|2|3)][len]
	 * type: 0 - utf8 binary string, 1 - compressed, 2 - encrypted, 3 - 1 & 2
	 * new Uint8Array([71, 83, 5, type, 0, 0, 0, 0]);
	 * @param {Uint8Array} data
	 * @returns {Uint8Array}
	 */
	static #toGS(raw, encrypted = false, compressed = false) {
		if (!raw instanceof Uint8Array) return raw;
		const type = QuarkStreams.#dataType(encrypted, compressed);

		const data = new Uint8Array(8 + raw.length);
		const dv = new DataView(data.buffer);
		dv.setUint8(0, 71);
		dv.setUint8(1, 83);
		dv.setUint8(2, 5);
		dv.setUint8(3, type);
		dv.setUint32(4, raw.length);
		data.set(raw, 8);
		return data;
	}

	/**
	 * Encode binary message to GS binary format
	 * @param {*} raw 
	 * @param {*} security 
	 */
	static async wrap(raw, security) {
		raw = QuarkStreams.toBinary(raw);
		raw = await Quarktreams.compressOrDefault(raw);
		raw = await security.encrypt(raw);
		raw = QuarkStreams.#toGS(raw, security.isValid, QuarkStreams.isAvailable);
		/*
		if (globalThis.QUARK_DEBUG) {
			console.log('DEBUG: Output :', QuarkBuffer.toHex(raw));
		}
		*/
		return raw;
	}

	/**
	 * Decode binary message from GS binary format
	 * @param {*} raw 
	 * @param {*} security 
	 */
	static async unwrap(raw, security, challenge) {

		if (raw instanceof Uint8Array) raw = raw.buffer;

		/*
		if (globalThis.QUARK_DEBUG) {
			console.log('DEBUG: Input :', QuarkBuffer.toHex(raw));
		}
		*/

		const dv = new DataView(raw);
		const isGS = QuarkStreams.#isGS(dv);

		raw = QuarkStreams.toBinary(raw);
		if (!isGS) return raw;

		const type = dv.getUint8(3);
		const len = dv.getUint32(4);

		if (dv.byteLength !== len + 8) return raw;

		raw = raw.slice(8);

		const isCompress = Quarktreams.isCompressFlag(type);
		const isEncrypt = QuarkStreams.isEncryptFlag(type);
		const isApi = QuarkStreams.isApiFlag(type);

		let api = null;
		if (isApi) {
			const encLen = dv.getUint32(8);
			const verLen = dv.getUint32(8 + 4 + encLen);
			const sgnLen = dv.getUint32(8 + 4 + encLen + 4 + verLen);

			api = {
				challenge: challenge,
				keyEnc: (raw.slice(4, 4 + encLen)),
				keyVer: (raw.slice(4 + encLen + 4, 4 + encLen + 4 + verLen)),
				signature: (raw.slice(4 + encLen + 4 + verLen + 4, 4 + encLen + 4 + verLen + 4 + sgnLen))
			};

			await security.init(api);
			raw = raw.slice((4 * 3) + encLen + verLen + sgnLen);
		}

		if (isEncrypt) {
			raw = await security?.decrypt(raw);
		}

		if (isCompress) {
			raw = await QuarkStreams.decompress(raw).arrayBuffer();
		}

		raw = QuarkStreams.toBinary(raw);
		if (!Quarktreams.isJson(raw)) throw new Error('Invalid response');

		return JSON.parse(QuarkBuffer.toText(raw));

	}

	/**
	 * Check if DataView id GS data format
	 * @param {*} dv 
	 * @returns 
	 */
	static #isGS(dv) {
		return dv.byteLength > 8 && dv.getUint16(0) === 18259 && dv.getUint8(2) === 5;
	}

	static isCompressFlag(type) {
		return (type & 1) === 1;
	}

	static isEncryptFlag(type) {
		return (type & 2) === 2;
	}

	static isApiFlag(type) {
		return (type & 4) === 4;
	}

	static #dataType(isEncrypt, isCompress) {
		const type = isCompress ? 1 : 0;
		return type | (isEncrypt ? 2 : 0);
	}

	/**
	 * If compression available, compress, 
	 * else return original value
	 * @param {*} data 
	 * @param {*} encoding 
	 */
	static async compressOrDefault(data, encoding = 'gzip') {
		if (!Streams.isAvailable) return data;
		const raw = await QuarkStreams.compress(data, encoding);
		return QuarkStreams.toBinary(raw);
	}

	/**
	 * If decompression available, decompress, 
	 * else return original value
	 * @param {*} data 
	 * @param {*} encoding 
	 */
	static async decompressOrDefault(data, encoding = 'gzip') {
		if (!Streams.isAvailable) return data;
		const raw = await QuarkStreams.decompress(data, encoding);
		return QuarkStreams.toBinary(raw);
	}

	static async compress(input, options) {
		const me = this;
		input = me.toBinary(input);
		return promisify(zlib.gzip)(input, options);
	}

	static async decompress(input, options) {
		const me = this;
		input = me.toBinary(input);
		if (!me.isCompressed(input)) return input;
		return promisify(zlib.gunzip)(input, options);
	}

	static toBinary(data) {
		if (data instanceof Uint8Array) return data;
		if (data instanceof ArrayBuffer) return new Uint8Array(data);
		if (typeof data === 'string') return QuarkBuffer.fromText(data);
		return this.toBinary(JSON.stringify(data));
	}

	/**
	 * If  1st 2 bytes mathes gzip/deflate header signature
	 * @param {ArrayBuffer|Uint8Array} data 
	 */
	static isCompressed(data) {
		const me = this;
		data = me.toBinary(data);
		return me.isGzip(data); // || me.isZlib(data);
	}

	/**
	 * If  1st 3 bytes matches gzip header signature
	 * 
	 * zlib
	 * 1F 8B 08
	 * 31 139 8
	 * 
	 * @param {ArrayBuffer|Uint8Array} data 
	 */
	static isGzip(data) {
		return data.at(0) === 31 && data.at(1) === 139 && data.at(2) === 8;
	}

	/**
	 * If  1st 2 bytes matches deflate (zlib) header signature
	 * 
	 * deflate
	 * 78  (01, 5e,9c, da) 
	 * 120 (1, 94, 156, 218)
	 * @param {ArrayBuffer|Uint8Array} data 
	 */
	static isZlib(data) {
		return data.at(0) === 120 && [1, 94, 156, 218].indexOf(data.at(1)) > -1;
	}

	static isJson(data) {
		const me = this;
		data = typeof data === 'string' ? data.trim() : me.toBinary(data);
		const first = data.at(0);
		const last = data.at(data.length - 1);
		return me.#isJsonArray(first, last) || me.#isJsonObj(first, last);
	}

	static #isJsonObj(first, last) {
		return (first === '{' || first === 123) && (last === '}' || last === 125);
	}

	static #isJsonArray(first, last) {
		return (first === '[' || first === 91) && (last === ']' || last === 93);
	}
}

module.exports = QuarkStreams;
