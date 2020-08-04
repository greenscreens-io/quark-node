/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
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

/**
 * Build Js Api from JSON definition retrieved from API service
 */
async function init(cfg) {

	cfg = cfg || {};

	if (!cfg.api) {
		throw new Error('API Url not defined!');
	}

	// remove all existing listeners
	Generator.removeAllListeners('call');

	// close socket if used
	if (SocketChannel) {
		SocketChannel.kill();
	}

	let isWSChannel = cfg.api === cfg.service && cfg.api.indexOf('ws') == 0;

	if (isWSChannel) {
		return await fromWebSocketChannel(cfg);
	}

	await fromWebChannel(cfg);
	let sts = await initService(cfg);
	if (sts) return true;

	throw new Error(ERROR_MESSAGE);

}

/**
 * Initialize API from WebSocket channel
 *
 * @param {Object} cfg
 * 		  Init configuration object with api and service url's
 */
async function initService(cfg) {

	// if remote API defined
	if (!cfg.service) return false;

	// register HTTP/S channel for API
	if (cfg.service.indexOf('http') === 0) {
		await WebChannel.init(cfg.service);
		return true;
	}

	// register WebSocket channel for API
	if (cfg.service.indexOf('ws') === 0) {
		await SocketChannel.init(cfg.service);
		return true;
	}

	return false;

}

/**
 * Initialize API from WebSocket channel
 *
 * @param {Object} cfg
 * 		  Init configuration object with api and service url's
 */
function fromWebSocketChannel(cfg) {

	return new Promise((resolve, reject) => {

		var challenge = Date.now();

		Generator.once('api', async (data) => {

			data.challenge = challenge;
			try {
				await registerAPI(data);
				resolve(true);
			} catch (e) {
				reject(e);
			}

		});

		SocketChannel.init(cfg.service + '?q=' + challenge);

		return null;
	});

}

/**
 * Initialize API from HTTP/s channel
 *
 * @param {Object} cfg
 * 		  Init configuration object with api and service url's
 */
async function fromWebChannel(cfg) {
	let data = await getAPI(cfg.api);
	await registerAPI(data);
}

/**
 * Register callers from API definition
 *
 * @param {Object} data
 * 		  API definitions receive from server
 */
async function registerAPI(data) {

	// initialize encryption if provided
	if (data.signature) {
		if (!Security.isActive()) {
			await Security.init(data);
		}
	}

	Generator.build(data.api);
}

/**
 * Get API definition through HTTP/s channel
 *
 * @param {String} url
 * 		  URL Address for API service definitions
 */
async function getAPI(url) {

	let service = url;
	let id = Date.now();

	let resp = await fetch(service, {
		method: 'get',
		headers: {
			'x-time': id
		}
	});
	let data = await resp.json();

	// update local challenge for signature verificator
	data.challenge = id.toString();

	return data;

}

/**
 * Exported object with external methods
 */
const Engine = {

	init: function(cfg) {
		return init(cfg);
	},

	api: function(cfg) {
		return Generator.api;
	},

	stop: function() {
		return SocketChannel.kill();
	}
};

Object.freeze(Engine);

module.exports = Engine;
