/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */
const fetch = require("node-fetch");

const MIME = 'application/json';
const HEADERS = {
	'Accept': MIME,
	'Content-Type': MIME
};

/**
 * Get API definition through HTTP/s channel
 *
 * @param {String} url
 * 		  URL Address for API service definitions
 */
async function getAPI(url) {

	let service = url;
	let id = Date.now();

	let resp = await fetch(service, {
		method: 'get',
		headers: {
			'x-time': id
		}
	});
	let data = await resp.json();

	// update local challenge for signature verificator
	data.challenge = id.toString();

	return data;

}

/**
 * Send data to server with http/s channel
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
async function onCall(engine, req) {

	let Security = engine.Security;
	let url = engine.serviceURL;

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
 * Web Requester Engine
 * Used to call remote services through HTTP/S
 */
class WebChannel {

	/**
	 * If http/s used in url, make standard fetch call to the defined service
	 */
	async init(engine) {

		let Generator = engine.Generator;
		let Security = engine.Security;

		let data = await getAPI(engine.apiURL);

		// initialize encryption if provided
		if (data.signature) {
			if (!Security.isActive()) {
				await Security.init(data);
			}
		}

		Generator.build(data.api);

		if (engine.isSockChannel) return;

		Generator.on('call', async (req, callback) => {

			try {
				let o = await onCall(engine, req);
				callback(null, o);
			} catch (e) {
				callback(e, null);
			}

		});

	}

	stop() {

	}
}

module.exports = WebChannel;
