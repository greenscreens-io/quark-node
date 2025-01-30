/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

/**
 * Web and WebSocket API engine
 * Used to initialize remote API and remote services.
 */

const QuarkSecurity = require('./Security');
const QuarkGenerator = require('./Generator');
const QuarkWebChannel = require('./Web');
const QuarkSocketChannel = require('./Socket');

const ERROR_MESSAGE = 'Invalid definition for Engine Remote Service';
const ERROR_API_UNDEFINED = 'API Url not defined!';
const ERROR_SVC_UNDEFINED = 'Service Url not defined!';

/**
 * Main class for Quark Engine Client
 */
class QuarkEngine {

	#cfg = null;
	#isWSAPI = false;
	#isWebChannel = false;
	#isSocketChannel = false;

	#Security = null;
	#Generator = null;
	#WebChannel = null;
	#SocketChannel = null;

	#headers = null;
	#querys = null;

	#id = null;

	constructor(cfg) {

		cfg = cfg || {};

		if (!cfg.api) {
			throw new Error(ERROR_API_UNDEFINED);
		}

		if (!cfg.service) {
			throw new Error(ERROR_SVC_UNDEFINED);
		}

		const me = this;

		me.#cfg = null;
		me.#isWSAPI = false;
		me.#isWebChannel = false;
		me.#isSocketChannel = false;

		me.#Security = null;
		me.#Generator = null;
		me.#WebChannel = null;
		me.#SocketChannel = null;
		me.#id = Date.now();

		me.#cfg = cfg;
		me.#isWSAPI = cfg.api === cfg.service && cfg.api.indexOf('ws') == 0;

		me.#headers = cfg.headers || {};
		me.#querys = cfg.querys || {};

		me.#Security = cfg.security instanceof QuarkSecurity ? cfg.security : null;
		me.#isWebChannel = cfg.service.indexOf('http') === 0;
		me.#isSocketChannel = cfg.service.indexOf('ws') === 0;

		if ((me.isWebChannel || me.isSocketChannel) === false) {
			throw new Error(ERROR_MESSAGE);
		}
		
	}

	/*
	 * Initialize engine, throws error,
	 */
	async init() {

		const me = this;
		if (me.isActive) return;

		try {
			if (!me.#Security) {
				me.#Security = await QuarkSecurity.create();
			}
			me.#Generator = new QuarkGenerator(me.id);

			if (me.isWebChannel || me.isWSAPI == false) {
				me.#WebChannel = new QuarkWebChannel();
				await me.WebChannel.init(me);
			}

			if (me.isSocketChannel) {
				me.#SocketChannel = new QuarkSocketChannel();
				await me.SocketChannel.init(me);
			}

			return me;
		} catch (error) {
			console.error(`Engine initialization failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Use internaly from channel to register received
	 * API definitions and security data
	 */
	async registerAPI(data) {

		const me = this;

		// initialize encryption if provided
		if (data.signature && !me.Security?.isValid) {
			await me.Security?.init(data);
		}

		me.Generator?.build(data.api);
	}

	/**
	 * Stop engine instance by clearing all references
	 * stoping listeners, stoping socket is avaialble
	 */
	stop() {

		const me = this;

		me.WebChannel?.stop();
		me.SocketChannel?.stop();
		me.Generator?.stop();

		me.#WebChannel = null;
		me.#SocketChannel = null;
		me.#Generator = null;
		me.#Security = null;
		me.#cfg = null;
	}

	/*
	 * Return generated API
	 */
	get api() {
		return this.Generator?.api || null;
	}

	/*
	 * Check if engine is active
	 */
	get isActive() {
		const me = this;
		if (me.SocketChannel && !me.SocketChannel.isOpen) return false;
		return me.api && me.Security ? true : false;
	}

	/*
	 * Return API URL address
	 */
	get apiURL() {
		return this.cfg?.api || null;
	}

	/*
	 * Return Service URL address
	 */
	get serviceURL() {
		return this.cfg?.service || null;
	}

	get cfg() { return this.#cfg };
	get isWSAPI() { return this.#isWSAPI };
	get isWebChannel() { return this.#isWebChannel };
	get isSocketChannel() { return this.#isSocketChannel };

	get Security() { return this.#Security; }
	get Generator() { return this.#Generator; }
	get WebChannel() { return this.#WebChannel; }
	get SocketChannel() { return this.#SocketChannel; }

	get headers() { return this.#headers; }
	get querys() { return this.#querys; }
	get id() { return this.#id; }
	/*
	 * Static instance builder
	 */
	static async init(cfg) {
		const engine = new QuarkEngine(cfg);
		return engine.init();
	}
}

module.exports = QuarkEngine;
