/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */
const fetch = require("node-fetch");

/**
 * Web Requester Engine
 * Used to call remote services through HTTP/S
 */
class WebChannel {

	#engine = null;

	/**
	 * If http/s used in url, make standard fetch call to the defined service
	 */
	async init(engine) {

		const me = this;

		if (me.#engine) me.stop();

		me.#engine = engine;
		const generator = engine.Generator;

		const data = await me.#getAPI(engine.apiURL);
		await engine.registerAPI(data);

		if (engine.isSockChannel) return;

		generator.on('call', me.#onRequest.bind(me));

	}

	/**
	 * Disengage listeners and links
	 */
	stop() {

		const me = this;
		const engine = me.#engine;
		me.#engine = null;

		engine.Generator.off('call');
		if (engine.isSockChannel) return;
		try {
			fetch(engine.serviceURL, {
				method: 'delete'
			});
		} catch (e) {
			console.log(e);
		}
	}

	/**
	 * Callback for API call request,
	 * here we make remote API call
	 */
	async #onRequest(req) {

		req = req.detail;
		const me = this;
		let o = null;

		if (req.id !== me.#engine.id) return;

		try {
			o = await me.#onCall(me.#engine, req);
			req.finish(o);
		} catch (err) {
			req.finish(err);
		}

	}

	/**
	 * Get API definition through HTTP/s channel
	 *
	 * @param {String} url
	 * 		  URL Address for API service definitions
	 */
	async #getAPI(url) {

		const me = this;
		const service = url;
		const engine = me.#engine;
		const id = Date.now();

		const headers = Object.assign({}, engine.headers || {}, { 'x-time': id });

		const resp = await fetch(service, {
			method: 'get',
			headers: headers,
			credentials: 'same-origin'
		});

		const data = await resp.json();

		// update local challenge for signature verificator
		data.challenge = id.toString();

		return data;

	}

	/**
	 * Send data to server with http/s channel
	 */
	async #fetchCall(url, data, head) {

		const me = this;
		const engine = me.#engine;
		const MIME = 'application/json';
		const HEADERS_ = {
			'Accept': MIME,
			'Content-Type': MIME,
			'Accept-Encoding': 'gzip,deflate,br'
		};

		const service = new URL(url);
		const headers = Object.assign({}, engine.headers || {}, HEADERS_, head || {});
		const querys = Object.assign({}, engine.querys || {});
		const payload = Object.assign({}, engine.querys || {}, data || {});
		const body = JSON.stringify(payload);
		const req = {
			method: 'post',
			headers: headers,
			body: body
		};
		Object.entries(querys || {}).forEach((v) => {
			service.searchParams.append(v[0], encodeURIComponent(v[1]));
		});
		const res = await fetch(service.toString(), req);
		const json = await res.json();

		return json;
	}

	/**
	 * Prepare remote call, encrypt if available
	 *
	 * @param {String} url
	 *        Service URL to receive data
	 *
	 * @param {Object} req
	 *         Data to send (optionally encrypt)
	 */
	async #onCall(engine, req) {

		const me = this;
		const security = engine.Security;
		const url = engine.serviceURL;

		const hasArgs = Array.isArray(req.data) && req.data.length > 0;
		const shouldEncrypt = security.isValid && hasArgs && req.enc;
		let data = req;

		// encrypt if supported
		if (shouldEncrypt) {
			data = await security.encrypt(req);
		}

		// send and wait for response
		data = await me.#fetchCall(url, data);

		// if error throw
		if (data.cmd == 'err') {
			throw new Error(data.result.msg);
		}

		// if encrypted, decrypt
		if (data.cmd === 'enc') {
			if (security.isValid) {
				data = await security.decrypt(data);
			} else {
				throw new Error('Security available on https/wss only');
			}
		}

		// return server response
		return data;

	}

}


module.exports = WebChannel;
