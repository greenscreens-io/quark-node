/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

/**
 * Queue to handle requests
 */
class Queue {

	up = 0;
 	down = 0;
	tid = 0;
	list = [];

	/**
	 * Update counters and queue to link resposnes to requests
	 * @param {Object} req
	 *      Request data
	 */
	updateRequest(req, callback) {
		let me = this;
		me.tid++;
		me.up++;
		req.tid = me.tid.toString();
		me.list[req.tid] = callback;
	}

	/**
	 * Reset queue to remove old stalled elements
	 */
	clear() {
		let me = this;
		if (me.up > 50 && me.down >= me.up) {
			me.up = 0;
			me.down = 0;
		}
	}

	/**
	 * Process array of response records
	 *
	 * @param {Object} obj
	 */
	process(obj) {
		let me = this;
		if (Array.isArray(obj)) {
			obj.forEach(o => me.execute(o));
		} else {
			me.execute(obj);
		}
	}


	/**
	 * Process single response record
	 *
	 * @param {Object} obj
	 */
	execute(obj) {

		let me = this;

		me.down++;

		if (typeof me.list[obj.tid] === 'function') {
			try {
				me.list[obj.tid](null, obj);
			} finally {
				me.list[obj.tid] = null;
			}
		}

		me.clear();

	};
}

module.exports = Queue;
