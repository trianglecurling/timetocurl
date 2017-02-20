const { setTimeout, clearTimeout } = require("timers");
const { inspect } = require("util");

class TimeMinder {
	constructor(totalTime, onComplete) {
		this.totalTime = totalTime;
		this.intervals = [];
		this.intervalHandles = [];
		this.onComplete = onComplete;
	}

	dispose() {
		clearTimeout(this.timeout);
		this.intervalHandles.forEach(h => clearInterval(h));
	}

	start() {
		if (this.isRunning() || this.getTimeRemaining() <= 0) {
			return;
		}
		this.intervals.push({
			start: new Date(),
			end: null
		});
		this.timeout = setTimeout(() => {
			this.intervals[this.intervals.length - 1].end = new Date();
			if (this.onComplete) {
				this.onComplete(this.intervals);
			}
		}, this.getTimeRemaining());
	}

	every(ms, callback, runWhenPaused = false) {		
		if (runWhenPaused) {
			const clear = (handle) => {
				clearInterval(handle);
			};
			const handle = setInterval(() => {
				callback(this.getTimeRemaining(), clearInterval.bind(null, handle));
			}, ms);
			this.intervalHandles.push(handle);
		} else {
			
		}
	}

	getTimeSpent() {
		return this.intervals.map(i => ((i.end && i.end.getTime()) || Date.now()) - i.start.getTime()).reduce((prev, current) => current + prev, 0);
	}

	getTimeRemaining() {
		return this.totalTime - this.getTimeSpent();
	}

	getTotalTimeSinceStart() {
		return Date.now() - this.intervals[0].start.getTime();
	}

	pause() {
		if (!this.isRunning()) {
			return;
		}
		clearTimeout(this.timeout);

		// People running around with chainsaws is not Leah's thing.
		this.intervals[this.intervals.length - 1].end = new Date();
	}

	isRunning() {
		return this.intervals.length && this.intervals[this.intervals.length - 1].end === null;
	}

}

module.exports = TimeMinder;

/****** TEST CASES *******/

if (require.main === module) {
	const expect = require("expect");
	const testStartTime = Date.now();
	const marginOfError = 50;

	const oneSecondTimer = new TimeMinder(1000, (intervals) => {
		const doneTime = Date.now();
		setTimeout(() => {
			expect(oneSecondTimer.getTotalTimeSinceStart()).toBeGreaterThanOrEqualTo(2000 - marginOfError).toBeLessThan(2000 + marginOfError);
		}, 1000);
		console.log("Finished after " + (doneTime - testStartTime) + " ms.");
	});
	oneSecondTimer.start();

	const fiveSecondTimer = new TimeMinder(5000, (intervals) => {
		const doneTime = Date.now();
		expect(intervals.length).toEqual(1);
		expect(intervals[0].start).toExist();
		expect(intervals[0].end).toExist();
		expect(doneTime - testStartTime).toBeGreaterThanOrEqualTo(5000 - marginOfError).toBeLessThan(5000 + marginOfError);
		console.log("Finished after " + (doneTime - testStartTime) + " ms.");
	});
	fiveSecondTimer.start();

	const tenSecondTimer = new TimeMinder(10000, (intervals) => {
		const doneTime = Date.now();
		expect(intervals.length).toEqual(3);
		expect(doneTime - testStartTime).toBeGreaterThanOrEqualTo(11000 - marginOfError).toBeLessThan(11000 + marginOfError);
		console.log("Finished after " + (doneTime - testStartTime) + " ms.");
	});
	tenSecondTimer.start();

	setTimeout(() => {
		tenSecondTimer.pause();
	}, 1000);
	setTimeout(() => {
		expect(tenSecondTimer.getTimeRemaining()).toBeGreaterThanOrEqualTo(9000 - marginOfError).toBeLessThan(9000 + marginOfError);
		tenSecondTimer.start();
	}, 1500);
	setTimeout(() => {
		tenSecondTimer.pause();
	}, 4000);
	setTimeout(() => {
		tenSecondTimer.start();
	}, 4500);
}