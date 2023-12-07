/*
 * Copyright (C) 2015, 2024 Green Screens Ltd.
 */

/**
 * Custom Error to handle reponse structure
 */
class QuarkError extends Error {
    constructor(data) {
       super(data.message || data.msg || data.error || data);
       this.data = data;
    }
}

module.exports = QuarkError;
