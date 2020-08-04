/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */
const cfg = {"api":[{"namespace":"io.greenscreens","action":"IFS","paths":["/socket","/api"],"methods":[{"name":"remove","len":1},{"name":"copy","len":2},{"name":"rename","len":2},{"name":"move","len":2},{"name":"list","len":1}]},{"namespace":"io.greenscreens","action":"AS400","paths":["/socket","/api"],"methods":[{"name":"login","len":3},{"name":"logout","len":0}]},{"namespace":"io.greenscreens","action":"Demo","paths":["/socket","/api"],"methods":[{"name":"saveUser","len":2},{"name":"listUsers","len":0},{"name":"helloUnsafe","len":1,"encrypt":false},{"name":"hello","len":1}]}],"keyEnc":"MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaq4WZGfO+oeva7H+sn6OgAsckdaxDONFZprrgDZYXaReNVQPg/9QHs6qyyUcHwFw8BMDN513Oi8b/+bZXhL1GMokhKPMVAv9x90is3z4wXd23GPD/KTlUwy/z+j16WN060im74NivzfUMN049zUGF+xsWr1qgb5p8vvCzwBu8jwIDAQAB","keyVer":"MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERN5wpSMb6kUplYaKQ/e99vkRZHX0tOX7WawOr5gvsX9fH6lBb5Bqq8V7emFQELnHddHEdZdOvrfgUdl3eUioKN0IA+Qu+A3oPrRO2eT4MSbWaImd9DldQZRPOjrqTLxc","signature":"rx0KicXnFYP6cBAAWYXJktuesTNXbYCnmCF3vZQ1eaYeCBSs8GuQScLGhGWYrcUMb4pcauiKn4q8OPRo4bzMImhwwF0Oecaa0hS7zKLxHP1yi7qGLYsxgiov42hvTVtt","challenge":"1596529258795"}

Generator = require('./lib/generator');
Security = require('./lib/security');

// Test importing server certificate
Security.init(cfg);

// Test generating remote API
let o = Generator.build(cfg);
console.log(o);
console.log(Generator.api);
