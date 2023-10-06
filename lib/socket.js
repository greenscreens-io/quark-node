/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

const WebSocket = require('ws');
const Streams = require('./Streams');
const Queue = require('./Queue');
const Security = require('./Security')

const QuarkEvent = require('./Event');
/*
const EventEmitter = require('events');
const Events = EventEmitter;
*/

/**
 * WebSocketChannel - to link WebSocket, data Generator and Security
 */
class SocketChannel extends QuarkEvent {

	#challenge = Date.now();
	#queue = new Queue();
	#webSocket = null;
	#engine = null;
	#iid = 0;

	/**
	 * Initialize Socket channel
	 */
	async init(engine) {

		const me = this;
		me.stop();
		me.#engine = engine;

		return new Promise((resolve, reject) => {
			me.#startSocket(resolve, reject);
			return null;
		});

	}

	get isOpen() {
		const me = this;
		if (me.#webSocket == null) return false;
		return me.#webSocket.readyState === me.#webSocket.OPEN;
	}

	/**
	 * Close WebSocket channel if available
	 */
	stop() {
		const me = this;
		if (me.#webSocket == null) return false;
		me.#webSocket.close();
		me.#webSocket = null;
		me.#engine = null;
		return true;
	}

	/**
	 * Must be here, if encryption and compression is not available, 
	 * for server to regoznize Quark data format.
	 * @param {*} req 
	 * @returns 
	 */
	#wrap(cmd, req) {
		const data = {
			type: 'GS',
			cmd: cmd,
			data: req ? [req] : null
		};
		return JSON.stringify(data);
	}

	get #ping() {
		return this.#wrap('ping');
	}

	/**
	 * Prepare remote call, encrypt if available
	 *
	 * @param {Object} req
	 *         Data to send (optionaly encrypt)
	 */
	async #onCall(req) {

		req = req.detail;

		const me = this;

		if (req.id !== me.#engine.id) return;

		me.#queue.updateRequest(req);

		const msg = me.#wrap('data', req);
		const raw = await Streams.wrap(msg, me.#engine.Security);
		me.#webSocket.send(raw);
	}

	async #startSocket(resolve, reject) {

		const me = this;
		const engine = me.#engine;
		const generator = engine.Generator;

		const url = new URL(engine.serviceURL);

		// const headers = Object.assign({}, engine.headers || {});
		const querys = Object.assign({}, engine.querys || {});
		querys.q = me.#challenge;
		querys.c = Streams.isAvailable;

		Object.entries(querys || {}).forEach((v) => {
			if (v[1]) url.searchParams.append(v[0], encodeURIComponent(v[1]));
		});

		// engine.Security.updateCookie();

		const opts = {
			headers: {
				Cookie: engine.Security.cookie()
			}
		};

		me.#webSocket = new WebSocket(url.toString(), ['quark'], opts);
		me.#webSocket.binaryType = "arraybuffer";

		const onCall = me.#onCall.bind(me);

		me.#webSocket.onopen = (event) => {

			me.emit('online', event);
			generator.on('call', onCall);
			me.#initPing();

			if (!engine.isWSAPI) {
				return resolve(true);
			}

			generator.once('api', async (e) => {
				try {
					const data = e.detail;
					data.challenge = me.#challenge;
					await engine.registerAPI(data);
					resolve(true);
				} catch (e) {
					reject(e);
				}

			});

		};

		me.#webSocket.onclose = (event) => {
			generator.off('call', onCall);
			clearInterval(me.#iid);
			me.stop();
			me.emit('offline', event);
		}

		me.#webSocket.onerror = (event) => {
			generator.off('call', onCall);
			reject(event);
			me.stop();
			me.emit('error', event);
		};

		me.#webSocket.onmessage = async (event) => {
			try {
				if (event.data instanceof ArrayBuffer) {
					await me.#prepareBinaryMessage(event.data);
				} else {
					await me.#prepareTextMessage(event.data);
				}
			} catch (e) {
				e.data = event;
				generator.emit('error', e);
			}
		};

	}

	#initPing() {
		const me = this;
		me.#iid = setInterval(() => {
			me.send(me.#ping);
		}, 15 * 1000);
	}

	async #prepareBinaryMessage(message) {

		const me = this;
		const engine = me.#engine;
		const security = engine.Security;

		message = await Streams.unwrap(message, security, me.#challenge);

		const isJSON = Streams.isJson(message);
		if (!isJSON) return generator.emit('raw', message);

		if (Array.isArray(message)) {
			message.forEach(m => me.#onMessage(m));
		} else {
			me.#onMessage(message);
		}
	}

	/**
	 * Parse and prepare received message for processing
	 *
	 * @param {String} mesasge
	 *
	 */
	async #prepareTextMessage(message) {

		const me = this;
		const engine = me.#engine;
		const generator = engine.Generator;

		try {
			const isJSON = Streams.isJson(message);

			if (!isJSON) return generator.emit('raw', message);

			message = JSON.parse(message);
			if (Array.isArray(message)) {
				message.forEach(m => me.#onMessage(m));
			} else {
				me.#onMessage(message);
			}

		} catch (e) {
			generator.emit('error', e);
		}

	}

	/**
	 * Process received message
	 *
	 * @param {*} msg
	 *
	 */
	async #onMessage(obj) {

		const me = this;
		let data = null;

		const engine = me.#engine;
		const generator = engine.Generator;

		if (obj.cmd === 'api') {
			return generator.emit('api', obj.data);
		}

		if (obj.cmd === 'err') {
			return generator.emit('error', obj.result);
		}

		if (obj.cmd === 'data') {
			data = obj.data;
		}

		if (data) {
			const unknown = me.#queue.process(data);
			unknown.forEach((obj) => me.emit('message', obj));
		} else {
			me.emit('message', data);
		}

	}

}

module.exports = SocketChannel;
