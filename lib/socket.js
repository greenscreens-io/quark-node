/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const WebSocket = require('ws');
const Packer = require('wasm-flate');

const Queue = require('./queue');

const Decoder = new TextDecoder();
const Encoder = new TextEncoder();

/**
 * WebSocketChannel - to link WebSocket, data Generator and Security
 */
class SocketChannel {

	queue = new Queue();
	supportCompress = true;
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

		var me = this;
		var Engine = me.engine;
		var Generator = Engine.Generator;
		var Security = Engine.Security;

		var challenge = Date.now();
		var url = Engine.serviceURL + '?q=' + challenge;

		me.webSocket = new WebSocket(url, ['ws4is']);
		me.webSocket.binaryType = "arraybuffer";

		let onCall = me.onCall.bind(me);

		me.webSocket.onopen = function(event) {

			Generator.on('call', onCall);

			if (!Engine.isWSAPI) {
				return resolve(true);
			}

			Generator.once('api', async (data) => {

				try {

					data.challenge = challenge;

					if (data.signature) {
						if (!Security.isActive()) {
							await Security.init(data);
						}
					}

					Generator.build(data.api);

					resolve(true);
				} catch (e) {
					reject(e);
				}

			});

		};

		me.webSocket.onclose = function(event) {
			Generator.off('call', onCall);
			me.stop();
		}

		me.webSocket.onerror = function(event) {
			me.Generator.off('call', onCall);
			reject(event);
			me.stop();
		};

		me.webSocket.onmessage = function(event) {
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
		let verb = 'data';

		let isEncrypt = me.canEncrypt(req);

		me.queue.updateRequest(req, callback);

		// encrypt if supported
		if (isEncrypt) {
			enc = await me.engine.Security.encrypt(JSON.stringify(req.data));
			req.data = [enc];
			verb = 'enc';
		}

		data = {
			cmd: verb,
			type: 'ws',
			data: [req]
		};
		msg = JSON.stringify(data);

		if (!me.supportCompress) {
			return me.webSocket.send(msg);
		}

		msg = Packer.gzip_encode_raw(Encoder.encode(msg));
		me.webSocket.send(msg.buffer);
	}

	/**
	 * Parse and prepare received message for processing
	 *
	 * @param {String} mesasge
	 *
	 */
	prepareMessage(message) {

		let me = this;
		let obj = null;

		let Engine = me.engine;
		let Generator = Engine.Generator;

		try {

			if (message instanceof ArrayBuffer) {
				let dec = Packer.gzip_decode_raw(new Uint8Array(message));
				let text = Decoder.decode(dec);
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

		if (obj.cmd === 'data') {
			obj = obj.data;
			me.queue.process(obj);
		}

		if (obj.cmd === 'enc') {

			data = await Security.decrypt(obj);

			if (data) {
				me.queue.process(data);
			}

		}
	}

};

module.exports = SocketChannel;
