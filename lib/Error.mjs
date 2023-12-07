/*
 * Copyright (C) 2015, 2024 Green Screens Ltd.
 */

/**
 * Custom Error to handle reponse structure
 */
class QuarkError extends Error {

    constructor(msg, data) {
       super(msg);
       this.data = data;
    }
    
    static create(data) {
		let msg = data.message || data.msg || data.error || '';
		if (data.code && msg.indexOf(data.code) < 0) msg = `${data.code} : ${msg}`;
		return new QuarkError(msg, data);
	}
}

module.exports = QuarkError;
