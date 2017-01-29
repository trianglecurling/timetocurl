declare class TimeMinder {
	public start(): void;
	public getTimeSpent(): number;
	public getTimeRemaining(): number;
	public getTotalTimeSinceStart(): number;
	public pause(): void;
	public isRunning(): boolean;
}

interface IMap<TVal> {
	[key: string]: TVal;
}

interface TimerOptions {
	thinkingTime?: number;
	numTimeouts?: number;
	timeoutTime?: number;
	betweenEndTime?: number;
	midGameBreakTime?: number;
	teams?: string[];
	warmupTime?: number;
}

interface SocketAction<TOptions> {
	request: string;
	options: TOptions;
	token: string;
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
}

function uuid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
}

class TimeToCurl {
	private socket: SocketIOClient.Socket;
	private requests: {[key: string]: any};
	private requestResolvers: {[key: string]: (value?: any | PromiseLike<any>) => void};
	private machines: CurlingMachineUI[];

	public init() {
		this.setUpEvents();
		this.socket = io();
		this.requests = {};
		this.requestResolvers = {};
		this.machines = [];

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
	}

	private setUpEvents() {
		document.addEventListener("DOMContentLoaded", () => {
			document.getElementById("createTimer")!.addEventListener("click", () => {
				this.emitAction<TimerOptions, CurlingMachineState>(<SocketAction<TimerOptions>>{
					request: "CREATE_TIMER",
					options: {

					}
				}).then(response => {
					console.log(`New curling machine added: ${JSON.stringify(response.data, null, 4)}`);
					this.addCurlingMachine(response.data);
				});
			});
		});
	}

	private emitAction<TAction, TResponse>(action: SocketAction<TAction>): PromiseLike<SocketResponse<TResponse>> {
		return new Promise<SocketResponse<TResponse>>((resolve, reject) => {
			const token = uuid();
			action.token = token;
			this.socket.emit("action", JSON.stringify(action));
			this.requestResolvers[token] = resolve;
		});
	}

	private addCurlingMachine(state: CurlingMachineState) {
		this.machines.push(new CurlingMachineUI(state, document.getElementById("timersContainer")!));
	}
}

class CurlingMachineUI {
	private state: CurlingMachineState;
	private elements: { [key: string]: Element };

	constructor(initialState: CurlingMachineState, private container: Element) {
		this.elements = {};
		this.state = initialState;
		this.initUI();
	}

	public initUI() {
		const template = document.getElementById("timerTemplate")!.children!.item(0);
		const newUI = template.cloneNode(true) as Element;
		this.initElements(newUI);

		this.elements["team-1-thinking-time"].textContent = this.secondsToStr(this.state.timeRemaining["Yellow"])
		this.elements["team-2-thinking-time"].textContent = this.secondsToStr(this.state.timeRemaining["Red"])
		this.container.appendChild(newUI);
	}

	private initElements(elem: Element) {
		if (elem.className) {
			this.elements[elem.className] = elem;
		}
		if (elem.children) {
			for (let i = 0; i < elem.children.length; ++i) {
				this.initElements(elem.children.item(i));
			}
		}
	}

	private secondsToStr(seconds: number) {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		const slz = s < 10 ? "0" + String(s) : String(s);
		return `${m}:${slz}`
	}
}

new TimeToCurl().init();