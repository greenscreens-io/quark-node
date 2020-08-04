/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */
const Engine = require('./lib/engine');

const api = "http://localhost:8080/io.greenscreens.quark/api";
const svc = "ws://localhost:8080/io.greenscreens.quark/socket";

/*
 * Test calls to Quark Engine through HTTP/HTTPS
 */
async function test1() {

	await Engine.init({api:api, service: api});
	const { io } = Engine.api();

	console.log(io);

	let o = await io.greenscreens.Demo.hello('John Doe');
	console.log(o);

	o = await io.greenscreens.Demo.listUsers();
	console.log(o);
}

/*
 * Test calls to Quark Engine through WebSocket
 */
async function test2() {

	await Engine.init({api: svc, service: svc});
	const { io } = Engine.api();

	console.log(io);

	let o = await io.greenscreens.Demo.hello('John Doe');
	console.log(o);

	o = await io.greenscreens.Demo.listUsers();
	console.log(o);

	Engine.stop();
}

test1();
test2();
