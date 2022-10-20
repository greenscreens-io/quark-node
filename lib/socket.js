/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const WebSocket = require('ws');
const Streams = require('./streams');
const Queue = require('./queue');

const EventEmitter = require('events');

const Events = EventEmitter;


/**
 * WebSocketChannel - to link WebSocket, data Generator and Security
 */
class SocketChannel extends Events {

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

	get isOpen() {
		const me = this;
		if (me.webSocket == null) return false;
		return me.webSocket.readyState === me.webSocket.OPEN;
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

		const me = this;
		let msg = null;

		if (req.id !== me.engine.id) return;

		const isEncrypt = me.canEncrypt(req);

		me.queue.updateRequest(req, callback);

		// encrypt if supported
		if (isEncrypt) {
			const enc = await me.engine.Security.encrypt(req.data);
			const payload = Object.assign({}, me.engine.querys || {}, enc || {});
			req.data = [payload];
		}

		const data = {
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

		const me = this;
		const engine = me.engine;
		const generator = engine.Generator;

		const challenge = Date.now();
		const url = new URL(url);

		const headers = Object.assign({}, engine.headers || {});
		const querys = Object.assign({}, engine.querys || {});
		querys.q = challenge;
		querys.c = Streams.isAvailable;
		
		Object.entries(querys || {}).forEach((v) => {
			url.searchParams.append(v[0], encodeURIComponent(v[1]));			
		});

		me.webSocket = new WebSocket(url, ['ws4is']);
		me.webSocket.binaryType = "arraybuffer";

		let onCall = me.onCall.bind(me);

		me.webSocket.onopen = (event) => {

			me.emit('online', event);
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
			me.emit('offline', event);
		}

		me.webSocket.onerror = (event) => {
			generator.off('call', onCall);
			reject(event);
			me.stop();
			me.emit('error', event);
		};

		me.webSocket.onmessage = (event) => {
			me._prepareMessage(event.data);
		};

	}

	_isJsonObj(msg) {
		return msg.startsWith('{') && msg.endsWith('}');
	}
	
	_isJsonArray(msg) {
		return msg.startsWith('[') && msg.endsWith(']');
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

			const msg = text.trim();
			const isJSON = me._isJsonObj(msg) || me._isJsonArray(msg); 

			if (typeof message === 'string') {
				obj = JSON.parse(message);
			}

			if (isJSON) {
				obj = JSON.parse(text);
				me.onMessage(obj);				
			} else {
				generator.emit('raw', text);	
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

		const me = this;
		let data = null;

		const engine = me.engine;
		const generator = engine.Generator;
		const security = engine.Security;

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
			const unknown = me.queue.process(data);
			unknown.forEach((obj) => me.emit('message', obj));
		} else {
			me.emit('message', data);
		}

	}

};

module.exports = SocketChannel;
