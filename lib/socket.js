/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const WebSocket = require('ws');
const Packer = require('wasm-flate');

const Decoder = new TextDecoder();
const Encoder = new TextEncoder();

/**
 * Web and WebSocket API engine
 * Used to call remote services.
 * All Direct functions linked to io.greenscreens namespace
 */

/**
 * Queue to handle requests
 */
class Queue {

	up = 0;
 	down = 0;
	tid = 0;
	list = [];

	/**
	 * Update counters and queue to link resposnes to requests
	 * @param {Object} req
	 *      Request data
	 */
	updateRequest(req, callback) {
		let me = this;
		me.tid++;
		me.up++;
		req.tid = me.tid.toString();
		me.list[req.tid] = callback;
	}

	/**
	 * Rerset queue to remove old staleld elements
	 */
	cleanQueue() {
		let me = this;
		if (me.up > 50 && me.down >= me.up) {
			me.up = 0;
			me.down = 0;
		}
	}

}

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

		var challenge = Date.now();

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
			me.doData(obj);
		}

		if (obj.cmd === 'enc') {

			data = await Security.decrypt(obj);

			if (data) {
				me.doData(data);
			}

		}
	}

	/**
	 * Process multiple records in a single response
	 *
	 * @param {Object || Array} obj
	 *
	 */
	doData(obj) {

		let me = this;
		if (Array.isArray(obj)) {

			obj.every(o => {
				me.onData(o);
				return true;
			});

		} else {
			me.onData(obj);
		}
	}

	/**
	 * Process single response record
	 *
	 * @param {Object} obj
	 */
	onData(obj) {

		let me = this;
		let queue = me.queue;

		queue.down++;

		if (typeof queue.list[obj.tid] === 'function') {
			try {
				queue.list[obj.tid](null, obj);
			} finally {
				queue.list[obj.tid] = null;
			}
		}

		queue.cleanQueue();

	};

};

module.exports = SocketChannel;
