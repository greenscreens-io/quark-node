/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

/**
 * Web and WebSocket API engine
 * Used to initialize remote API and remote services.
 */

const fetch = require("node-fetch");

const Security = require('./security');
const Generator = require('./generator');
const WebChannel = require('./web');
const SocketChannel = require('./socket');

const ERROR_MESSAGE = 'Invalid definition for Engine Remote Service';
const ERROR_API_UNDEFINED = 'API Url not defined!';
const ERROR_SVC_UNDEFINED = 'Service Url not defined!';

/**
 * Main class for Quark Engine Client
 */
class Engine {

	constructor(cfg) {

		cfg = cfg || {};

		if (!cfg.api) {
			throw new Error(ERROR_API_UNDEFINED);
		}

		if (!cfg.service) {
			throw new Error(ERROR_SVC_UNDEFINED);
		}

		let me = this;

		me.cfg = null;
		me.isWSAPI = false;
		me.isWebChannel = false;
		me.isSockChannel = false;

		me.Security = null;
		me.Generator = null;
		me.WebChannel = null;
		me.SockChannel = null;
		me.id = Date.now();

		me.cfg = cfg;
		me.isWSAPI = cfg.api === cfg.service && cfg.api.indexOf('ws') == 0;

		me.headers = cfg.headers || {};
		me.querys = cfg.querys || {};

		me.isWebChannel = cfg.service.indexOf('http') === 0;
		me.isSockChannel = cfg.service.indexOf('ws') === 0;

		if ((me.isWebChannel || me.isSockChannel) === false) {
			throw new Error(ERROR_MESSAGE);
		}

	}

	/*
	 * Initialize engine, throws error,
	 */
	async init() {

		let me = this;
		if (me.isActive) return;

		me.Security = new Security();
		me.Generator = new Generator(me.id);

		if (me.isWebChannel || !me.isWSAPI) {
			me.WebChannel = new WebChannel();
			await me.WebChannel.init(me);
		}

		if (me.isSockChannel) {
			me.SocketChannel = new SocketChannel();
			await me.SocketChannel.init(me);
		}

	}

	/**
	 * Use internaly from channel to register received
	 * API definitiona and security data
	 */
	async registerAPI(data) {

		let me = this;

		// initialize encryption if provided
		if (data.signature) {
			if (!me.Security.isActive) {
				await me.Security.init(data);
			}
		}

		me.Generator.build(data.api);
	}

	/**
	 * Stop engine instance by clearing all references
	 * stoping listeners, stoping socket is avaialble
	 */
	stop() {

		let me = this;

		if (me.WebChannel) me.WebChannel.stop();
		if (me.SocketChannel) me.SocketChannel.stop();
		if (me.Generator) me.Generator.stop();

		me.WebChannel = null;
		me.SocketChannel = null;
		me.Generator = null;
		me.Security = null;
		me.cfg = null;
	}

	/*
	 * Return generated API
	 */
	get api() {
		return this.Generator ? this.Generator.api : null;
	}

	/*
	 * Check if engine is active
	 */
	get isActive() {
		return this.api && this.Security;
	}

	/*
	 * Return API URL address
	 */
	get apiURL() {
		return this.cfg ? this.cfg.api : null;
	}

	/*
	 * Return Service URL address
	 */
	get serviceURL() {
		return this.cfg ? this.cfg.service : null;
	}

	/**
	 * Static instance builder
	 */
	static async init(cfg) {
		let engine = new Engine(cfg);
		await engine.init();
		return engine;
	}
}

module.exports = Engine;
