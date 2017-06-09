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
			console.log("test");
			this._invoke();
			if (this.recurring) {
				this._start();
			}
		}, this.ms - this.elapsed);
		this.clear = this.ct.bind(this, handle);
	}
}

module.exports = ManagedTimer;
