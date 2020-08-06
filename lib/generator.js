/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

const EventEmitter = require('events');

/**
 * Web and WebSocket API engine
 * Used to call remote services.
 * All Direct functions linked to defiend namespace
 */
class Generator extends EventEmitter {

	_model = {};

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
		this.removeAllListeners('call');
	}

	/**
	 * Build JS object with callable functions that maps to Java side methods
	 * Data is retrieved from API service
	 *
	 * @param {String} url || api object
	 * 		  URL Address for API service definitions
	 */
	build(o) {
		let data = o ? o.api || o : null;
		if (!data) return data;
		this._buildAPI(data);
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

		var action = null;

		tree = me._buildNamespace(api.namespace);

		if (!tree[api.action]) {
			tree[api.action] = {};
		}
		action = tree[api.action];

		api.methods.every(v => {
			me._buildMethod(api.namespace, api.action, action, v);
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

		var me = this;
		var tmp = null;

		namespace.split('.').every(v => {

			if (!tmp) {
				if (!me._model[v]) me._model[v] = {};
				tmp = me._model[v];
			} else {
				if (!tmp[v]) tmp[v] = {};
				// Object.freeze(tmp);
				tmp = tmp[v];
			}

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
	_buildMethod(namespace, action, instance, api) {

		let enc = api.encrypt === false ? false : true;
		let cfg = {
			n: namespace,
			c: action,
			m: api.name,
			l: api.len,
			e: enc
		};

		instance[api.name] = this._apiFn(cfg);
		// Object.freeze(instance[api.name]);
	}

	/**
	 * Generic function used to attach for generated API
	 *
	 * @param {Array} params List of arguments from caller
	 */
	_apiFn(params) {

		var me = this;
		var prop = params;

		function fn() {

			let args, req, promise = null;

			args = Array.prototype.slice.call(arguments);

			req = {
				"namespace": prop.n,
				"action": prop.c,
				"method": prop.m,
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

}

module.exports = Generator;
