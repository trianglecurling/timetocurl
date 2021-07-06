interface Interval {
	start?: Date;
	end?: Date | null;
	segmentName?: string;
	adjustment?: number;
}

export class ManagedTimer {
	private elapsed: number;
	private firstStarted!: number | null;
	private clearMethod: any;
	private startedAt!: number;
	private clear!: Function;

	constructor(
		private callback: Function,
		private ms: number,
		private recurring: boolean,
		private st: any,
		private ct: any,
		private si: any,
		private ci: any,
	) {
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

	setTimeRemaining(ms: number) {
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

export class Stopwatch {
	protected splits: number[];
	protected intervals: Interval[];
	protected startupTasks: Function[];
	protected started: boolean;
	protected tickTimers: { timer: ManagedTimer; runWhenPaused: boolean }[];
	protected disposed: boolean;

	constructor(protected onDispose?: Function) {
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
	every(ms: number, callback: Function, runWhenPaused = false, invokeImmediately = true) {
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
				return ((i.end && i.end.getTime()) || Date.now()) - i.start!.getTime();
			})
			.reduce((prev, current) => current + prev, 0);
	}

	getTotalTimeSinceStart() {
		return Date.now() - this.intervals[0].start!.getTime();
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

export class TimeMinder extends Stopwatch {
	private totalTime: number;
	private onComplete: Function | undefined;
	private timeout!: number;

	constructor(totalTime: number, onComplete?: Function, onDispose?: Function) {
		super(onDispose);
		this.totalTime = totalTime;
		this.onComplete = onComplete;
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

	start(segmentName?: string) {
		if (this.isRunning() || this.getTimeRemaining() <= 0) {
			return;
		}
		this.started = true;
		this.unpause(segmentName);
		for (const task of this.startupTasks) {
			task.call(this);
		}
	}

	unpause(segmentName?: string) {
		if (!this.started) {
			this.start(segmentName);
			return;
		}
		const newInterval = {
			start: new Date(),
			end: null,
		} as Interval;
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
		}, this.getTimeRemaining()) as any;

		// Unpause all tick timers that were paused
		for (const timer of this.tickTimers) {
			if (!timer.runWhenPaused) {
				timer.timer.unpause();
			}
		}
	}

	every(ms: number, callback: Function, runWhenPaused = false, invokeImmediately = true) {
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

	elapsedTime(intervals?: Interval[]) {
		return (intervals || this.intervals)
			.map(i => {
				if (typeof i.adjustment !== "undefined") {
					return i.adjustment;
				}
				return ((i.end && i.end.getTime()) || Date.now()) - i.start!.getTime();
			})
			.reduce((prev, current) => current + prev, 0);
	}

	getTimeRemaining() {
		return Math.max(0, this.totalTime - this.elapsedTime());
	}

	getTotalTimeSinceStart() {
		return Date.now() - this.intervals[0].start!.getTime();
	}

	getTotalSegmentTime(segmentName: string) {
		return this.elapsedTime(this.intervals.filter(i => i.segmentName === segmentName));
	}

	setTimeRemaining(ms: number) {
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
