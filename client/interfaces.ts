export interface IMap<TVal> {
	[key: string]: TVal;
}

export const enum TimerType {
	Simple = "simple",
	Standard = "standard",
}

export interface TimerOptions {
	/**
	 * The length of a second in milliseconds; for
	 * deubgging purposes.
	 */
	lengthOfSecond: number;

	/**
	 * Number of ends to be played
	 */
	numEnds: number;

	/**
	 * Name given to this timer, e.g. Sheet B
	 */
	timerName: string;
}

/**
 * Standard timer options
 */
export interface StandardTimerOptions extends TimerOptions {
	/**
	 * Time alotted between ends
	 */
	betweenEndTime: number;

	/**
	 * Amount of thinking time given to each team
	 * for each additional extra end
	 */
	extraEndThinkingTime: number;

	/**
	 * Amount of time given for the mid game break
	 */
	midGameBreakTime: number;

	/**
	 * Number of timeouts given to each team during
	 * the regular portion of the game
	 */
	numTimeouts: number;

	/**
	 * List of team names, e.g. ["Red", "Yellow"]
	 */
	teams: string[];

	/**
	 * Amount of thinking time given to each team
	 * during the regular portion of the game
	 */
	thinkingTime: number;

	/**
	 * Amount of time given for a timeout, excluding
	 * travel time
	 */
	timeoutTime: number;

	/**
	 * Travel time given for the home end and the
	 * away end before starting a timeout
	 */
	travelTime: { home: number; away: number };

	/**
	 * Amount of time given during the pre-game
	 * warm up period
	 */
	warmupTime: number;
}

/**
 * Options for a simple (un-manned) curling timer
 */
export interface SimpleTimerOptions extends TimerOptions {
	/**
	 * Number of full ends that may be played after the
	 * clock reaches the "noMoreEndsTime" (e.g. Broomstones)
	 */
	allowableAdditionalEnds: number;

	/**
	 * Amount of time remaining at which point the
	 * "no more ends" policy goes into effect
	 */
	noMoreEndsTime: number;

	/**
	 * Whether or not to display information about the
	 * recommended pace to finish the game on time.
	 */
	showPacing: boolean;

	/**
	 * Total time on the clock
	 */
	totalTime: number;

	/**
	 * Amount of time remaining before displaying the
	 * warning UI
	 */
	warningTime: number;
}

export interface SocketAction<TOptions> {
	request: string;
	options: TOptions;
	clientId: string;
	token?: string;
}

export interface SocketResponse<TData> {
	data: TData;
	response: string;
	token: string;
}

export interface BaseTimerState {
	id: string;
	timerName: string;
}

export interface SimpleTimerState extends BaseTimerState {
	timeRemaining: number;
	timerIsRunning: boolean;
}

export interface CurlingMachineState extends BaseTimerState {
	betweenEndTimeRemaining: number;
	currentlyRunningTimeout: string | null;
	currentlyThinking: string | null;
	currentTimerRunningTime: number;
	end: number | null;
	legalActions: string[];
	phase: string;
	phaseData: { [key: string]: string };
	timeoutsRemaining: IMap<number>;
	timeoutTimeRemaining: number;
	timeRemaining: IMap<number>;
	warmupTimeRemaining: number;
}

export interface StateAndOptions<
	TState extends BaseTimerState = BaseTimerState,
	TOptions extends TimerOptions = TimerOptions
> {
	options: TOptions;
	state: TState;
	type: TimerType;
}

export interface SimpleStateAndOptions extends StateAndOptions<SimpleTimerState, SimpleTimerOptions> {}

export interface StandardStateAndOptions extends StateAndOptions<CurlingMachineState, StandardTimerOptions> {}

export interface ActionMessage {
	data: any;
	machineId: string;
	message: string;
}

export interface TimerPreset {
	id: string;
	name: string;
	options: TimerOptions;
	type: TimerType;
}
