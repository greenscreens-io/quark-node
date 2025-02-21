/*
 * Copyright (C) 2015, 2023 Green Screens Ltd.
 */

class QuarkBuffer {

    static #encoder = new TextEncoder();
    static #decoder = new TextDecoder();

    /**
     * Detect data and convert to Uint8Array
     * 
     * @param {variant}
     * @returns {variant}
     */
    static validateData(src) {
        let data = null;
        try {
            if (src instanceof Array) {
                data = new Uint8Array(src);
            } else if (src instanceof ArrayBuffer) {
                data = new Uint8Array(src);
            } else if (src instanceof Uint8Array) {
                data = src;
            } else if (src instanceof String || typeof src === 'string') {
                data = QuarkBuffer.fromText(src);
            } else if (src.toArrayBuffer) {
                data = new Uint8Array(src.toArrayBuffer());
            } else {
                throw new Error("Invalid input, must be String or ArrayBuffer or Uint8Array");
            }
        } catch (error) {
            console.error(`Data validation failed: ${error.message}`);
            throw error;
        }
        return data;
    }

    /**
     * Verify if data is string
     * @param {*} data 
     * @returns 
     */
    static isString(data) {
        return typeof data === 'string';
    }

    /**
     * Check if string is hex string
     * @param {*} data 
     * @returns 
     */
    static isHexString(data) {
        return QuarkBuffer.isString(data) ? (/^[0-9A-Fa-f]+$/g).test(data) : false;
    }

    static toBuffer(data, b64 = false) {
        const me = QuarkBuffer;
        if (me.isString(data)) {
            if (b64) {
                data = me.fromBase64(data);
            } else if (me.isHexString(data)) {
                data = me.fromHex(data);
            } else {
                data = me.fromText(data);
            }
        }
        return me.validateData(data);
    }

    static toText(value) {
        return QuarkBuffer.#decoder.decode(value);
    }

    static fromText(value) {
        return QuarkBuffer.#encoder.encode(value);
    }

	static isText(val) {
		return typeof val === 'string';
	}

    static fromHex(value) {

        const arry = [];

        for (let i = 0; i < value.length; i += 2) {
            arry.push(parseInt("0x" + value.substr(i, 2), 16));
        }

        return new Uint8Array(arry);
    }

    static toHex(buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
    }

    static fromBase64(value) {

        const strbin = atob(value);
        const buffer = new ArrayBuffer(strbin.length);
        const bufView = new Uint8Array(buffer);

        for (let i = 0, strLen = strbin.length; i < strLen; i++) {
            bufView[i] = strbin.charCodeAt(i);
        }

        return bufView;
    }

    static toBase64(buffer) {
        buffer = QuarkBuffer.toBuffer(buffer);
        return btoa(buffer.reduce((data, val) => {
            return data + String.fromCharCode(val);
        }, ''));
    }

}

module.exports = QuarkBuffer;
