const TimeMinder = require("./time-minder");

class CurlTimer {
	
	constructor(options) {
		this._options = options;
		this.teams = [0, 1];
		this.thinkingTimers = [
			new TimeMinder(this.options.thinkingTime),
			new TimeMinder(this.options.thinkingTime)
		];
		this.timeoutsRemaining = [
			this.options.numTimeouts,
			this.options.numTimeouts
		];
		this.timeoutTimers = [
			new TimeMinder(this.options.timeoutTime),
			new TimeMinder(this.options.timeoutTime)
		];
		this.currentTimerStartedAt = null;
		this.phase = "pregame";
	}

	beforeEnd() {
		this.phase = "beforeEnd";
		this.interEndTimer = new TimeMinder(this.options.betweenEndTime, () => {
			this.startEnd();
		});
		this.interEndTimer.start();
	}

	startEnd() {
		this.phase = "inEnd";
		this.end++;
		this.currentRock = 0;
	}

	startGame() {
		this.end = 0;
		this.phase = "betweenEnds";
	}

	startTime(team) {
		if (this.phase === "inEnd") {
			this.currentRock++;
			this.thinkingTimers[team].start();
		}
	}

	stopTime(team) {
		this.thinkingTimers[team].stop();
	}

	startTimeout(team) {
		const whichTeamsThinking = this.teams.filter(t => this.thinkingTimers[t].isRunning());

		if (whichTeamsThinking.length > 1) {
			throw new Error("More than one team thinking?");
		}

		//  to begin a timeout, one of the clocks must be running if we're not already in a timeout
		if (whichTeamsThinking.length > 1 || this.timeoutTimers.some(t => t.isRunning())) {

			// Stop all thinking time and currently running timeouts
			[...this.thinkingTimers, ...this.timeoutTimers].forEach(t => t.stop());

			this.timeoutTimers[team] = new TimeMinder(this.options.timeoutTime, () => {
				// When the timeout ends, decrement the # of remaining timeouts
				this.timeoutsRemaining[team]--;
			});

			this.timeoutTimers[team].start();
		}
	}

	// pause the currently running timeout
	pauseTimeout() {
		const runningTimeouts = this.timeoutTimers.filter(t => t.isRunning());

		if (runningTimeouts.length === 1) {
			runningTimeouts[0].stop();
		}
	}

	setState(state) {
		this.end = state.end;
		this.phase = state.phase;

	}

	getState() {
		return {
			end: this.end,
			phase: this.phase,
			teamARemaining: this.teamATimer.getTimeRemaining(),
			teamBRemaining: this.teamBTimer.getTimeRemaining(),
		};
	}
}