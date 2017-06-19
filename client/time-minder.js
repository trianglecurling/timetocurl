class ManagedTimer {
	constructor(callback, ms, recurring, st, ct, si, ci) {
		this.callback = callback;
		this.recurring = recurring;
		this.ms = ms;
		this.si = si;
		this.ci = ci;
		this.st = st;
		this.ct = ct;
		this.elapsed = 0;
	}

	start() {
		if (this.firstStarted) {
			throw new Error("Timer already started.");
		}

		this.firstStarted = Date.now();
		this._start();
	}

	reset() {
		this.cancel();
		this.firstStarted = null;
	}

	_start() {
		const setMethod = this.recurring ? this.si : this.st;
		this.clearMethod = this.recurring ? this.ci : this.ct;

		this.startedAt = Date.now();
		const handle = setMethod(() => {
			this._invoke();
		}, this.ms);
		this.clear = this.clearMethod.bind(this, handle);
	}

	_invoke() {
		this.callback();
		this.startedAt = Date.now();
		this.elapsed = 0;
	}

	setTimeRemaining(ms) {
		this.pause();
		this.elapsed = this.ms - ms;
		this.unpause();
	}

	cancel() {
		if (this.clear) {
			this.clear();
		}
	}

	pause() {
		this.elapsed += Date.now() - this.startedAt;
		this.clear();
	}

	unpause() {
		this.startedAt = Date.now();
		const handle = this.st(() => {
			this._invoke();
			if (this.recurring) {
				this._start();
			}
		}, this.ms - this.elapsed);
		this.clear = this.ct.bind(this, handle);
	}
}

class Stopwatch {
	constructor(onDispose) {
		this.splits = [];
		this.intervals = [];
		this.startupTasks = [];
		this.started = false;
		this.disposed = false;
		this.tickTimers = [];
		this.onDispose = onDispose;
	}

	dispose() {
		for (const timer of this.tickTimers) {
			timer.timer.cancel();
		}
		this.disposed = true;
		if (typeof this.onDispose === "function") {
			this.onDispose(this.intervals);
		}
	}

	start() {
		if (this.isRunning()) {
			return;
		}
		this.started = true;
		this.unpause();
		for (const task of this.startupTasks) {
			task.call(this);
		}
	}

	unpause() {
		this.intervals.push({
			start: new Date(),
			end: null,
		});

		// Unpause all tick timers that were paused
		for (const timer of this.tickTimers) {
			if (!timer.runWhenPaused) {
				timer.timer.unpause();
			}
		}
	}

	/**
	 * 
	 * @param {*} ms 
	 * @param {*} callback 
	 * @param {*} runWhenPaused 
	 * @param {*} invokeImmediately - whether or not paused
	 */
	every(ms, callback, runWhenPaused = false, invokeImmediately = true) {
		if (!this.started) {
			this.startupTasks.push(this.every.bind(this, ms, callback, runWhenPaused));
		} else {
			const timer = new ManagedTimer(
				callback,
				ms,
				true, // recurring
				window.setTimeout.bind(window),
				window.clearTimeout.bind(window),
				window.setInterval.bind(window),
				window.clearInterval.bind(window),
			);

			if (runWhenPaused || this.isRunning()) {
				timer.start();
			}
			this.tickTimers.push({ timer, runWhenPaused });
		}

		if (invokeImmediately) {
			callback.call(null, true);
		}
	}

	split() {
		this.splits.push(this.elapsedTime());
	}

	getSplits() {
		return this.splits;
	}

	elapsedTime() {
		return this.intervals
			.map(i => {
				return ((i.end && i.end.getTime()) || Date.now()) - i.start.getTime();
			})
			.reduce((prev, current) => current + prev, 0);
	}

	getTotalTimeSinceStart() {
		return Date.now() - this.intervals[0].start.getTime();
	}

	pause() {
		if (!this.isRunning()) {
			return;
		}

		// People running around with chainsaws is not Leah's thing.
		this.intervals[this.intervals.length - 1].end = new Date();

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

class TimeMinder {
	constructor(totalTime, onComplete, onDispose) {
		this.totalTime = totalTime;
		this.intervals = [];
		this.onComplete = onComplete;
		this.startupTasks = [];
		this.started = false;
		this.disposed = false;
		this.tickTimers = [];
		this.onDispose = onDispose;
	}

	dispose() {
		clearTimeout(this.timeout);
		for (const timer of this.tickTimers) {
			timer.timer.cancel();
		}
		if (typeof this.onDispose === "function") {
			this.onDispose.call(this.intervals);
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
			end: null,
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
			if (typeof this.onDispose === "function") {
				this.onDispose(this.intervals);
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

	every(ms, callback, runWhenPaused = false, invokeImmediately = true) {
		if (!this.started) {
			this.startupTasks.push(this.every.bind(this, ms, callback, runWhenPaused));
		} else {
			const timer = new ManagedTimer(
				callback,
				ms,
				true, // recurring
				window.setTimeout.bind(window),
				window.clearTimeout.bind(window),
				window.setInterval.bind(window),
				window.clearInterval.bind(window),
			);

			timer.start();
			this.tickTimers.push({ timer, runWhenPaused });
		}
		if (invokeImmediately) {
			callback.call(null, true);
		}
	}

	elapsedTime(intervals) {
		return (intervals || this.intervals)
			.map(i => {
				if (typeof i.adjustment !== "undefined") {
					return i.adjustment;
				}
				return ((i.end && i.end.getTime()) || Date.now()) - i.start.getTime();
			})
			.reduce((prev, current) => current + prev, 0);
	}

	getTimeRemaining() {
		return Math.max(0, this.totalTime - this.elapsedTime());
	}

	getTotalTimeSinceStart() {
		return Date.now() - this.intervals[0].start.getTime();
	}

	getTotalSegmentTime(segmentName) {
		return this.getTimeSpent(this.intervals.filter(i => i.segmentName === segmentName));
	}

	setTimeRemaining(ms) {
		const wasRunning = this.isRunning();
		if (wasRunning) {
			this.pause();
		}
		this.intervals.push({ adjustment: this.getTimeRemaining() - ms });
		if (wasRunning) {
			this.unpause();
		}
	}

	pause() {
		if (!this.isRunning()) {
			return;
		}
		clearTimeout(this.timeout);

		// People running around with chainsaws is not Leah's thing.
		this.intervals[this.intervals.length - 1].end = new Date();

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
