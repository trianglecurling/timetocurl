declare class TimeMinder {
	constructor(totalTime: number, onComplete?: (timerData: any) => void);
	public dispose(): void;
	public every(ms: number, callback: () => void, runWhenPaused: boolean): void;
	public getTimeRemaining(): number;
	public getTimeSpent(): number;
	public getTotalTimeSinceStart(): number;
	public isRunning(): boolean;
	public pause(): void;
	public start(): void;
}

interface IMap<TVal> {
	[key: string]: TVal;
}

interface TimerOptions {
	betweenEndTime: number;
	lengthOfSecond: number;
	midGameBreakTime: number;
	numTimeouts: number;
	teams: string[];
	thinkingTime: number;
	timeoutTime: number;
	warmupTime: number;
}

interface SocketAction<TOptions> {
	request: string;
	options: TOptions;
	clientId: string;
	token?: string;
}

interface SocketResponse<TData> {
	data: TData;
	response: string;
	token: string;
}

interface CurlingMachineState {
	betweenEndTimeRemaining: number;
	currentlyRunningTimeout: string | null;
	currentlyThinking: string | null;
	end: number | null;
	id: string;
	legalActions: string[];
	phase: string;
	phaseData: {[key: string]: string};
	timeoutsRemaining: IMap<number>;
	timeoutTimeRemaining: number;
	timeRemaining: IMap<number>;
	timerName: string;
	warmupTimeRemaining: number;
}

interface StateAndOptions {
	options: TimerOptions;
	state: CurlingMachineState;
}

interface ActionMessage {
	data: any;
	machineId: string;
	message: string;
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
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

const clientId = uuid();

function roundPrecision(num: number, decimalPlaces: number) {
	const power = Math.pow(10, decimalPlaces);
	return Math.round(num * power) / power;
}

function forceMonospace(element: Node) {
	for (let i = 0; i < element.childNodes.length; i++) {
		const child = element.childNodes[i];

		if (child.nodeType === Node.TEXT_NODE) {
			const $wrapper = document.createDocumentFragment();

			for (i = 0; i < child.nodeValue!.length; i++) {
				const $char = document.createElement("span");
				const val = child.nodeValue!.charAt(i);
				const charCode = val.charCodeAt(0);
				$char.className = "char" + (charCode >= 48 && charCode < 58 ? " digit" : "");
				$char.textContent = val;

				$wrapper.appendChild($char);
			}

			element.replaceChild($wrapper, child);
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			forceMonospace(child);
		}
	}
}

class TimeToCurl {
	private socket: SocketIOClient.Socket;
	private requests: {[key: string]: any};
	private requestResolvers: {[key: string]: (value?: any | PromiseLike<any>) => void};
	private machines: IMap<CurlingMachineUI>;
	private machineOrder: IMap<number>;
	private currentTheme: string;
	private lengthOfSecond: number = 1000;

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
				const timerName = (document.getElementById("timerName") as HTMLInputElement).value || "Timer";
				const response = await this.emitAction<Partial<TimerOptions>, StateAndOptions>(<SocketAction<Partial<TimerOptions>>>{
					request: "CREATE_TIMER",
					clientId: clientId,
					options: {
						name: timerName,
						lengthOfSecond: this.lengthOfSecond
					}
				});
				this.addCurlingMachine(response.data);
			});
			document.getElementById("showDebug")!.addEventListener("change", this.onDebugToggled);
			document.getElementById("speedyClocks")!.addEventListener("change", this.onSpeedyClocksToggled.bind(this));
			document.getElementById("themeSelector")!.addEventListener("change", this.onThemeChanged);
			this.onThemeChanged();
			this.onDebugToggled();
			this.onSpeedyClocksToggled();
		});
	}

	private onSpeedyClocksToggled() {
		const speedyClocks = document.getElementById("speedyClocks")! as HTMLInputElement;
		const isSpeedy = speedyClocks.checked;
		this.lengthOfSecond = isSpeedy ? 100 : 1000;
	}

	private onDebugToggled() {
		const showDebug = document.getElementById("showDebug")! as HTMLInputElement;
		const debugElements = document.getElementsByClassName("debug");
		for (let i = 0; i < debugElements.length; ++i) {
			const elem = debugElements.item(i);
			elem.classList[showDebug.checked ? "remove" : "add"]("hidden");
		}
	}

	private onThemeChanged() {
		const selector = document.getElementById("themeSelector") as HTMLSelectElement;
		this.setTheme(selector.value);
	}

	public setTheme(themeName: string) {
		this.currentTheme = themeName;
		document.body.className = this.currentTheme;
	}

	public emitAction<TAction, TResponse>(action: SocketAction<TAction>): PromiseLike<SocketResponse<TResponse>> {
		return new Promise<SocketResponse<TResponse>>((resolve, reject) => {
			const token = uuid();
			action.token = token;
			action.clientId = clientId;
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
	private betweenEndTimeText: HTMLElement;
	private debugElement: HTMLElement;
	private elements: { [key: string]: Element[] };
	private lengthOfSecond = 1000;
	private options: TimerOptions;
	private rootTimerElement: HTMLElement;
	private runningTimer: TimeMinder;
	private state: CurlingMachineState;
	private thinkingButtons: IMap<HTMLButtonElement>;
	private thinkingTimeText: IMap<HTMLElement>;
	private timeoutsRemainingContainerElement: HTMLElement;
	private timeoutsRemainingText: IMap<HTMLElement>;
	private timeoutTimeText: HTMLElement;
	private timerContainerElement: HTMLElement;
	private titleElement: HTMLElement;
	private warmupTimeText: HTMLElement;

	constructor(initParams: StateAndOptions, private container: Element, private application: TimeToCurl) {
		this.elements = {};
		this.thinkingButtons = {};
		this.thinkingTimeText = {};
		this.timeoutsRemainingText = {};
		this.state = initParams.state;
		this.options = initParams.options;
		if (initParams.options.lengthOfSecond) {
			this.lengthOfSecond = initParams.options.lengthOfSecond;
		}
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

		this.forEachAction((elem, action) => {
			if (action === "begin-thinking") {
				return;
			}
			elem.addEventListener("click", () => {
				this.sendPhaseTransition(action);
			});
		});

		this.setNewState(this.state);
		this.container.appendChild(newUI);
	}

	public getState() {
		return { ...this.state };
	}

	public dispose() {

	}

	public setNewState(state: CurlingMachineState) {
		this.debugElement.textContent = JSON.stringify(state, null, 4);
		this.state = state;

		// Enable buttons for legal actions only
		this.forEachAction((elem, action) => {
			if (this.state.legalActions.indexOf(action) >= 0) {
				elem.disabled = false;
			} else {
				elem.disabled = true;
			}
		});

		this.clearTimer();
		for (const teamId of this.options.teams) {
			setTimeToElem(this.thinkingTimeText[teamId], this.state.timeRemaining[teamId]);
			this.thinkingTimeText[teamId].classList.remove("running");
			if (this.state.phase === "thinking") {
				const thinkingTeam = this.state.phaseData["team"];
				if (thinkingTeam === teamId) {
					this.thinkingButtons[teamId].disabled = true;
					const timer = new TimeMinder(this.state.timeRemaining[thinkingTeam] * this.lengthOfSecond);
					timer.every(this.lengthOfSecond / 10, () => {
						setTimeToElem(this.thinkingTimeText[teamId], timer.getTimeRemaining() / this.lengthOfSecond);
					}, false);
					timer.start();
					this.runningTimer = timer;
					this.thinkingTimeText[teamId].classList.add("running");
				} else {
					this.thinkingButtons[teamId].disabled = false;
				}
			}

			this.timeoutsRemainingText[teamId].textContent = String(state.timeoutsRemaining[teamId]);
		}
		if (this.state.phase === "warm-up") {
			this.elements["warmup-time-container"][0].classList.remove("irrelevant");
			const timer = new TimeMinder(this.state.warmupTimeRemaining * this.lengthOfSecond);
			timer.every(this.lengthOfSecond / 10, () => {
				setTimeToElem(this.warmupTimeText, timer.getTimeRemaining() / this.lengthOfSecond);
			}, false);
			timer.start();
			this.runningTimer = timer;
		} else if (this.state.phase !== "technical") {
			this.elements["warmup-time-container"][0].classList.add("irrelevant");
		}

		if (this.state.phase === "between-ends") {
			this.elements["between-end-time-container"][0].classList.remove("irrelevant");
			const timer = new TimeMinder(this.state.betweenEndTimeRemaining * this.lengthOfSecond);
			timer.every(this.lengthOfSecond / 10, () => {
				setTimeToElem(this.betweenEndTimeText, timer.getTimeRemaining() / this.lengthOfSecond);
			}, false);
			timer.start();
			this.runningTimer = timer;
		} else if (this.state.phase !== "technical") {
			this.elements["between-end-time-container"][0].classList.add("irrelevant");
		}

		if (this.state.phase === "timeout") {
			this.elements["timeout-time-container"][0].classList.remove("irrelevant");
			const timer = new TimeMinder(this.state.timeoutTimeRemaining * this.lengthOfSecond);
			timer.every(this.lengthOfSecond / 10, () => {
				setTimeToElem(this.timeoutTimeText, timer.getTimeRemaining() / this.lengthOfSecond);
			}, false);
			timer.start();
			this.runningTimer = timer;
		} else if (this.state.phase !== "technical") {
			this.elements["timeout-time-container"][0].classList.add("irrelevant");
		}

		if (["thinking", "stone-moving"].indexOf(this.state.phase) >= 0) {
			this.timeoutsRemainingContainerElement.classList.remove("irrelevant");
		} else {
			this.timeoutsRemainingContainerElement.classList.add("irrelevant");
		}

		// Title
		this.titleElement.textContent = this.state.timerName;
		this.rootTimerElement.classList.remove(this.rootTimerElement.dataset["phase"]);
		this.rootTimerElement.dataset["phase"] = this.state.phase;
		this.rootTimerElement.classList.add(this.rootTimerElement.dataset["phase"]);
	}

	private forEachAction(callback: (elem: HTMLButtonElement, action: string) => void) {
		for (const action in this.elements) {
			for (const elem of this.elements[action]) {
				const actionAttr = (elem as HTMLElement).dataset["action"];
				if (elem.tagName.toLowerCase() === "button" && actionAttr) {
					callback.call(null, elem, actionAttr);
				}
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
			clientId: clientId,
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
		const elemData = (elem as HTMLElement).dataset["key"] || (elem as HTMLElement).dataset["action"];
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
			if (this.elements["timeouts-remaining"] && this.elements["timeouts-remaining"][i]) {
				this.timeoutsRemainingText[this.options.teams[i]] = this.elements["timeouts-remaining"][i] as HTMLElement;
			}
		}
		if (this.elements["timer"] && this.elements["timer"][0]) {
			this.rootTimerElement = this.elements["timer"][0] as HTMLElement;
		}
		if (this.elements["warmup-time"] && this.elements["warmup-time"][0]) {
			this.warmupTimeText = this.elements["warmup-time"][0] as HTMLElement;
		}
		if (this.elements["between-end-time"] && this.elements["between-end-time"][0]) {
			this.betweenEndTimeText = this.elements["between-end-time"][0] as HTMLElement;
		}
		if (this.elements["debug"] && this.elements["debug"][0]) {
			this.debugElement = this.elements["debug"][0] as HTMLElement;
		}
		if (this.elements["timeout-time"] && this.elements["timeout-time"][0]) {
			this.timeoutTimeText = this.elements["timeout-time"][0] as HTMLElement;
		}
		if (this.elements["timer-title"] && this.elements["timer-title"][0]) {
			this.titleElement = this.elements["timer-title"][0] as HTMLElement;
		}
		if (this.elements["timeouts-remaining-container"] && this.elements["timeouts-remaining-container"][0]) {
			this.timeoutsRemainingContainerElement = this.elements["timeouts-remaining-container"][0] as HTMLElement;
		}
		if (this.elements["timer-container"] && this.elements["timer-container"][0]) {
			this.timerContainerElement = this.elements["timer-container"][0] as HTMLElement;

			// set up click-to-scroll
			this.titleElement.addEventListener("click", () => {
				this.timerContainerElement.scrollIntoView({
					behavior: "smooth",
					block: "start"
				});
			});
		}

		if (elem.children) {
			for (let i = 0; i < elem.children.length; ++i) {
				this.initElements(elem.children.item(i));
			}
		}
	}
}

function secondsToStr(seconds: number) {
	const clampedSeconds = Math.max(0, seconds);
	const m = Math.floor(clampedSeconds / 60);
	const s = roundPrecision(clampedSeconds, 0) % 60;
	const slz = s < 10 ? "0" + String(s) : String(s);
	return `${m}:${slz}`;
}

function setTimeToElem(elem: HTMLElement, seconds: number) {
	setMonospaceText(elem, secondsToStr(seconds));
}

function setMonospaceText(elem: HTMLElement, text: string) {
	elem.innerHTML = "";
	elem.textContent = text;
	forceMonospace(elem);
}

new TimeToCurl().init();