const { TimeMinder } = require("./time-minder");
const merge = require("lodash/merge");
const { v4: uuidV4 } = require('uuid');

const defaultOptions = {
	betweenEndTime: 10,
	extraEndThinkingTime: 60 * 4.5,
	lengthOfSecond: 1000,
	midGameBreakTime: 5 * 60,
	numEnds: 8,
	numTimeouts: 1,
	numTimeoutsPerExtraEnd: 1,
	teams: ["Red", "Yellow"],
	thinkingTime: 30 * 60,
	timeoutTime: 60,
	timerName: "",
	travelTime: { home: 20, away: 40 },
	warmupTime: 9 * 60,
};

const defaultSimpleTimerOptions = {
	lengthOfSecond: 1000,
	numEnds: 8,
	timerName: "",
	allowableAdditionalEnds: 0,
	noMoreEndsTime: 10 * 60,
	showPacing: true,
	totaltime: 120 * 60,
	warningTime: 15 * 60,
};

const MACHINE_ID_SEED = Math.floor(Math.random() * 10000 + 10001);

class SimpleTimerMachine {
	constructor(options, onStateChange) {
		this.options = Object.assign({}, defaultSimpleTimerOptions, options);
		this.lengthOfSecond = this.options.lengthOfSecond;
		this.id = String(CurlingMachine.nextMachineId++);
		this.timer = new TimeMinder((this.options.totalTime + this.options.preGameTime) * this.lengthOfSecond);
		if (!this.options.timerName) {
			this.options.timerName = `Simple Timer ${String(this.id)}`;
		}
		this.onStateChange = onStateChange;
		this.sockets = {};
		if (!this.options.timerName) {
			this.options.timerName = `Standard Timer ${String(this.id)}`;
		}
	}

	dispose() {
		this.timer.dispose();
	}

	registerSocket(clientId, socket) {
		this.sockets[clientId] = socket;
	}

	handleAction(action) {
		action.data = action.data || {};
		if (action.command) {
			let stateChanged = true;
			switch (action.command) {
				case "ADD_TIME":
					this.timer.setTimeRemaining(this.timer.getTimeRemaining() + parseInt(action.data.value, 10) * this.lengthOfSecond);
					break;
				case "START_TIMER":
					this.timer.unpause();
					break;
				case "PAUSE_TIMER":
					this.timer.pause();
					break;
				default:
					stateChanged = false;
			}
			if (stateChanged) {
				this.onStateChange(Object.keys(this.sockets).map(s => this.sockets[s]));
			}
		}
	}

	getSerializableState() {
		return {
			state: {
				timeRemaining: this.timer.getTimeRemaining() / this.lengthOfSecond,
				timerIsRunning: this.timer.isRunning(),
				id: this.id,
				timerName: this.options.timerName,
			},
			options: this.options,
			type: "simple",
		};
	}
}

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
		this.sockets = {};
	}

	initialize() {
		if (!this.options.timerName) {
			this.options.timerName = `Standard Timer ${String(this.id)}`;
		}
		this.state = this.getInitialState();
		this.history = [this.state];
		this.thinkingTimers = {};

		this.timeoutsRemaining = {};

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
		setTimeout(
			() => {
				timer.dispose();
			},
			86400 * 1000,
			timer,
		);

		return timer;
	}

	getInitialState() {
		const timeRemaining = {};
		const timeoutsRemaining = {};
		const currentStone = {};
		for (const team of this.options.teams) {
			timeRemaining[team] = this.options.thinkingTime;
			timeoutsRemaining[team] = this.options.numTimeouts;
			currentStone[team] = 0;
		}

		// If there is no warmup time defined, go directly into the main timer phase
		const initialPhase = this.options.warmupTime === 0 ? "stone-moving" : "pregame";

		return {
			betweenEndTimeRemaining: this.options.betweenEndTime,
			currentlyRunningTimeout: null,
			currentStone: currentStone,
			currentlyThinking: null,
			currentTimerRunningTime: 0,
			end: null,
			extraEnd: null,
			id: this.id,
			legalActions: this.getLegalActions(initialPhase),
			phase: initialPhase,
			phaseData: {},
			timeoutsRemaining,
			timeRemaining,
			timerName: this.options.timerName,
		};
	}

	getSerializableState() {
		// const state = { ...this.state };

		const state = this.getCurrentState();
		delete state.timer;
		return { state, options: this.options, type: "standard" };
	}

	getFullState(newState) {
		// const nextState = { ...this.state };
		const nextState = merge({}, this.state, newState);

		// Set the timers
		Object.keys(nextState.timeRemaining).forEach(k => {
			this.thinkingTimers[k].setTimeRemaining(nextState.timeRemaining[k] * this.lengthOfSecond);
		});

		return nextState;
	}

	handleAction(action) {
		let nextState;
		action.data = action.data || {};
		if (action.state) {
			nextState = this.getFullState(action.state);
		} else if (action.command) {
			nextState = this.getCurrentState();
			switch (action.command) {
				case "ADD_TIMEOUTS":
					if (typeof this.timeoutsRemaining[action.data.team] === "number") {
						this.timeoutsRemaining[action.data.team] += parseInt(action.data.value, 10);
					}
					break;
				case "ADD_TIME":
					if (this.thinkingTimers[action.data.team]) {
						console.log("Adding " + action.data.value + " to " + action.data.team);
						this.thinkingTimers[action.data.team].setTimeRemaining(
							this.thinkingTimers[action.data.team].getTimeRemaining() +
								parseInt(action.data.value, 10) * this.lengthOfSecond,
						);
					}
					break;
				case "ADD_TIMEOUT_TIME":
					if (this.state.timer) {
						console.log(parseInt(action.data.value, 10));
						this.state.timer.setTimeRemaining(
							this.state.timer.getTimeRemaining() + parseInt(action.data.value, 10) * this.lengthOfSecond,
						);
					}
					break;
				case "ADD_ENDS":
					nextState.end += parseInt(action.data.value);
					break;
				case "ADD_STONES":
					if (nextState.currentStone[action.data.team]) {
						nextState.currentStone[action.data.team] += parseInt(action.data.value);
					}
					break;
			}
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

				if (action.transition === "cancel-timer") {
					if (this.state.timer) {
						this.state.timer.dispose();
					}
				}
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
							transition: "warmup-end",
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
					let time = this.options.betweenEndTime;
					if (action.transition === "begin-midgame-break") {
						time = this.options.midGameBreakTime;
					}
					nextState.timer = this.createTimer(time, () => {
						this.previousThinkingTeam = null;
						Object.keys(nextState.currentStone).forEach(k => {
							nextState.currentStone[k] = 0;
						});
						this.handleAction({
							transition: "between-end-end",
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

				// Keep track of which stone we're on.
				// 99% of the time the first stone of an end does not use any
				// thinking time, so we will assume that the first usage
				// of thinking time for an end will set each team to their
				// FIRST stone.
				// Additionally, only increment stone count when the thinking
				// team CHANGES. Start, stop, start on same team does not increment stone #.
				// @TODO: Set up a timer for ~10 seconds after the end of an end.
				// If thinking time starts within that 10 seconds, assume it's for
				// the first rock of the end.

				if (
					Object.keys(nextState.currentStone)
						.map(k => nextState.currentStone[k])
						.reduce((a, b) => a + b, 0) === 0
				) {
					Object.keys(nextState.currentStone).forEach(k => {
						nextState.currentStone[k] = 1;
					});
				} else if (nextState.phaseData.team !== nextState.previousThinkingTeam) {
					nextState.currentStone[nextState.phaseData.team]++;
				}
				nextState.previousThinkingTeam = nextState.phaseData.team;

				nextState.currentlyThinking = nextState.phaseData.team;
				nextState.timer = this.thinkingTimers[nextState.phaseData.team];

				// Time individual stones by providing a segment name in the
				// form: Yellow:n-m where n is the end number and m is the stone number.
				nextState.timer.unpause(
					nextState.phaseData.team + ":" + nextState.end + "-" + nextState.currentStone[nextState.phaseData.team],
				);
			}

			if (nextState.phase === "timeout") {
				if (this.state.timer) {
					this.state.timer.pause();
				}
				const whoseTimeout = nextState.currentlyRunningTimeout || this.state.currentlyThinking;
				console.log("next phase is timeout: " + whoseTimeout);
				nextState.currentlyRunningTimeout = whoseTimeout;
				if (nextState.timer) {
					// Technical timeout occurred during timeout
					nextState.timer.unpause();
				} else {
					// Odd ends = home travel time
					const extraTravelTime = this.state.end % 2 === 1 ? this.options.travelTime["home"] : this.options.travelTime["away"];
					nextState.timer = this.createTimer(this.options.timeoutTime + extraTravelTime, () => {
						// Only deduct a timeout when it has been used completey.
						// It may have been canceled.
						this.timeoutsRemaining[whoseTimeout]--;

						this.handleAction({
							transition: "end-timeout",
							data: {
								team: whoseTimeout,
							},
						});
					});
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
			// only push to history if phase has changed
			if (this.state.phase !== nextState.phase) {
				this.history.push(this.state);
			}
			this.state = nextState;
			this.onStateChange(Object.keys(this.sockets).map(s => this.sockets[s]));
		}
	}

	registerSocket(clientId, socket) {
		this.sockets[clientId] = socket;
	}

	getCurrentState() {
		const state = Object.assign({}, this.state);

		const betweenEndTimeRemaining =
			this.state.phase === "between-ends" ? this.state.timer.getTimeRemaining() / this.lengthOfSecond : null;
		const timeoutsRemaining = Object.assign({}, this.timeoutsRemaining);
		const timeoutTimeRemaining = this.state.phase === "timeout" ? this.state.timer.getTimeRemaining() / this.lengthOfSecond : null;
		const warmupTimeRemaining = this.state.phase === "warm-up" ? this.state.timer.getTimeRemaining() / this.lengthOfSecond : null;
		const timeRemaining = Object.assign({}, this.thinkingTimers);
		Object.keys(timeRemaining).forEach(team => (timeRemaining[team] = timeRemaining[team].getTimeRemaining() / this.lengthOfSecond));

		let currentTimerRunningTime = null;
		if (state.timer) {
			if (state.phase === "thinking") {
				const segmentName = state.phaseData.team + ":" + state.end + "-" + state.currentStone[state.phaseData.team];
				currentTimerRunningTime = state.timer.getTotalSegmentTime(segmentName);
			} else {
				currentTimerRunningTime = state.timer.elapsedTime();
			}
		}

		state.currentTimerRunningTime = currentTimerRunningTime;
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
		const [{ end, extraEnd }, isExtraEnd] = this.getNextEnd(action);
		const id = this.id;

		const nextState = Object.assign(currentState, {
			phase,
			end,
			extraEnd,
			id,
			phaseData: Object.assign({}, action.data),
			legalActions: this.getLegalActions(phase),
		});
		if (isExtraEnd) {
			this.beginExtraEnd(nextState);
		}
		return nextState;
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
		const result = { end: this.state.end, extraEnd: this.state.extraEnd };
		let isExtraEnd = false;
		if ((this.state.phase === "between-ends" && action.transition === "between-end-end") || action.transition === "begin-extra-end") {
			if (result.end >= this.options.numEnds || result.extraEnd !== null || action.transition === "begin-extra-end") {
				result.extraEnd = !result.extraEnd ? 1 : result.extraEnd + 1;
				isExtraEnd = true;
			} else {
				result.end = !result.end ? 1 : result.end + 1;
			}
		}
		console.log(JSON.stringify(result));
		return [result, isExtraEnd];
	}

	getPhaseData(action) {
		if (action.data.team) {
			return { team: action.data.team };
		}
		return {};
	}

	beginExtraEnd(nextState) {
		Object.keys(this.thinkingTimers).forEach(k => {
			this.thinkingTimers[k].setTimeRemaining(this.options.extraEndThinkingTime * this.lengthOfSecond);
		});
		Object.keys(nextState.currentStone).forEach(k => {
			nextState.currentStone[k] = 0;
		});
		Object.keys(this.timeoutsRemaining).forEach(k => {
			this.timeoutsRemaining[k] = this.options.numTimeoutsPerExtraEnd;
		});
	}
}

CurlingMachine.nextMachineId = MACHINE_ID_SEED;

module.exports = { CurlingMachine, SimpleTimerMachine };

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
