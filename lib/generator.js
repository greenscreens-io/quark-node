/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

const EventEmitter = require('events');

const Events = EventEmitter;

/**
 * Web and WebSocket API engine
 * Used to call remote services.
 * All Direct functions linked to defiend namespace
 */
class Generator extends Events {


	#model = {};
	#id = null;

	constructor(id) {
		super();
		this.#id = id;
	}

	/**
	 * Return generted API structure and callers
	 */
	get api() {
		return this.#model;
	}

	/**
	 * Disconnect generator from API callers
	 */
	stop() {

		const me = this;
		me.removeAllListeners('call');
		me.removeAllListeners('api');
		me.#detach();
	}

	#cleanup(obj, id) {
		for (let k in obj) {
			let el = obj[k];
			if (typeof el === "object") {
				if (this.#cleanup(el, id)) obj[k] = null;
			} else if (el._id_ === id) {
				obj[k] = null;
			}
		}
		return Object.values(obj).filter(o => o != null).length === 0;
	}

	#detach() {
		const me = this;
		me.#cleanup(me.#model, me.#id);
		me.#model = {};
	}

	/**
	 * Build JS object with callable functions that maps to Java side methods
	 * Data is retrieved from API service
	 *
	 * @param {String} url || api object
	 * 		  URL Address for API service definitions
	 */
	build(o) {

		const me = this;
		const data = o ? o.api || o : null;

		if (data) me.#buildAPI(data);

		return data;
	}

	/**
	 * From API tree generate namespace tree and
	 * links generated functions to WebScoket api calls
	 *
	 * @param {Object} cfg
	 * 		Alternative definition to API
	 */
	#buildAPI(cfg) {

		const me = this;

		if (Array.isArray(cfg)) {
			cfg.forEach(v => me.#buildInstance(v));
		} else {
			me.#buildInstance(cfg);
		}

	}

	/**
	 * Build from single definition
	 *
	 * @param {Object} api
	 * 		  Java Class/Method definition
	 */
	#buildInstance(api) {

		const me = this;
		let tree = null;
		let action = null;

		tree = me.#buildNamespace(api.namespace);

		if (!tree[api.action]) {
			tree[api.action] = {};
		}
		action = tree[api.action];

		api.methods.forEach(v => me.#buildMethod(api.namespace, api.action, action, v, me.#id));

	}

	/**
	 * Generate namespace object structure from string version
	 *
	 * @param  {String} namespace
	 * 			Tree structure delimited with dots
	 *
	 * @return {Object}
	 * 			Object tree structure
	 */
	#buildNamespace(namespace) {

		const me = this;

		let tmp = globalThis;
		let tmp2 = me.#model;

		namespace.split('.').every(v => {

			if (!tmp[v]) tmp[v] = {};
			tmp = tmp[v];

			if (!tmp2[v]) tmp2[v] = tmp;
			tmp2 = tmp;

			return true;
		});

		return tmp;
	}

	/**
	 * Build instance methods
	 *
	 * @param {String} namespace
	 * @param {String} action
	 * @param {String} instance
	 * @param {Array} api
	 */
	#buildMethod(namespace, action, instance, api, id) {

		const enc = api.encrypt === false ? false : true;
		const cfg = {
			n: namespace,
			c: action,
			m: api.name,
			l: api.len,
			e: enc,
			i: id
		};

		instance[api.name] = this.#apiFn(cfg);
		instance[api.name]._id_ = id;
		// Object.freeze(instance[api.name]);
	}

	/**
	 * Generic function used to attach for generated API
	 *
	 * @param {Array} params List of arguments from caller
	 */
	#apiFn(params) {

		const me = this;
		const prop = params;

		function fn() {

			const args = Array.prototype.slice.call(arguments);

			const req = {
				"namespace": prop.n,
				"action": prop.c,
				"method": prop.m,
				"id": prop.i,
				"e": prop.e,
				"data": args,
				"ts": Date.now()
			};

			const promise = new Promise((resolve, reject) => {
				me.emit('call', req, (err, obj) => {
					me.#onResponse(err, obj, prop, resolve, reject);
				});
			});

			return promise;
		}

		return fn;
	}

	/**
	 * Process remote response
	 */
	#onResponse(err, obj, prop, response, reject) {

		if (err) {
			reject(err);
			return;
		}

		const sts = (prop.c === obj.action) &&
			(prop.m === obj.method) &&
			obj.result &&
			obj.result.success;

		if (sts) {
			response(obj.result);
		} else {
			reject(obj.result || obj);
		}

	}

	/**
	 * Static instance builder
	 * @param {object} cfg Api list from server side Quark engine
	 * @param {number} id Unique Quark Engien ID - to link functions to the engine instance
	 * @returns 
	 */
	static async build(cfg, id) {
		const generator = new Generator(id);
		generator.build(cfg);
		return generator;
	}

}

module.exports = Generator;
