/*
 * Copyright (C) 2015, 2023 Green Screens Ltd.
 */

// initialized with blank challenge  localhost:8080/demo/api
const cfg = {"api": [{"namespace": "io.greenscreens","action": "Demo", "paths": ["/socket", "/api"],"methods": [{"name": "hello", "len": 1}]},],
"keyEnc": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3NrYHh1UK/B90HX6NaS68iSX6q//hiflZ9+at5MlW918512zd9Nn7beLRR+muA/BmAUKKMuPpLtLsT6CS65Isg==",
"keyVer": "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEjPFJIUxs50WxstYIy/M2OfXTJ1AEMU+Z6J6JNrVPoN23dmSA0Si7ml+8p6yh3NPhbK6kkcsIY2iky9hyfpQtCIEQ7AGeamYLLNhtLnfRSoDGvuUPBw+wp4oY3JMlTMH+",
"signature": "8hS1XOWWdJT4TTPW15ZYvp3bAI2GYKi1IpqOmghkmnVo0Yvlmnr8UKl2lfcuoKmlpfjvyXLyYWBPa+dwaIQ7zDmrteSX4Hyy7aGQ+jYpfCgZYKgDg//GE4hEzQZajAUF"
};

Generator = require('./lib/Generator');
Security = require('./lib/Security');

Generator = new Generator();

// Test generating remote API
let o = Generator.build(cfg);
console.log(o);
console.log(Generator.api);

console.log(io.greenscreens);

// Test importing server certificate
cfg.challenge = '';
Security.create(cfg);
