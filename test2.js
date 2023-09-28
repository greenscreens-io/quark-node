/*
 * Copyright (C) 2015, 2023 Green Screens Ltd.
 */
const cfg = {"api": [{"namespace": "io.greenscreens","action": "Demo", "paths": ["/socket", "/api"],"methods": [{"name": "hello", "len": 1}]},],
    "keyEnc": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEykeftTffViKKH2BiCnt8pQdbtt1omlv5ap+Lr1UuQdAFi++npYCFt97MJMpCMg+OOw7xF2f1Eol4I+Q69HtS5Q==",
    "keyVer": "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEsNlZHNMyZSC+OQ0KXX9rr0S2LPghYCBOQUB93v2PcEkjk26miwQKu0WCvoVijyTvnzjcRz5uCXSDALZl0iful2pnljcWS3+4dBhQ9TfvVFJaVD2M/EBmR2l5tHFqsEQs",
    "signature": "FYV9yFKxiYxtD5EvzsEnJquqtF/hbcz/XeBqf1NpUgYSIj+PBRBLtc+4Br98e283bn0MnzdRTGA5YigfeK69WKu0GP52gm1Rq6LIK4U7Ppja7sCu26it/9ByLDOtqp0n"
};

Generator = require('./lib/Generator');
Security = require('./lib/Security');

Generator = new Generator();
Security = new Security();

// Test generating remote API
let o = Generator.build(cfg);
console.log(o);
console.log(Generator.api);

console.log(io.greenscreens);

// Test importing server certificate
Security.init(cfg);
