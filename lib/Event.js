/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

/**
 * A module loading Event class
 * @module Events
 */

/**
 * Extends native event by adding helper functions
 */
class QuarkEvent extends EventTarget {

    #listeners = new Set();

    #list(type = '', listener) {
        const me = this;
        const list = Array.from(me.#listeners);
        return QuarkEvent.#isFunction(listener) ?
            list.filter(o => o.type === type && o.listener === listener)
            :
            list.filter(o => o.type === type);
    }

    addEventListener(type, listener, opt) {
        const me = this;
        if (!QuarkEvent.#isFunction(listener)) return false;
        me.#listeners.add({ type: type, listener: listener });
        return super.addEventListener(type, listener, opt);
    }

    removeEventListener(type, listener) {
        const me = this;
        const list = me.#list(type, listener);
        list.forEach(o => super.removeEventListener(o.type, o.listener))
        list.forEach(o => me.#listeners.delete(o));
    }

    /**
     * Remove all listeners
     */
    unbind() {
        const me = this;
        Array.from(me.#listeners).forEach(o => {
            super.removeEventListener(o.type, o.listener);
        });
        me.#listeners.clear();
    }

    /**
     * Listen for events
     * 
     * @param {string} type Event name to be listened
     * @param {Function} listener  Callback to be called on event trigger
     */
    on(type = '', listener) {
        return this.addEventListener(type, listener);
    }

    /**
     * Listen for events only once
     * 
     * @param {string} type Event name to be listened
     * @param {Function} listener  Callback to be called on event trigger
     */
    once(type, listener) {
        const me = this;
        let wrap = (e) => {
            listener(e);
            wrap = null;
        }
        wrap.type = type;
        wrap.listener = listener;
        return me.addEventListener(type, wrap, { once: true });
    }

    /**
     * Stop listening for events
     * 
     * @param {string} type Event name to be listened
     * @param {Function} listener  Callback to be called on event trigger
     */
    off(type = '', listener) {
        return this.removeEventListener(type, listener);
    }

    /**
     * Send event to listeners
     * 
     * @param {string} type Event name to be listened
     * @param {object} data  Data to send 
     */
    emit(type, data) {
        if (!type) return false;
        const evt = new CustomEvent(type, { detail: data });
        return this.dispatchEvent(evt);
    }

    send(type, data) { this.emit(type, data); }
    listen(type, listener) { this.on(type, listener); }
    unlisten(type, listener) { this.off(type, listener); }

    /**
     * Wait for an event 
     * @param {string} type Event name to be listened
     * @returns {Event}
     */
    wait(type = '') {
        if (!type) return Promise.reject(new Error('Event undefined!'));
        const me = this;
        return new Promise((resolve, reject) => {
            me.once(type, (e) => resolve(e));
        });
    }

    static #isFunction(fn) {
        return typeof fn === 'function';
    }

    /**
     * Generic prevent event bubling
     * 
     * @param {Event} e 
     */
    static prevent(e) {
        if (QuarkEvent.#isFunction(e, 'preventDefault')) e.preventDefault();
        if (QuarkEvent.#isFunction(e, 'stopPropagation')) e.stopPropagation();
    }

}

module.exports = QuarkEvent;
