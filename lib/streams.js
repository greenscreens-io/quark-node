/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

const zlib = require('node:zlib');
const { promisify } = require('node:util');

/**
 * Native compression for gzip
 */
class Streams {

	// 'gzip'

	static get isAvailable() {
		return true;
	}

	static convert(data) {
		if (data instanceof Uint8Array) return data;
		if (data instanceof ArrayBuffer) return new Uint8Array(data);
		if (typeof data === 'string' ) return new TextEncoder().encode(data);
		if (Array.isArray(data)) return new Uint8Array(data);
		return this.convert(JSON.stringify(data));
	}

	static async compress(input, options) {
		const me = this;
		input = me.convert(input);		
		return promisify(zlib.gzip)(input, options);
		/*
		const promise = new Promise((resolve, reject) => {
			zlib.gzip(input, options, (error, result) => {
				if (!error) resolve(result);
				else reject(Error(error));
			});
		});
		return promise;
		*/
	}

	static async decompress(input, options) {
		const me = this;
		input = me.convert(input);
		if (!me.isCompressed(input)) return input;
		return promisify(zlib.gunzip)(input, options);
		/*
		const promise = new Promise((resolve, reject) => {
			zlib.gunzip(input, options, (error, result) => {
				if (!error) resolve(result);
				else reject(Error(error));
			});
		});
		return promise;
		*/
	}

	/**
	 * If  1st 3 bytes mathes gzip header signature
	 * 1F 8B 08
	 * 31 139 8
	 * @param {ArrayBuffer|Uint8Array} data 
	 */
	static isCompressed(data) {
		data = this.convert(data);
		return data.at(0) === 31 && data.at(1) === 139 && data.at(2) === 8;
	}

	static isJson(data) {
		const me = this;
		data = typeof data === 'string' ? data.trim() : me.convert(data);
		const first = data.at(0);
		const last = data.at(data.length - 1);		
		return me.#isJsonArray(first, last) || me.#isJsonObj(first, last);
	}

	static #isJsonObj(first, last) {
		return (first === '{' || first === 123)  && (last === '}' || last === 125);
	}

	static #isJsonArray(first, last) {
		return (first === '[' || first === 91)  && (last === ']' || last === 93);
	}	
}

module.exports = Streams;
