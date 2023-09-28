/*
 * Copyright (C) 2015, 2023 Green Screens Ltd.
 */
const QuarkEngine = require('./lib/Engine');

/*
const channelWeb = "http://localhost:8080/io.greenscreens.quark/api";
const channelWS = "ws://localhost:8080/io.greenscreens.quark/socket";
*/

const channelWeb = "http://localhost:8080/demo/api";
const channelWS = "ws://localhost:8080/demo/socket";

/*
 * Test calls to Quark Engine through HTTP/HTTPS
 */
async function test1() {

	// in real life, initialize only once per service api through whole application
	const Engine = await QuarkEngine.init({api:channelWeb, service: channelWeb});

	// get generated API as local scoped variable
	// or attach it to global scope for all other modules
	// global.io = Engine.api.io
	const { io } = Engine.api;

	console.log(io);

	let o = await io.greenscreens.Demo.hello('John Doe');
	console.log(o);

	o = await io.greenscreens.Demo.listUsers();
	console.log(o);

	// if used globally, stop not needed
	Engine.stop();
}

/*
 * Test calls to Quark Engine through WebSocket
 */
async function test2() {

	// in real life, initialize only once per service api through whole application
	const Engine = await QuarkEngine.init({api: channelWeb, service: channelWS});

	// get genrated API as local scoped variable
	// or attach it to global scope for all other modules
	// global.io = Engine.api.io
	const { io } = Engine.api;

	console.log(io);

	let o = await io.greenscreens.Demo.hello('John Doe');
	console.log(o);

	o = await io.greenscreens.Demo.listUsers();
	console.log(o);

	// if used globally, stop not needed
	Engine.stop();
}

async function test() {

	await test1();
	await test2();
}

test().then(() => {});
