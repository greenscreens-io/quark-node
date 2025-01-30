/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */
const fetch = require("node-fetch");
const QuarkStreams = require("./Streams");

/**
 * Web Requester Engine
 * Used to call remote services through HTTP/S
 */
class QuarkWebChannel {

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
		const engine = me.#engine;
		const security = engine.Security;
		const id = Date.now();

		const headers = Object.assign({}, engine.headers || {}, { 'gs-challenge': id });

		if (security.publicKey) {
			headers['gs-public-key'] = security.publicKey;
		}

		const res = await me.#fetchCall(url, null, headers, false, 'get');
		const data = await me.#onResponse(res, id);

		// update local challenge for signature verificator
		data.challenge = id.toString();

		return data;

	}

	get #accept() {
		return `${QuarkWebChannel.#MIME_BINARY}, ${QuarkWebChannel.#MIME_JSON}`;
	}

	#mime(data) {
		const isBinary = typeof data === 'string' ? false : true;
		return isBinary ? QuarkWebChannel.#MIME_BINARY : QuarkWebChannel.#MIME_JSON;
	}

	/**
	 * Send data to server with http/s channel
	 */
	async #fetchCall(url, data, head, isCompress, method = 'post') {

		const me = this;
		const engine = me.#engine;
		const CONTENT_TYPE = me.#mime(data);

		const HEADERS_ = {
			'Accept': me.#accept,
			'Content-Type': CONTENT_TYPE,
			'Accept-Encoding': 'gzip,deflate,br'
		};

		if (isCompress && QuarkStreams.isAvailable) {
			data = QuarkStreams.toBinary(data);
			data = await QuarkStreams.compressOrDefault(data);
			HEADERS_['Content-Encoding'] = 'gzip';
		}

		const service = new URL(url);
		const headers = Object.assign({}, engine.headers || {}, HEADERS_, head || {});
		const querys = Object.assign({}, engine.querys || {});

		const req = {
			method: method,
			headers: headers
		};

		if (data) req.body = data;

		Object.entries(querys || {}).forEach((v) => {
			service.searchParams.append(v[0], encodeURIComponent(v[1]));
		});

		try {
			return await fetch(service.toString(), req);
		} catch (error) {
			console.error(`Fetch call failed: ${error.message}`);
			throw error;
		}
	}

	async #onResponse(res, id) {

		let obj = await QuarkWebChannel.fromResponse(res);

		if (obj instanceof Uint8Array) {
			obj = await QuarkStreams.unwrap(obj, this.#engine.Security, id);
		}

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

		if (req) {
			if (isEncrypt) {
				raw = await QuarkStreams.wrap(req, me.#engine.Security);
			} else {
				raw = JSON.stringify(raw);
				isCompress = true;
			}
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

	static async fromResponse(res) {

		if (!res.ok) {
			throw new Error(`${res.status} : ${res.statusText}`);
		}

		const mime = res.headers.get('content-type') || '';
		const isBin = mime.includes(QuarkWebChannel.#MIME_BINARY);
		const isJson = mime.includes(QuarkWebChannel.#MIME_JSON);
		const isPlain = !isBin && !isJson;

		if (isJson) return await res.json();
		if (isPlain) return await res.text();

		const raw = await res.arrayBuffer();
		return new Uint8Array(raw);
	}

}


module.exports = QuarkWebChannel;
