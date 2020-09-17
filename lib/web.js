/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */
const fetch = require("node-fetch");

/**
 * Web Requester Engine
 * Used to call remote services through HTTP/S
 */
class WebChannel {

	/**
	 * If http/s used in url, make standard fetch call to the defined service
	 */
	async init(engine) {

		let me = this;
		let Generator = engine.Generator;
		let Security = engine.Security;

		let data = await me.getAPI(engine.apiURL);
		await engine.registerAPI(data);

		if (engine.isSockChannel) return;

		Generator.on('call', async (req, callback) => {

			let o = null;
			let e = null;

			try {
				o = await me.onCall(engine, req);
			} catch (err) {
				e = err;
			}

			callback(e, o);

		});

	}

	stop() {

	}

	/**
	 * Get API definition through HTTP/s channel
	 *
	 * @param {String} url
	 * 		  URL Address for API service definitions
	 */
	async getAPI(url) {

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
	async fetchCall(url, data) {

		let MIME = 'application/json';
		let HEADERS = {
			'Accept': MIME,
			'Content-Type': MIME
		};

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
	async onCall(engine, req) {

		let me = this;
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
		data = await me.fetchCall(url, data);

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

}

module.exports = WebChannel;
