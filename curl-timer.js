const TimeMinder = require("./time-minder");
const uuidV4 = require('uuid/v4');

const defaultOptions = {
	thinkingTime: 30 * 60,
	timeoutTime: 60,
	betweenEndTime: 60,
	midGameBreakTime: 5 * 60,
	teams: ["Yellow", "Red"],
	warmupTime: 9 * 60
};

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

	constructor(options) {
		this.options = Object.assign({}, defaultOptions, options);
		this.nextPhaseMap = require("./phase-map");
		this.id = uuidV4();
		this.initialize();
	}

	initialize() {
		this.state = this.getInitialState();
		this.history = [this.state];
		this.thinkingTimers = { };
		this.timeoutsRemaining = { };

		for (const team of this.options.teams) {
			this.thinkingTimers[team] = new TimeMinder(this.options.thinkingTime, () => {

			});

			this.timeoutsRemaining[team] = this.options.numTimeouts;
		}
		
	}

	getInitialState() {
		return {
			end: null,
			phase: "pregame",
			phaseData: {},
			timeRemaining: [this.options.thinkingTime, this.options.thinkingTime],
			timeoutsRemaining: [this.options.numTimeouts, this.options.numTimeouts],
			timeoutTimeRemaining: [this.options.timeoutTime, this.options.timeoutTime],
			currentlyThinking: null,
			currentlyRunningTimeout: null,
			betweenEndTimeRemaining: this.options.betweenEndTime
		}
	}

	getSerializableState() {
		// const state = { ...this.state };

		const state = Object.assign({}, this.state);
		delete state.timer;
		return state;
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
				//nextState = { ...this.history[this.history.length - 2] };
				nextState = Object.assign({}, this.history[this.history.length - 2]);
			}

			if (nextState.phase === "pregame") {
				nextState.timer = null;
			}

			if (nextState.phase === "warm-up") {
				nextState.timer = new TimeMinder(this.options.warmupTime, () => {
					this.handleAction({
						transition: "warmup-end"
					});
				});
			}

			if (nextState.phase === "between-ends") {
				this.state.timer.pause();
				nextState.timer = new TimeMinder(this.options.betweenEndTime, () => {
					this.handleAction({
						transition: "between-end-end"
					});
				});
				nextState.timer.start();
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
				if (this.state.timer) {
					this.state.timer.pause();
				}
				nextState.timer = this.thinkingTimers[action.data.team];
				nextState.timer.start();
			}

			if (nextState.phase === "timeout") {
				this.state.timer.pause();
				nextState.timer = new TimeMinder(this.options.timeoutTime, () => {
					this.handleAction("end-timeout");
				});
				nextState.timer.start();
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
		}		
	}

	getNextState(action) {
		const phase = this.nextPhaseMap[action.transition];
		const end = this.getNextEnd(action);
		const phaseData = this.getPhaseData(action);
		const timeRemaining = this.timer.thinkingTimers.map(t => t.getTimeRemaining());
		const timeoutTimeRemaining = this.timer.timeoutTimers.map(t => t.getTimeRemaining());
		const currentlyThinking = this.getCurrentlyThinking(action);
		const currentlyRunningTimeout = this.getCurrentlyRunningtimeout(action);
		const betweenEndTimeRemaining = this.timer.interEndTimer.getTimeRemaining();

		return { 
			phase, 
			end, 
			phaseData, 
			timeRemaining, 
			timeoutTimeRemaining, 
			currentlyThinking, 
			currentlyRunningTimeout, 
			betweenEndTimeRemaining
		};
	}

	getNextEnd(action) {
		if (state.phase === "between-ends" && action.transition === "between-end-end") {
			return state.end + 1;
		} else {
			return state.end;
		}
	}

	getPhaseData(action) {
		if (action.data.team) {
			return { team: action.data.team };
		}
		return { };
	}

	getCurrentlyThinking(action) {
		const nextPhase = this.nextPhaseMap[action.transition];
		if (nextPhase === "thinking") {
			return action.data.team;
		}
		return null;
	}

	getCurrentlyRunningtimeout(action) {
		const nextPhase = this.nextPhaseMap[action.transition];
		if (nextPhase === "timeout") {
			return action.data.team;
		}
		return null;
	}
}

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