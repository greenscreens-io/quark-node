/*
 * Copyright (C) 2015, 2020  Green Screens Ltd.
 */

/**
 * Queue to handle requests
 */
class Queue extends Map {

	up = 0;
 	down = 0;
	tid = 0;

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
		me.set(req.tid, callback);
	}

	/**
	 * Reset queue to remove old stalled elements
	 */
	reset() {
		let me = this;
		if (me.up > 50 && me.down >= me.up) {
			me.up = 0;
			me.down = 0;
			me.clear();
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

		if (me.has(obj.tid)) {
			try {
				me.get(obj.tid)(null, obj);
			} finally {
				me.delete(obj.tid);
			}
		}

		me.reset();

	};
}

module.exports = Queue;
