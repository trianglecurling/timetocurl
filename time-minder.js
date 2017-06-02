const { setTimeout, clearTimeout, setInterval, clearInterval } = require("timers");
const { ManagedTimer } = require("./managed-timer");
const { inspect } = require("util");

class TimeMinder {
	constructor(totalTime, onComplete) {
		this.totalTime = totalTime;
		this.intervals = [];
		this.onComplete = onComplete;
		this.startupTasks = [];
		this.started = false;
		this.disposed = false;
		this.tickTimers = [];
	}

	dispose() {
		clearTimeout(this.timeout);
		for (const timer of this.tickTimers) {
			timer.timer.cancel();
		}
		this.disposed = true;
	}

	start(segmentName) {
		if (this.isRunning() || this.getTimeRemaining() <= 0) {
			return;
		}
		this.started = true;
		this.unpause(segmentName);
		for (const task of this.startupTasks) {
			task.call(this);
		}
	}

	unpause(segmentName) {
		if (!this.started) {
			this.start(segmentName);
			return;
		}
		const newInterval = {
			start: new Date(),
			end: null
		};
		if (segmentName) {
			newInterval.segmentName = segmentName;
		}
		this.intervals.push(newInterval);
		this.timeout = setTimeout(() => {
			this.intervals[this.intervals.length - 1].end = new Date();
			if (this.onComplete) {
				this.onComplete(this.intervals);
			}
			for (const timer of this.tickTimers) {
				timer.timer.cancel();
			}
		}, this.getTimeRemaining());
		
		// Unpause all tick timers that were paused
		for (const timer of this.tickTimers) {
			if (!timer.runWhenPaused) {
				timer.timer.unpause();
			}
		}
	}

	every(ms, callback, runWhenPaused = false) {
		if (!this.started) {
			this.startupTasks.push(this.every.bind(this, ms, callback, runWhenPaused));
			return;
		}

		const timer = new ManagedTimer(callback, ms, true, setTimeout, clearTimeout, setInterval, clearInterval);
		timer.start();
		this.tickTimers.push({timer, runWhenPaused});
	}

	getTimeSpent(intervals) {
		return (intervals || this.intervals)
			.map(i => ((i.end && i.end.getTime()) || Date.now()) - i.start.getTime())
			.reduce((prev, current) => current + prev, 0);
	}

	getTimeRemaining() {
		return this.totalTime - this.getTimeSpent();
	}

	getTotalTimeSinceStart() {
		return Date.now() - this.intervals[0].start.getTime();
	}

	setTimeRemaining(ms) {
		this.pause();
		this.intervals.push({adjustment: ms - this.getTimeRemaining()});
		this.unpause();
	}

	getTotalSegmentTime(segmentName) {
		return this.getTimeSpent(this.intervals.filter(i => i.segmentName === segmentName));
	}

	pause() {
		if (!this.isRunning()) {
			return;
		}
		clearTimeout(this.timeout);

		const interval = this.intervals[this.intervals.length - 1];

		// People running around with chainsaws is not Leah's thing.
		interval.end = new Date();

		// Pause all tick timers that don't run when paused.
		for (const timer of this.tickTimers) {
			if (!timer.runWhenPaused) {
				timer.timer.pause();
			}
		}
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