declare class TimeMinder {
	constructor(totalTime: number, onComplete?: (timerData: any) => void);
	public start(): void;
	public getTimeSpent(): number;
	public getTimeRemaining(): number;
	public getTotalTimeSinceStart(): number;
	public pause(): void;
	public isRunning(): boolean;
	public every(ms: number, callback: () => void, runWhenPaused: boolean): void;
	public dispose(): void;
}

declare var _settings: {
	lengthOfSecond: number;
}

interface IMap<TVal> {
	[key: string]: TVal;
}

interface TimerOptions {
	thinkingTime: number;
	numTimeouts: number;
	timeoutTime: number;
	betweenEndTime: number;
	midGameBreakTime: number;
	teams: string[];
	warmupTime: number;
}

interface SocketAction<TOptions> {
	request: string;
	options: TOptions;
	token?: string;
}

interface SocketResponse<TData> {
	response: string;
	token: string;
	data: TData;
}

interface CurlingMachineState {
	end: number | null;
	phase: string;
	phaseData: {[key: string]: string};
	timeRemaining: IMap<number>;
	timeoutsRemaining: IMap<number>;
	timeoutTimeRemaining: IMap<number>;
	currentlyThinking: string | null;
	currentlyRunningTimeout: string | null;
	betweenEndTimeRemaining: number;
	warmupTimeRemaining: number;
	id: string;
}

interface StateAndOptions {
	state: CurlingMachineState;
	options: TimerOptions;
}

interface ActionMessage {
	machineId: string;
	message: string;
	data: any;
}

function getDisplayedTimers(): string[] {
	const hash = window.location.hash;
	if (hash.length > 0) {
		return hash.substr(1).split(";")
	}
	return [];
}

function setTimersInHash(ids: string[]) {
	window.location.hash = `#${ids.join(";")}`;
}

function uuid(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
}

function roundPrecision(num: number, decimalPlaces: number) {
	const power = Math.pow(10, decimalPlaces);
	return Math.round(num * power) / power;
}

class TimeToCurl {
	private socket: SocketIOClient.Socket;
	private requests: {[key: string]: any};
	private requestResolvers: {[key: string]: (value?: any | PromiseLike<any>) => void};
	private machines: IMap<CurlingMachineUI>;
	private machineOrder: IMap<number>;

	public init() {
		this.setUpEvents();
		this.socket = io();
		this.requests = {};
		this.requestResolvers = {};
		this.machines = {};
		this.machineOrder = {};

		this.socket.on("response", (result: string) => {
			let response: SocketResponse<any>;
			try {
				response = JSON.parse(result);
			} catch (ex) {
				throw new Error(`Could not parse response as JSON: ${result}`);
			}

			// Did we ask for this data?
			if (this.requestResolvers[response.token]) {
				this.requests[response.token] = response;
				this.requestResolvers[response.token].call(this, response);
			} else {
				console.warn(`Unexpected data from the server: ${result}`);
			}
		});

		this.socket.on("statechange", (message: string) => {
			const receivedMessage = JSON.parse(message) as ActionMessage;
			switch (receivedMessage.message) {
				case "SET_STATE":
					this.machines[receivedMessage.machineId].setNewState(receivedMessage.data.state);
					break;
				default:
					throw new Error("Received an action that we didn't know how to handle... " + message);
			}
		});

		this.loadTimers(getDisplayedTimers());
	}

	private async loadTimers(ids: string[]) {
		for (const timerId of ids) {
			const timer = await this.emitAction<{timerId: string}, StateAndOptions>(<SocketAction<{timerId: string}>>{
				request: "GET_TIMER",
				options: { timerId }
			});
			if (this.machines[timerId]) {
				this.machines[timerId].setNewState(timer.data.state);
			} else {
				this.addCurlingMachine(timer.data);
			}
		}
	}

	private setUpEvents() {
		document.addEventListener("DOMContentLoaded", () => {
			document.getElementById("createTimer")!.addEventListener("click", async () => {
				const response = await this.emitAction<Partial<TimerOptions>, StateAndOptions>(<SocketAction<Partial<TimerOptions>>>{
					request: "CREATE_TIMER",
					options: {

					}
				});
				this.addCurlingMachine(response.data);
			});
		});
	}

	public emitAction<TAction, TResponse>(action: SocketAction<TAction>): PromiseLike<SocketResponse<TResponse>> {
		return new Promise<SocketResponse<TResponse>>((resolve, reject) => {
			const token = uuid();
			action.token = token;
			this.socket.emit("action", JSON.stringify(action));
			this.requestResolvers[token] = resolve;
		});
	}

	private addCurlingMachine(cm: StateAndOptions) {
		this.machines[cm.state.id] = new CurlingMachineUI(cm, document.getElementById("timersContainer")!, this);
		const displayedTimers = getDisplayedTimers();
		if (displayedTimers.indexOf(cm.state.id) === -1) {
			displayedTimers.push(cm.state.id)
		}
		setTimersInHash(displayedTimers);
	}
}

class CurlingMachineUI {
	private state: CurlingMachineState;
	private options: TimerOptions;
	private elements: { [key: string]: Element[] };
	private thinkingButtons: IMap<HTMLButtonElement>;
	private thinkingTimeText: IMap<HTMLElement>;
	private warmupTimeText: HTMLElement;
	private runningTimer: TimeMinder;

	constructor(initParams: StateAndOptions, private container: Element, private application: TimeToCurl) {
		this.elements = {};
		this.thinkingButtons = {};
		this.thinkingTimeText = {};
		this.state = initParams.state;
		this.options = initParams.options;
		this.initUI();
	}

	public initUI() {
		const template = document.getElementById("timerTemplate")!.children!.item(0);
		const newUI = template.cloneNode(true) as Element;
		this.initElements(newUI);

		for (const teamId of Object.keys(this.thinkingButtons)) {
			this.thinkingButtons[teamId].addEventListener("click", () => {
				this.sendPhaseTransition("begin-thinking", {team: teamId});
			});
		}

		for (const action in this.elements) {
			if (this.elements[action].length === 1) {
				const elem = this.elements[action][0];
				if (elem.tagName.toLowerCase() === "button" && (elem as HTMLElement).dataset["action"]) {
					elem.addEventListener("click", () => {
						this.sendPhaseTransition(action);
					});
				}
			}
		}

		this.setNewState(this.state);
		this.container.appendChild(newUI);
	}

	public getState() {
		return { ...this.state };
	}

	public dispose() {

	}

	public setNewState(state: CurlingMachineState) {
		this.state = state;
		this.clearTimer();
		for (const teamId of this.options.teams) {
			this.thinkingTimeText[teamId].textContent = this.secondsToStr(this.state.timeRemaining[teamId]);
			if (this.state.phase === "thinking") {
				const thinkingTeam = this.state.phaseData["team"];
				if (thinkingTeam === teamId) {
					const timer = new TimeMinder(this.state.timeRemaining[thinkingTeam] * _settings.lengthOfSecond);
					timer.every(_settings.lengthOfSecond / 10, () => {
						this.thinkingTimeText[teamId].textContent = this.secondsToStr(timer.getTimeRemaining() / _settings.lengthOfSecond);
					}, false);
					timer.start();
					this.runningTimer = timer;
				}
			}
			
			if (this.state.phase === "warm-up") {
				const timer = new TimeMinder(this.state.warmupTimeRemaining * _settings.lengthOfSecond);
				timer.every(_settings.lengthOfSecond / 10, () => {
					this.warmupTimeText.textContent = this.secondsToStr(timer.getTimeRemaining() / _settings.lengthOfSecond);
				}, false);
			}
		}
	}

	private clearTimer() {
		if (this.runningTimer) {
			this.runningTimer.dispose();
		}
	}

	private async sendPhaseTransition(transition: string, data?: any) {
		const result = await this.application.emitAction<{}, string>({
			request: "QUERY_TIMER",
			options: {
				transition: transition,
				data: data,
				timerId: this.state.id
			}
		});
		if (result.data !== "ok") {
			throw new Error("Error querying timer w/ phase transition " + transition + ".");
		}
	}

	private initElements(elem: Element) {
		let key = "";
		const elemData = (elem as HTMLElement).dataset["action"];
		if (elemData) {
			key = elemData;
		}
		else if (elem.classList.length === 1) {
			key = elem.className;
		}
		if (!this.elements[key]) {
			this.elements[key] = [];
		} 
		this.elements[key].push(elem);

		for (let i = 0; i < this.options.teams.length; ++i) {
			if (this.elements["begin-thinking"] && this.elements["begin-thinking"][i]) {
				this.thinkingButtons[this.options.teams[i]] = this.elements["begin-thinking"][i] as HTMLButtonElement;
			}
			if (this.elements["thinking-time"] && this.elements["thinking-time"][i]) {
				this.thinkingTimeText[this.options.teams[i]] = this.elements["thinking-time"][i] as HTMLElement;
			}
			if (this.elements["warmup-time"] && this.elements["warmup-time"][i]) {
				this.warmupTimeText = this.elements["warmup-time"][i] as HTMLElement;
			}
		}

		if (elem.children) {
			for (let i = 0; i < elem.children.length; ++i) {
				this.initElements(elem.children.item(i));
			}
		}
	}

	private secondsToStr(seconds: number) {
		const m = Math.floor(seconds / 60);
		const s = roundPrecision(seconds, 0) % 60;
		const slz = s < 10 ? "0" + String(s) : String(s);
		return `${m}:${slz}`;
	}
}

new TimeToCurl().init();