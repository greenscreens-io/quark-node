/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const WebSocket = require('ws');
const Streams = require('./streams');
const Queue = require('./queue');

/**
 * WebSocketChannel - to link WebSocket, data Generator and Security
 */
class SocketChannel {

	constructor() {

		let me = this;

		me.queue = new Queue();
		me.webSocket = null;
		me.engine = null;
	}

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

	/**
	 * Check if data can be encrypted
	 *
	 * @param {Object} req
	 */
	canEncrypt(req) {
		let hasArgs = Array.isArray(req.data) && req.data.length > 0 && req.e !== false;
		return this.engine.Security.isValid && hasArgs;
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

		if (!Streams.isAvailable) {
			return me.webSocket.send(msg);
		}

		msg = await Streams.compress(msg);
		me.webSocket.send(msg);
	}

	async _startSocket(resolve, reject) {

		let me = this;
		let engine = me.engine;
		let generator = engine.Generator;

		let challenge = Date.now();
		let url = engine.serviceURL + '?q=' + challenge;

		me.webSocket = new WebSocket(url, ['ws4is']);
		me.webSocket.binaryType = "arraybuffer";

		let onCall = me.onCall.bind(me);

		me.webSocket.onopen = (event) => {

			generator.on('call', onCall);

			if (!engine.isWSAPI) {
				return resolve(true);
			}

			generator.once('api', async (data) => {

				try {
					data.challenge = challenge;
					await engine.registerAPI(data);
					resolve(true);
				} catch (e) {
					reject(e);
				}

			});

		};

		me.webSocket.onclose = (event) => {
			generator.off('call', onCall);
			me.stop();
		}

		me.webSocket.onerror = (event) => {
			generator.off('call', onCall);
			reject(event);
			me.stop();
		};

		me.webSocket.onmessage = (event) => {
			me._prepareMessage(event.data);
		};

	}

	/**
	 * Parse and prepare received message for processing
	 *
	 * @param {String} mesasge
	 *
	 */
	async _prepareMessage(message) {

		let me = this;
		let obj = null;

		let engine = me.engine;
		let generator = engine.Generator;

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
				generator.emit('error', event);
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
	async onMessage(obj) {

		let me = this;
		let data = null;

		let engine = me.engine;
		let generator = engine.Generator;
		let security = engine.Security;

		if (obj.cmd === 'api') {
			return generator.emit('api', obj.data);
		}

		if (obj.cmd === 'err') {
			return generator.emit('error', obj.result);
		}

		if (obj.cmd === 'enc') {
			if (Security.isAvailable) {
				data = await security.decrypt(obj);
			} else {
				return generator.emit('error', new Error('Security available on https/wss only'));
			}
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
