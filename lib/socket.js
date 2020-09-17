/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const WebSocket = require('ws');
const Streams = require('./streams');

const Queue = require('./queue');

const Decoder = new TextDecoder();
const Encoder = new TextEncoder();

/**
 * WebSocketChannel - to link WebSocket, data Generator and Security
 */
class SocketChannel {

	queue = new Queue();
	webSocket = null;
	engine = null;

	/**
	 * Initialize Socket channel
	 */
	async init(engine) {

		let me = this;
		me.stop();
		me.engine = engine;

		return new Promise((resolve, reject) => {
			me._startSocket(resolve, reject);
			return null;
		});

	}

	/**
	 * Close WebSocket channel if available
	 */
	stop() {
		let me = this;
		if (me.webSocket == null) return false;
		me.webSocket.close();
		me.webSocket = null;
		me.engine = null;
		return true;
	}

	async _startSocket(resolve, reject) {

		let me = this;
		let Engine = me.engine;
		let Generator = Engine.Generator;
		let Security = Engine.Security;

		let challenge = Date.now();
		let url = Engine.serviceURL + '?q=' + challenge;

		me.webSocket = new WebSocket(url, ['ws4is']);
		me.webSocket.binaryType = "arraybuffer";

		let onCall = me.onCall.bind(me);

		me.webSocket.onopen = (event) => {

			Generator.on('call', onCall);

			if (!Engine.isWSAPI) {
				return resolve(true);
			}

			Generator.once('api', async (data) => {

				try {
					data.challenge = challenge;
					await Engine.registerAPI(data);
					resolve(true);
				} catch (e) {
					reject(e);
				}

			});

		};

		me.webSocket.onclose = (event) => {
			Generator.off('call', onCall);
			me.stop();
		}

		me.webSocket.onerror = (event) => {
			Generator.off('call', onCall);
			reject(event);
			me.stop();
		};

		me.webSocket.onmessage = (event) => {
			me.prepareMessage(event.data);
		};

	}


	/**
	 * Check if data can be encrypted
	 *
	 * @param {Object} req
	 */
	canEncrypt(req) {
		let hasArgs = Array.isArray(req.data) && req.data.length > 0 && req.e !== false;
		return this.engine.Security.isActive() && hasArgs;
	}

	/**
	 * Prepare remtoe call, encrypt if avaialble
	 *
	 * @param {Object} req
	 *         Data to send (optionaly encrypt)
	 */
	async onCall(req, callback) {

		let me = this;
		let msg = null;
		let enc = null;
		let data = null;

		let isEncrypt = me.canEncrypt(req);

		me.queue.updateRequest(req, callback);

		// encrypt if supported
		if (isEncrypt) {
			enc = await me.engine.Security.encrypt(req.data);
			req.data = [enc];
		}

		data = {
			cmd: isEncrypt ? 'enc' : 'data',
			type: 'ws',
			data: [req]
		};

		msg = JSON.stringify(data);

		if (!Streams.isAvailable()) {
			return me.webSocket.send(msg);
		}

		msg = await Streams.compress(msg);
		me.webSocket.send(msg);
	}

	/**
	 * Parse and prepare received message for processing
	 *
	 * @param {String} mesasge
	 *
	 */
	async prepareMessage(message) {

		let me = this;
		let obj = null;

		let Engine = me.engine;
		let Generator = Engine.Generator;

		try {

			if (message instanceof ArrayBuffer) {
				let text = await Streams.decompress(message);
				obj = JSON.parse(text);
			}

			if (typeof message === 'string') {
				obj = JSON.parse(message);
			}

			if (obj) {
				me.onMessage(obj);
			} else {
				Generator.emit('error', event);
			}

		} catch (e) {
			Generator.emit('error', e);
		}

	}


	/**
	 * Process received message
	 *
	 * @param {*} msg
	 *
	 */
	async onMessage(obj) {

		let me = this;
		let data = null;

		let Engine = me.engine;
		let Generator = Engine.Generator;
		let Security = Engine.Security;

		if (obj.cmd === 'api') {
			return Generator.emit('api', obj.data);
		}

		if (obj.cmd === 'err') {
			return Generator.emit('error', obj.result);
		}

		if (obj.cmd === 'enc') {
			data = await Security.decrypt(obj);
		}

		if (obj.cmd === 'data') {
			data = obj.data;
		}

		if (data) {
			me.queue.process(data);
		}

	}

};

module.exports = SocketChannel;
