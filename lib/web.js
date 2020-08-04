/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */
const fetch = require("node-fetch");

const Security = require('./security');
const Generator = require('./generator');

/**
 * Web Requester Engine
 * Used to call remote services through HTTP/S
 */

const MIME = 'application/json';
const HEADERS = {
	'Accept': MIME,
	'Content-Type': MIME
};

/**
 * Send data to server wit hhttp/s channel
 */
async function fetchCall(url, data) {

	let body = JSON.stringify(data);
	let req = {
		method: 'post',
		heaedrs: HEADERS,
		body: body
	};
	let res = await fetch(url, req);
	let json = await res.json();

	return json;
}

/**
 * Prepare remtoe call, encrypt if avaialble
 *
 * @param {String} url
 *        Service URL to receive data
 *
 * @param {Object} req
 *         Data to sen (optionaly encrypt)
 */
async function onCall(url, req) {

	let hasArgs = Array.isArray(req.data) && req.data.length > 0;
	let shouldEncrypt = Security.isActive() && hasArgs;
	let data = req;

	// encrypt if supported
	if (shouldEncrypt) {
		data = await Security.encrypt(JSON.stringify(req));
	}

	// send and wait for response
	data = await fetchCall(url, data);

	// if error throw
	if (data.cmd == 'err') {
		throw new Error(data.result.msg);
	}

	// if encrypted, decrypt
	if (data.cmd === 'enc') {
		data = await Security.decrypt(data);
	}

	// return server response
	return data;

}

/**
 * If http/s used in url, make standard fetch call to the defined service
 */
function init(url) {

	Generator.removeAllListeners('call');
	Generator.on('call', async (req, callback) => {

		try {
			let o = await onCall(url, req);
			callback(null, o);
		} catch (e) {
			callback(e, null);
		}

	});

}

/**
 * Exported object with external methods
 */
const WebChannel = {

	init: function(url) {
		return init(url);
	}

};

Object.freeze(WebChannel);

module.exports = WebChannel;
