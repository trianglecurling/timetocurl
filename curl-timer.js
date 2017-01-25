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

class CurlingMachine {

	constructor(options) {
		this.options = options;
		this.timer = new CurlTimer(options);
		this.state = getInitialState();
	}

	getInitialState() {
		return {
			end: null,
			phase: "pregame",
			timeRemaining: [this.options.thinkingTime, this.options.thinkingTime],
			timeoutsRemaining: [this.options.numTimeouts, this.options.numTimeouts],
			timeoutTimeRemaining: [this.options.timeoutTime, this.options.timeoutTime],
			currentlyThinking: null,
			currentlyRunningTimeout: null,
			betweenEndTimeRemaining: this.options.betweenEndTime,
			currentlyRunningBetweenEnd: false
		}
	}

	getNextState(action) {

	}
}

/* State machine chart: 
Given an initial state (left column) and an action (top row), one may locate the resulting state

+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| INITIAL STATE    | game-start-warmup     | game-start-no-warmup    | warmup-end  | between-end-end      | begin-thinking(t) | end-thinking | end-end         | begin-timeout(t) | end-timeout    | technical | end-technical  |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| pregame          | warm-up               | between-ends            | null        | null                 | null              | null         | null            | null             | null           | null      | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| warm-up          | warm-up               | between-ends            | idle        | null                 | null              | null         | null            | null             | null           | technical | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| between-ends     | warm-up               | between-ends            | null        | stone-moving         | thinking(t)       | null         | null            | null             | null           | technical | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| idle             | between-ends          | between-ends            | null        | null                 | null              | null         | null            | null             | null           | technical | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| stone-moving     | warm-up               | between-ends            | null        | null                 | thinking(t)       | null         | between-ends    | null             | null           | technical | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| thinking         | warm-up               | between-ends            | null        | null                 | thinking(t)*      | stone-moving | between-ends*   | timeout(t)       | null           | technical | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| timeout          | warm-up               | between-ends            | null        | null                 | null              | null         | null            | null             | stone-moving** | technical | null           |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+
| technical        | warm-up               | between-ends            | null        | null                 | null              | null         | null            | null             | null           | null      | PRIOR-STATE*** |
+------------------+-----------------------+-------------------------+-------------+----------------------+-------------------+--------------+-----------------+------------------+----------------+-----------+----------------+

*   It may be the case that Team A has not cleared the house after a shot, meaning Team A thinking time is running. When
    Team A then clears the house, we switch directly to Team B thinking (or the end of the end in the case it is the last rock).

**  Open question in timer-questions.txt whether or not this is the correct state transition.

*** Most states may accept a "technical" action. This state stops all clocks until the `end-technical` action is received,
    at which point we go back to the state before the technical action began.

Note: Any state transition resulting in the `null` state shall be an error.

 */