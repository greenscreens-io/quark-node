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
			obj.forEach( me.execute.bind(me) );
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
		let tid = obj.tid;

		me.down++;

		if (me.has(tid)) {
			try {
				me.get(tid)(null, obj);
			} finally {
				me.delete(tid);
			}
		}

		me.reset();

	};
}

module.exports = Queue;
