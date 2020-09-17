/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const zlib = require('zlib');

/**
 * Browser native compression
 */
class Streams {

	// 'deflate' or 'gzip'

	static isAvailable() {
		return true;
	}

	static async compress(input, options) {
		const promise = new Promise(function(resolve, reject) {
			zlib.gzip(input, options, function(error, result) {
				if (!error) resolve(result);
				else reject(Error(error));
			});
		});
		return promise;
	}

	static async decompress(input, options) {
		const promise = new Promise(function(resolve, reject) {
			zlib.gunzip(input, options, function(error, result) {
				if (!error) resolve(result);
				else reject(Error(error));
			});
		});
		return promise;
	}

}

module.exports = Streams;
