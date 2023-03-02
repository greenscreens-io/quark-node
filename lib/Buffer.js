/*
 * Copyright (C) 2015, 2023 Green Screens Ltd.
 */

class EngineBuffer {

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
        if (src instanceof Array) {
            data = new Uint8Array(src);
        } else if (src instanceof ArrayBuffer) {
            data = new Uint8Array(src);
        } else if (src instanceof Uint8Array) {
            data = src;
        } else if (src instanceof String || typeof src === 'string') {
            data = EngineBuffer.fromText(src);
        } else if (src.toArrayBuffer) {
            data = new Uint8Array(src.toArrayBuffer());
        } else {
            throw "Invalid input, must be String or ArrayBuffer or Uint8Array";
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
        return EngineBuffer.isString(data) ? (/^[0-9A-Fa-f]+$/g).test(data) : false;
    }
    
    static toBuffer(data, b64 = false) {
        const me = EngineBuffer;
        if (me.isString(data)) {
            if (b64) {
                data = me.fromBase64(data);
            } else  if (me.isHexString(data)) {
                data = me.fromHex(data);
            } else {
                data = me.fromText(data);
            }   
        }  
        return me.validateData(data);
    }
    
	static fromText(value) {
		return EngineBuffer.#encoder.encode(value);
	}
	
	static toText(value) {
		return EngineBuffer.#decoder.decode(value);
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
		return globalThis.btoa(new Uint8Array(buffer));
	}

}

module.exports = EngineBuffer;
