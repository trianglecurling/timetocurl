const TimeMinder = require("./time-minder");
const uuidV4 = require('uuid/v4');

const defaultOptions = {
	betweenEndTime: 60,
	lengthOfSecond: 1000,
	midGameBreakTime: 5 * 60,
	numTimeouts: 1,
	teams: ["Red", "Yellow"],
	thinkingTime: 30 * 60,
	timeoutTime: 60,
	timerName: "Timer",
	warmupTime: 9 * 60
};

const MACHINE_ID_SEED = Math.floor(Math.random() * 10000 + 10001);

/**
 * This class implements a state machine to keep track of a single curling game. The word 'state'
 * is used to refer to an object that represents every piece of information needed to explain to
 * a client how to display the current situation in a curling game. The word 'phase' is used to
 * refer to the more traditional meaning of the word 'state' as part of a finite state machine.
 * 
 * State includes things like time remaining, the current end, timeouts, etc. Phase is simply a
 * name for the current set of actions that are being taken (e.g. running a certain clock), but
 * it also serves as the name of the node in an FSM - with phase transitions being defined by the
 * name of the transition.
 */
class CurlingMachine {

	constructor(options, onStateChange) {
		this.options = Object.assign({}, defaultOptions, options);
		this.lengthOfSecond = this.options.lengthOfSecond;
		this.nextPhaseMap = require("./phase-map");
		this.id = String(CurlingMachine.nextMachineId++);
		this.allTimers = {};
		this.initialize();
		this.onStateChange = onStateChange;
	}

	initialize() {
		this.state = this.getInitialState();
		this.history = [this.state];
		this.thinkingTimers = { };

		this.timeoutsRemaining = { };

		for (const team of this.options.teams) {
			this.thinkingTimers[team] = this.createTimer(this.options.thinkingTime);
			this.timeoutsRemaining[team] = this.options.numTimeouts;
		}
		
	}

	dispose() {
		for (const timer of Object.keys(this.allTimers)) {
			this.allTimers[timer].dispose();
		}
	}

	createTimer(duration, onComplete) {
		console.log("Starting timer for " + duration * this.lengthOfSecond + " ms.");
		const timerId = uuidV4();
		const timer = new TimeMinder(duration * this.lengthOfSecond, onComplete);
		this.allTimers[timerId] = timer;

		// No timer is allowed to last longer than a day.
		setTimeout(() => {
			timer.dispose();
		}, 86400 * 1000, timer);

		return timer;
	}

	getInitialState() {
		const timeRemaining = {};
		const timeoutsRemaining = {};
		for (const team of this.options.teams) {
			timeRemaining[team] = this.options.thinkingTime;
			timeoutsRemaining[team] = this.options.numTimeouts;
		}
		return {
			betweenEndTimeRemaining: this.options.betweenEndTime,
			currentlyRunningTimeout: null,
			currentlyThinking: null,
			end: null,
			id: this.id,
			legalActions: this.getLegalActions("pregame"),
			phase: "pregame",
			phaseData: {},
			timeoutsRemaining,
			timeRemaining,
			timerName: this.options.timerName
		}
	}

	getSerializableState() {
		// const state = { ...this.state };

		const state = this.getCurrentState();
		delete state.timer;
		return { state, options: this.options };
	}

	getFullState(newState) {
		// const nextState = { ...this.state };
		const nextState = Object.assign({}, this.state);
		Object.keys(newState).forEach(k => {
			nextState[k] = newState[k];
		});
		return nextState;
	}

	handleAction(action) {
		let nextState;
		action.data = action.data || { };
		if (action.state) {
			nextState = this.getFullState(action.state);
		} else if (action.transition) {
			nextState = this.getNextState(action);
			if (nextState === null) {
				throw new Error(`Illegal phase transition ${action.transition} from ${this.state.phase}`);
			}

			if (nextState.phase === "PRIOR-STATE") {
				if (this.history.length <= 1) {
					throw new Error("No prior state to go back to.");
				}
				nextState = Object.assign({}, this.history[this.history.length - 1]);
			}

			if (nextState.phase === "pregame") {
				nextState.timer = null;
			}

			if (nextState.phase === "warm-up") {
				console.log("starting warmup");
				if (nextState.timer) {
					nextState.timer.unpause();
				} else {
					nextState.timer = this.createTimer(this.options.warmupTime, () => {
						console.log("warmup is over");
						this.handleAction({
							transition: "warmup-end"
						});
					});
					nextState.timer.start();
				}
			}

			if (nextState.phase === "between-ends") {
				this.state.timer && this.state.timer.pause();
				if (nextState.timer) {
					nextState.timer.unpause();
				} else {
					nextState.timer = this.createTimer(this.options.betweenEndTime, () => {
						this.handleAction({
							transition: "between-end-end"
						});
					});
					nextState.timer.start();
				}
			}

			if (nextState.phase === "idle") {
				if (this.state.timer) {
					this.state.timer.pause();
				}
				nextState.timer = null;
			}

			if (nextState.phase === "stone-moving") {
				if (this.state.timer) {
					this.state.timer.pause();
				}
				nextState.timer = null;
			}

			if (nextState.phase === "thinking") {
				if (this.state.phase === "thinking" && this.state.timer) {
					this.state.timer.pause();
				} else if (this.state.timer) {
					this.state.timer.dispose();
				}
				nextState.currentlyThinking = nextState.phaseData.team;
				nextState.timer = this.thinkingTimers[nextState.phaseData.team];
				nextState.timer.start();
			}

			if (nextState.phase === "timeout") {
				if (this.state.timer) {
					this.state.timer.pause();
				}
				const whoseTimeout = nextState.currentlyRunningTimeout || this.state.currentlyThinking;
				console.log("next phase is timeout: " + whoseTimeout);
				nextState.currentlyRunningTimeout = whoseTimeout;
				if (nextState.timer) {
					nextState.timer.unpause();
				} else {
					nextState.timer = this.createTimer(this.options.timeoutTime, () => {
						this.handleAction({
							transition: "end-timeout",
							data: {
								team: whoseTimeout
							}
						});
					});
					this.timeoutsRemaining[whoseTimeout]--;
					nextState.timer.start();
				}
			}

			if (nextState.phase === "technical") {
				if (this.state.timer) {
					this.state.timer.pause();
				}
			}
		} else {
			throw new Error("Unsupported action type");
		}

		if (nextState) {
			this.history.push(this.state);
			this.state = nextState;
			this.onStateChange();
		}
	}

	getCurrentState() {
		const state = Object.assign({}, this.state);

		const betweenEndTimeRemaining = this.state.phase === "between-ends" ? this.state.timer.getTimeRemaining() / this.lengthOfSecond : null;
		const timeoutsRemaining = Object.assign({}, this.timeoutsRemaining);
		const timeoutTimeRemaining = this.state.phase === "timeout" ? this.state.timer.getTimeRemaining() / this.lengthOfSecond : null;
		const warmupTimeRemaining = this.state.phase === "warm-up" ? this.state.timer.getTimeRemaining() / this.lengthOfSecond : null;
		const timeRemaining = Object.assign({}, this.thinkingTimers);
		Object.keys(timeRemaining).forEach(team => 
			timeRemaining[team] = timeRemaining[team].getTimeRemaining() / this.lengthOfSecond);

		state.betweenEndTimeRemaining = betweenEndTimeRemaining;
		state.timeoutsRemaining = timeoutsRemaining;
		state.timeoutTimeRemaining = timeoutTimeRemaining;
		state.timeRemaining = timeRemaining;
		state.warmupTimeRemaining = warmupTimeRemaining;
		return state;
	}

	getNextState(action) {
		const currentState = this.getCurrentState();
		delete currentState.timer;
		delete currentState.currentlyRunningTimeout;
		delete currentState.currentlyThinking;
		const phase = this.nextPhaseMap[this.state.phase][action.transition];
		const end = this.getNextEnd(action);
		const phaseData = this.getPhaseData(action);
		
		const id = this.id;

		return Object.assign(currentState, { 
			phase, 
			end, 
			phaseData,
			id,
			phaseData: Object.assign({}, action.data),
			legalActions: this.getLegalActions(phase)
		});
	}

	getLegalActions(phase) {
		const actions = [];
		for (const action in this.nextPhaseMap[phase]) {
			if (this.nextPhaseMap[phase][action]) {
				actions.push(action);
			}
		}
		return actions;
	}

	getNextEnd(action) {
		if (this.state.phase === "between-ends" && action.transition === "between-end-end") {
			return this.state.end + 1;
		} else {
			return this.state.end;
		}
	}

	getPhaseData(action) {
		if (action.data.team) {
			return { team: action.data.team };
		}
		return { };
	}
}

CurlingMachine.nextMachineId = MACHINE_ID_SEED;

module.exports = CurlingMachine;

/* State machine chart: 
Given an initial state ("phase") (left column) and a transition (top row), one may locate the resulting state ("phase")

+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| INITIAL STATE    | game-start-warmup | game-start-no-warmup | warmup-end | between-end-end      | begin-thinking(t) | end-thinking | end-end       | begin-timeout(t) | end-timeout    | technical | end-technical  |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| pregame          | warm-up           | between-ends         | null       | null                 | null              | null         | null          | null             | null           | null      | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| warm-up          | warm-up           | between-ends         | idle       | null                 | null              | null         | null          | null             | null           | technical | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| between-ends     | warm-up           | between-ends         | null       | stone-moving         | thinking(t)       | null         | null          | null             | null           | technical | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| idle             | between-ends      | between-ends         | null       | null                 | null              | null         | null          | null             | null           | technical | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| stone-moving     | warm-up           | between-ends         | null       | null                 | thinking(t)       | null         | between-ends  | null             | null           | technical | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| thinking         | warm-up           | between-ends         | null       | null                 | thinking(t)*      | stone-moving | between-ends* | timeout(t)       | null           | technical | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| timeout          | warm-up           | between-ends         | null       | null                 | null              | null         | null          | null             | stone-moving** | technical | null           |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+
| technical        | warm-up           | between-ends         | null       | null                 | null              | null         | null          | null             | null           | null      | PRIOR-STATE*** |
+------------------+-------------------+----------------------+------------+----------------------+-------------------+--------------+---------------+------------------+----------------+-----------+----------------+

*   It may be the case that Team A has not cleared the house after a shot, meaning Team A thinking time is running. When
    Team A then clears the house, we switch directly to Team B thinking (or the end of the end in the case it is the last rock).

**  Open question in timer-questions.txt whether or not this is the correct state transition.

*** Most states may accept a "technical" action. This state stops all clocks until the `end-technical` action is received,
    at which point we go back to the state before the technical action began.

Note: Any state transition resulting in the `null` state shall be an error.
Note: between-end-end means "the end of the time between curling ends", and "end-end" meands "the end of a curling end"

 */