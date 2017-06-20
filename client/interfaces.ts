export interface IMap<TVal> {
	[key: string]: TVal;
}

export interface TimerOptions {
	betweenEndTime: number;
	extraEndThinkingTime: number;
	lengthOfSecond: number;
	midGameBreakTime: number;
	numEnds: number;
	numTimeouts: number;
	teams: string[];
	thinkingTime: number;
	timeoutTime: number;
	timerName: string;
	travelTime: { home: number; away: number };
	warmupTime: number;
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

export interface CurlingMachineState {
	betweenEndTimeRemaining: number;
	currentlyRunningTimeout: string | null;
	currentlyThinking: string | null;
	currentTimerRunningTime: number;
	end: number | null;
	id: string;
	legalActions: string[];
	phase: string;
	phaseData: { [key: string]: string };
	timeoutsRemaining: IMap<number>;
	timeoutTimeRemaining: number;
	timeRemaining: IMap<number>;
	timerName: string;
	warmupTimeRemaining: number;
}

export interface StateAndOptions {
	options: TimerOptions;
	state: CurlingMachineState;
}

export interface ActionMessage {
	data: any;
	machineId: string;
	message: string;
}

export interface TimerPreset {
	id: string;
	name: string;
	options: TimerOptions;
}
