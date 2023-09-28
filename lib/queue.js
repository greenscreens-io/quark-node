/*
 * Copyright (C) 2015, 2022 Green Screens Ltd.
 */

/**
 * Queue to handle requests
 */
class Queue extends Map {

	#up = 0;
	#down = 0;
	#tid = 0;

	/**
	 * Update counters and queue to link resposnes to requests
	 * @param {Object} req
	 *      Request data
	 */
	updateRequest(req) {
		const me = this;
		me.#tid++;
		me.#up++;
		req.tid = me.#tid.toString();
		me.set(req.tid, req);
	}

	/**
	 * Reset queue to remove old stalled elements
	 */
	reset() {
		const me = this;
		if (me.#up > 50 && me.#down >= me.#up) {
			me.#up = 0;
			me.#down = 0;
			me.clear();
		}
	}

	/**
	 * Process array of response records
	 *
	 * @param {Object} obj
	 */
	process(obj) {

		const me = this;
		const unknown = [];

		if (Array.isArray(obj)) {
			obj.forEach((o) => {
				const res = me.execute(o);
				if (res) unkown.push(res);
			});
		} else {
			const o = me.execute(obj);
			if (o) unknown.push(o);
		}

		return unknown;
	}


	/**
	 * Process single response record
	 *
	 * @param {Object} obj
	 */
	execute(obj) {

		const me = this;
		const tid = obj.tid;
		let unknown = null;

		me.#down++;

		if (me.has(tid)) {
			const req = me.get(tid);
			try {
				req.finish(obj);
			} catch (e) {
				console.log(e);
				req.finish(e);
			} finally {
				me.delete(tid);
			}
		} else {
			unknown = obj;
		}

		me.reset();

		return unknown;
	}
}

module.exports = Queue;