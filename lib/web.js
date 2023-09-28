/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */
const fetch = require("node-fetch");
const Streams = require("./Streams");
const Security = require("./Security");

/**
 * Web Requester Engine
 * Used to call remote services through HTTP/S
 */
class WebChannel {

	static #MIME_BINARY = 'application/octet-stream';
	static #MIME_JSON = 'application/json';

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

		if (engine.isSocketChannel) return;

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
		if (engine.isSocketChannel) return;
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

	get #accept() {
		return `${WebChannel.#MIME_BINARY}, ${WebChannel.#MIME_JSON}`;
	}

	#mime(data) {
		const isBinary = typeof data === 'string' ? false : true;
		return isBinary ? WebChannel.#MIME_BINARY : WebChannel.#MIME_JSON;
	}

	/**
	 * Send data to server with http/s channel
	 */
	async #fetchCall(url, data, head, isCompress) {

		const me = this;
		const engine = me.#engine;
		const security = me.#engine.Security;
		const CONTENT_TYPE = me.#mime(data);
		
		const HEADERS_ = {
			'Accept': me.#accept,
			'Content-Type': CONTENT_TYPE,
			'Accept-Encoding': 'gzip,deflate,br'
			//Cookie: security.cookie()
		};
		
		if (isCompress && Streams.isAvailable) {
			data = Streams.toBinary(data);
			data = await Streams.compressOrDefault(data);
			HEADERS_['Content-Encoding'] = 'gzip';
		}

		const service = new URL(url);
		const headers = Object.assign({}, engine.headers || {}, HEADERS_, head || {});
		const querys = Object.assign({}, engine.querys || {});
		
		const req = {
			method: 'post',
			headers: headers,
			body: data
		};
		Object.entries(querys || {}).forEach((v) => {
			service.searchParams.append(v[0], encodeURIComponent(v[1]));
		});

		return await fetch(service.toString(), req);
	}

	async #onResponse(res) {
		const mime = res.headers.get('content-type') || '';
		const isBin = mime.includes(WebChannel.#MIME_BINARY);
		const isJson = mime.includes(WebChannel.#MIME_JSON);
		const isPlain = !isBin && !isJson;

		if (isJson) return await res.json();
		if (isPlain) {
			const txt = await res.text();
			if(!Streams.isJson(txt)) throw new Error('Invalid response');
			return JSON.parse(txt);
		}


		const raw = await res.arrayBuffer();
		const obj = await Streams.unwrap(raw, this.#engine.Security);
		
		if (obj && obj.type == 'ws' && obj.cmd === 'data') {
			return obj.data;
		}
		return obj;
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

		const isEncrypt = security?.isValid;	
		let isCompress = false;
		let raw = null;

		if (isEncrypt) {
			raw = await Streams.wrap(req, me.#engine.Security);
		} else {
			raw = JSON.stringify(raw);
			isCompress = true;
		}

		const head = {};

		if (isEncrypt) {
			head['gs-public-key'] = security.publicKey;
		}

		// send and wait for response
		const res = await me.#fetchCall(url, raw, head, isCompress);
		const data = await me.#onResponse(res);

		// if error throw
		if (data.cmd == 'err') {
			throw new Error(data.result.msg);
		}

		// return server response
		return data;

	}

}


module.exports = WebChannel;
