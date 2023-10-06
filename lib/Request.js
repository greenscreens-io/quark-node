/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

/**
 * API engine asynchronous request
 */
class Request {

    #id = 0;
    #timeout = 0;
    #callback;

    constructor(timeout, callback) {
        const me = this;
        me.#callback = callback;
        me.#timeout = timeout;
        me.#init();
    }

    get(object, property) {
        const me = this;
        if (property === 'timeout') return me.timeout;
        if (property === 'finish') return me.callback.bind(me);
        return object[property];
    }

    callback(o) {
        const me = this;
        if (me.timeout) return;
        me.#clear();
        return me.#callback(o);
    }

    get timeout() {
        return this.#timeout === true;
    }

    #clear() {
        const me = this;
        if (me.#id === 0) return;
        clearTimeout(me.#id);
    }

    #init() {
        const me = this;
        if (me.#timeout === 0) return;
        me.#id = setTimeout(() => {
            me.#timeout = true;
            me.#callback(new Error('Call timeouted!'));
        }, me.#timeout);
    }

    static wrap(data, timeout, callback) {
        return new Proxy(data, new Request(timeout, callback));
    }
}

module.exports = Request;
