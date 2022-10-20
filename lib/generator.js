/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const EventEmitter = require('events');

const Events = EventEmitter;

/**
 * Web and WebSocket API engine
 * Used to call remote services.
 * All Direct functions linked to defiend namespace
 */
class Generator extends Events {

	constructor(id) {
		super();
		this._model = {};
		this.id = id;
	}

	/**
	 * Return generted API structure and callers
	 */
	get api() {
		return this._model;
	}

	/**
	 * Disconnect generator from API callers
	 */
	stop() {
		let me = this;
		me.removeAllListeners('call');
		me.removeAllListeners('api');
		me.detach();
	}

	_cleanup(obj, id) {
		for (let k in obj) {
			let el = obj[k];
			if (typeof el === "object") {
				if(this._cleanup(el, id)) obj[k] = null;
			} else if(el._id_ === id) {
				obj[k] = null;
			}
		}
		return Object.values(obj).filter(o => o != null).length === 0;
	}
	
	detach() {
		const me = this;
		me._cleanup(me._model, me.id);
		me._model = {};
	}

	/**
	 * Attach generated API namespace to global
	 */
	attach() {
		//const me = this;
		//Object.entries(me._model).forEach(v => globalThis[v[0]] = v[1]);
	}

	/**
	 * Build JS object with callable functions that maps to Java side methods
	 * Data is retrieved from API service
	 *
	 * @param {String} url || api object
	 * 		  URL Address for API service definitions
	 */
	build(o) {
		let me = this;
		let data = o ? o.api || o : null;

		if (!data) return data;
		me._buildAPI(data);
		me.attach();

		return data;
	}

	/**
	 * From API tree generate namespace tree and
	 * links generated functions to WebScoket api calls
	 *
	 * @param {Object} cfg
	 * 		Alternative definition to API
	 */
	_buildAPI(cfg) {

		let me = this;

		if (Array.isArray(cfg)) {
			cfg.every(v => {
				me._buildInstance(v);
				return true;
			});
		} else {
			me._buildInstance(cfg);
		}

	}

	/**
	 * Build from single definition
	 *
	 * @param {Object} api
	 * 		  Java Class/Method definition
	 */
	_buildInstance(api) {

		let me = this;
		let tree = null;
		let action = null;

		tree = me._buildNamespace(api.namespace);

		if (!tree[api.action]) {
			tree[api.action] = {};
		}
		action = tree[api.action];

		api.methods.every(v => {
			me._buildMethod(api.namespace, api.action, action, v, me.id);
			return true;
		});
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
	_buildNamespace(namespace) {

		const me = this;

		let tmp = globalThis;
		let tmp2 = me._model;

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
	_buildMethod(namespace, action, instance, api, id) {

		let enc = api.encrypt === false ? false : true;
		let cfg = {
			n: namespace,
			c: action,
			m: api.name,
			l: api.len,
			e: enc,
			i:id 
		};

		instance[api.name] = this._apiFn(cfg);
		instance[api.name]._id_ = id;
		// Object.freeze(instance[api.name]);
	}

	/**
	 * Generic function used to attach for generated API
	 *
	 * @param {Array} params List of arguments from caller
	 */
	_apiFn(params) {

		let me = this;
		let prop = params;

		function fn() {

			let args, req, promise = null;

			args = Array.prototype.slice.call(arguments);

			req = {
				"namespace": prop.n,
				"action": prop.c,
				"method": prop.m,
				"id": prop.i,
				"e": prop.e,
				"data": args
			};

			promise = new Promise((resolve, reject) => {
				me.emit('call', req, (err, obj) => {
					me._onResponse(err, obj, prop, resolve, reject);
				});
			});

			return promise;
		}

		return fn;
	}

	/**
	 * Process remote response
	 */
	_onResponse(err, obj, prop, response, reject) {

		if (err) {
			reject(err);
			return;
		}

		let sts = (prop.c === obj.action) &&
			(prop.m === obj.method) &&
			obj.result &&
			obj.result.success;

		if (sts) {
			response(obj.result);
		} else {
			reject(obj.result || obj);
		}

	};

	/**
	 * Static instance builder
	 */
	static async build(cfg) {
		let generator = new Generator();
		generator.build(cfg);
		return generator;
	}

}

module.exports = Generator;
