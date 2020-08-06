
# [Quark Engine for NodeJS](https://www.greenscreens.io/quark).

Visit project web page [here](https://www.greenscreens.io/quark).

This is client library for NodeJS enabling communication with Green Screens Quark Engine for Java.

Use it to call remote Java services based on Quark Engine methodology.

Calls are the same as for browser API's, engine will dynamically generate API calls to be used across NodeJS app.

Upon initialization with

```
const QuarkEngine = require('./lib/engine');

const channelWeb = "http://localhost:8080/io.greenscreens.quark/api";
const channelWS = "ws://localhost:8080/io.greenscreens.quark/socket";

let Engine = new QuarkEngine({api:channelWeb, service: channelWS});
await Engine.init();
```

Use the following to get generated API, or attach it to the global object.
**io** is first part of namespace group defined in Java server side controllers.
```
const { io } = Engine.api();
global.io = io;
```

Multi-service is supported also. Simply initialize another Engine instance.

### Install

1. Download or clone repository
2. execute **npm install** to install dependencies
3. Start Java demo web app  from quark-engine repo
4. execute node test.js


**NOTE:** WebCrypto wrapper for NodeJs copied from link below as module is not in npm. Lib is used to wrap NodeJS crypto API into WebCrypto API for compatibility purposes.
https://github.com/nodejs/webcrypto

&copy; Green Screens Ltd. 2016 - 2020
