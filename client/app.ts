import { confirm } from "./confirm";
require("./style.scss");

declare class Stopwatch {
	constructor();
	public dispose(): void;
	public start(): void;
	public unpause(): void;
	public every(ms: number, callback: () => void, runWhenPaused: boolean): void;
	public split(): void;
	public getSplits(): number[];
	public elapsedTime(): number;
	public getTotalTimeSinceStart(): number;
	public pause(): void;
	public isRunning(): boolean;
}

declare class TimeMinder extends Stopwatch {
	constructor(totalTime: number, onComplete?: (timerData: any) => void);
	public getTimeRemaining(): number;
}

interface IMap<TVal> {
	[key: string]: TVal;
}

interface TimerOptions {
	betweenEndTime: number;
	extraEndThinkingTime: number;
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
		return hash.substr(1).split(";");
	}
	return [];
}

function setTimersInHash(ids: string[]) {
	window.location.hash = `#${ids.join(";")}`;
}

function uuid(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0,
			v = c === "x" ? r : (r & 0x3) | 0x8;
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
	private requests: { [key: string]: any };
	private requestResolvers: { [key: string]: (value?: any | PromiseLike<any>) => void };
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
			const timer = await this.emitAction<{ timerId: string }, StateAndOptions>(
				<SocketAction<{ timerId: string }>>{
					request: "GET_TIMER",
					options: { timerId },
				},
			);
			if (this.machines[timerId]) {
				this.machines[timerId].setNewState(timer.data.state);
			} else {
				this.addCurlingMachine(timer.data);
			}
		}
	}

	private setUpEvents() {
		document.addEventListener("DOMContentLoaded", async () => {
			document.getElementById("createTimer")!.addEventListener("click", async () => {
				const timerName = (document.getElementById("timerName") as HTMLInputElement).value || "Timer";
				const response = await this.emitAction<Partial<TimerOptions>, StateAndOptions>(
					<SocketAction<Partial<TimerOptions>>>{
						request: "CREATE_TIMER",
						clientId: clientId,
						options: {
							name: timerName,
							lengthOfSecond: this.lengthOfSecond,
						},
					},
				);
				this.addCurlingMachine(response.data);
			});
			const showDebug = document.getElementById("showDebug")! as HTMLInputElement;
			showDebug.addEventListener("change", this.onDebugToggled);
			document.getElementById("speedyClocks")!.addEventListener("change", this.onSpeedyClocksToggled.bind(this));
			document.getElementById("themeSelector")!.addEventListener("change", this.onThemeChanged);
			window.addEventListener("keydown", (event: KeyboardEvent) => {
				if (event.code === "Backquote" && event.ctrlKey) {
					showDebug.checked = !showDebug.checked;
					this.onDebugToggled();
				}
			});
			this.onThemeChanged();
			this.onDebugToggled();
			this.onSpeedyClocksToggled();
		});
	}

	private onSpeedyClocksToggled() {
		const speedyClocks = document.getElementById("speedyClocks")! as HTMLInputElement;
		const isSpeedy = speedyClocks.checked;
		this.lengthOfSecond = isSpeedy ? 50 : 1000;
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
		if (this.currentTheme) {
			document.body.classList.remove(this.currentTheme);
		}
		this.currentTheme = themeName;
		document.body.classList.add(this.currentTheme);
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
			displayedTimers.push(cm.state.id);
		}
		setTimersInHash(displayedTimers);
	}
}

class CurlingMachineUI {
	private addTimeoutButtons: IMap<HTMLButtonElement>;
	private betweenEndTimeText: HTMLElement;
	private debugElement: HTMLElement;
	private designationToTeam: IMap<string>;
	private elements: IMap<Element[]>;
	private elapsedThinkingTime: IMap<HTMLElement>;
	private elapsedThinkingTimeContainer: HTMLElement;
	private lengthOfSecond = 1000;
	private options: TimerOptions;
	private rootTimerElement: HTMLElement;
	private runningTimers: Stopwatch[];
	private spacer: HTMLElement;
	private spacerCenter: HTMLElement;
	private spacerLeft: HTMLElement;
	private spacerRight: HTMLElement;
	private state: CurlingMachineState;
	private subtractTimeoutButtons: IMap<HTMLButtonElement>;
	private teamsToDesignation: IMap<string>;
	private technicalInfo: HTMLElement;
	private technicalTimeoutTime: HTMLElement;
	private technicalTimeoutTitle: HTMLElement;
	private thinkingButtons: IMap<HTMLButtonElement>;
	private thinkingTimeText: IMap<HTMLElement>;
	private timeControls: IMap<HTMLElement[]>;
	private timeoutsRemainingContainerElement: HTMLElement;
	private timeoutsRemainingText: IMap<HTMLElement>;
	private timeoutTimeText: HTMLElement;
	private timerContainerElement: HTMLElement;
	private titleElement: HTMLElement;
	private warmupTimeText: HTMLElement;

	constructor(initParams: StateAndOptions, private container: Element, private application: TimeToCurl) {
		this.addTimeoutButtons = {};
		this.designationToTeam = {};
		this.elements = {};
		this.elapsedThinkingTime = {};
		this.runningTimers = [];
		this.teamsToDesignation = {};
		this.thinkingButtons = {};
		this.thinkingTimeText = {};
		this.timeControls = {};
		this.timeoutsRemainingText = {};
		this.state = initParams.state;
		this.subtractTimeoutButtons = {};
		this.options = initParams.options;
		if (initParams.options.lengthOfSecond) {
			this.lengthOfSecond = initParams.options.lengthOfSecond;
		}

		for (let i = 0; i < this.options.teams.length; ++i) {
			const designation = String.fromCharCode(65 + i);
			const team = this.options.teams[i];

			this.teamsToDesignation[team] = designation;
			this.designationToTeam[designation] = team;
		}

		this.initUI();
	}

	public initUI() {
		const template = document.getElementById("timerTemplate")!.children!.item(0);
		const newUI = template.cloneNode(true) as Element;
		this.initElements(newUI);

		// set up click-to-scroll
		this.titleElement.addEventListener("click", () => {
			this.timerContainerElement.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});

		for (const teamId of Object.keys(this.thinkingButtons)) {
			this.thinkingButtons[teamId].addEventListener("click", () => {
				this.sendPhaseTransition("begin-thinking", { team: teamId });
			});
		}

		this.forEachAction((elem, action) => {
			if (action === "begin-thinking") {
				return;
			}
			elem.addEventListener("click", async () => {
				let proceed = true;
				if (action === "begin-extra-end") {
					proceed = await confirm(
						`Are you sure you want to start an extra end? Both clocks will be reset to ${secondsToStr(
							this.options.extraEndThinkingTime,
						)}.`,
					);
				}
				if (proceed) {
					this.sendPhaseTransition(action);
				}
			});
		});

		this.forEachCommand((elem: HTMLButtonElement, command: string, team: string | null) => {
			const data = JSON.parse(elem.dataset["data"] || "{}");
			if (team) {
				data.team = this.designationToTeam[team];
			}

			elem.addEventListener("click", () => {
				this.sendCommand(command, data);
			});
		});

		const adjustTimeButton = this.elements["adjust-time"][0];
		adjustTimeButton.addEventListener("click", async () => {
			const initialValues = this.options.teams.map(t => this.state.timeRemaining[t]);

			const form = document.createElement("div");
			for (let i = 0; i < this.options.teams.length; ++i) {
				const teamId = this.options.teams[i];
				const inputId = `team${this.teamsToDesignation[teamId]}TimeInput`;

				const teamTime = document.createElement("div");
				teamTime.classList.add("team-time-input");
				const label = document.createElement("label");
				label.textContent = `${teamId} time`;
				label.setAttribute("for", inputId);

				const input = document.createElement("input");
				input.setAttribute("id", inputId);
				input.setAttribute("type", "text");
				input.setAttribute("value", secondsToStr(this.state.timeRemaining[teamId]));
				input.addEventListener("input", () => {
					const seconds = strToSeconds(input.value);
					if (seconds !== null) {
						// send state
						const newState: Partial<CurlingMachineState> = {};
						newState.timeRemaining = {};
						newState.timeRemaining[teamId] = seconds;
						this.sendNewState(newState);
					} else {
						// send initial value
						const newState: Partial<CurlingMachineState> = {};
						newState.timeRemaining = {};
						newState.timeRemaining[teamId] = initialValues[i];
						this.sendNewState(newState);
					}
				});
				teamTime.appendChild(label);
				teamTime.appendChild(input);
				form.appendChild(teamTime);
			}

			if (!await confirm(form, "Set time")) {
				// reset initial values
				const newState: Partial<CurlingMachineState> = {};
				newState.timeRemaining = {};
				for (let i = 0; i < this.options.teams.length; ++i) {
					newState.timeRemaining[this.options.teams[i]] = initialValues[i];
				}
				this.sendNewState(newState);
			}
		});

		this.setNewState(this.state);
		this.container.appendChild(newUI);
	}

	public getState() {
		return { ...this.state };
	}

	public dispose() {}

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

		this.clearTimers();
		for (const teamId of this.options.teams) {
			setTimeToElem(this.thinkingTimeText[teamId], this.state.timeRemaining[teamId]);
			if (this.state.phase !== "technical") {
				this.elapsedThinkingTime[teamId].classList.remove("running");
				this.thinkingTimeText[teamId].classList.remove("running");
			}
			if (this.state.phase === "thinking") {
				const thinkingTeam = this.state.phaseData["team"];
				if (thinkingTeam === teamId) {
					this.thinkingButtons[teamId].disabled = true;

					// Main countdown timer
					const mainTimer = new TimeMinder(this.state.timeRemaining[thinkingTeam] * this.lengthOfSecond);
					mainTimer.every(
						this.lengthOfSecond / 10,
						() => {
							setTimeToElem(
								this.thinkingTimeText[teamId],
								mainTimer.getTimeRemaining() / this.lengthOfSecond,
							);
						},
						false,
					);
					mainTimer.start();
					this.runningTimers.push(mainTimer);

					// Time spent this stone
					const stoneTimer = new Stopwatch();
					this.elapsedThinkingTime[teamId].classList.add("running");
					stoneTimer.every(
						this.lengthOfSecond / 10,
						() => {
							setTimeToElem(
								this.elapsedThinkingTime[teamId],
								(stoneTimer.elapsedTime() + (this.state.currentTimerRunningTime || 0)) /
									this.lengthOfSecond,
							);
						},
						false,
					);
					stoneTimer.start();
					this.runningTimers.push(stoneTimer);

					this.thinkingTimeText[teamId].classList.add("running");
				} else {
					this.thinkingButtons[teamId].disabled = false;
				}
			}

			const timeoutsRemaining = state.timeoutsRemaining[teamId];
			this.timeoutsRemainingText[teamId].textContent = String(timeoutsRemaining);

			// Don't show subtract button if timeouts === 0
			if (timeoutsRemaining === 0) {
				this.subtractTimeoutButtons[teamId].classList.add("irrelevant", "placeholder");
			} else {
				this.subtractTimeoutButtons[teamId].classList.remove("irrelevant", "placeholder");
			}
		}
		if (this.state.phase === "warm-up") {
			this.elements["warmup-time-container"][0].classList.remove("irrelevant");
			const timer = new TimeMinder(this.state.warmupTimeRemaining * this.lengthOfSecond);
			timer.every(
				this.lengthOfSecond / 10,
				() => {
					setTimeToElem(this.warmupTimeText, timer.getTimeRemaining() / this.lengthOfSecond);
				},
				false,
			);
			timer.start();
			this.runningTimers.push(timer);
		} else if (this.state.phase !== "technical") {
			this.elements["warmup-time-container"][0].classList.add("irrelevant");
		}

		if (this.state.phase === "between-ends") {
			this.elements["between-end-time-container"][0].classList.remove("irrelevant");
			const timer = new TimeMinder(this.state.betweenEndTimeRemaining * this.lengthOfSecond);
			timer.every(
				this.lengthOfSecond / 10,
				() => {
					setTimeToElem(this.betweenEndTimeText, timer.getTimeRemaining() / this.lengthOfSecond);
				},
				false,
			);
			timer.start();
			this.runningTimers.push(timer);
		} else if (this.state.phase !== "technical") {
			this.elements["between-end-time-container"][0].classList.add("irrelevant");
		}

		if (this.state.phase === "timeout") {
			this.elements["timeout-time-container"][0].classList.remove("irrelevant");
			const timer = new TimeMinder(this.state.timeoutTimeRemaining * this.lengthOfSecond);
			timer.every(
				this.lengthOfSecond / 10,
				() => {
					setTimeToElem(this.timeoutTimeText, timer.getTimeRemaining() / this.lengthOfSecond);
				},
				false,
			);
			timer.start();
			this.runningTimers.push(timer);
		} else if (this.state.phase !== "technical") {
			this.elements["timeout-time-container"][0].classList.add("irrelevant");
		}

		if (this.state.phase === "technical") {
			this.elements["technical"][0].classList.add("irrelevant");
			this.technicalInfo.classList.remove("irrelevant");

			const techTime = new Stopwatch();
			techTime.every(
				this.lengthOfSecond / 10,
				() => {
					setTimeToElem(this.technicalTimeoutTime, techTime.elapsedTime() / this.lengthOfSecond);
				},
				true,
			);
			techTime.start();
			this.runningTimers.push(techTime);
		} else {
			this.elements["technical"][0].classList.remove("irrelevant");
			this.technicalInfo.classList.add("irrelevant");
		}

		// Hide timeouts remaining box between ends, etc.
		if (["thinking", "stone-moving"].indexOf(this.state.phase) >= 0) {
			this.timeoutsRemainingContainerElement.classList.remove("irrelevant");
		} else if (this.state.phase !== "technical") {
			this.timeoutsRemainingContainerElement.classList.add("irrelevant");
		}

		// Hide time adjustment controls when timers are running
		if (this.state.phase === "thinking") {
			Object.keys(this.timeControls).forEach(k => {
				for (const elem of this.timeControls[k]) {
					elem.classList.add("irrelevant");
				}
			});
		} else {
			Object.keys(this.timeControls).forEach(k => {
				for (const elem of this.timeControls[k]) {
					elem.classList.remove("irrelevant");
				}
			});
		}

		// Title
		this.titleElement.textContent = this.state.timerName;
		this.rootTimerElement.classList.remove(this.rootTimerElement.dataset["phase"]!);
		this.rootTimerElement.dataset["phase"] = this.state.phase;
		this.rootTimerElement.classList.add(this.rootTimerElement.dataset["phase"]!);
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

	private forEachCommand(callback: (elem: HTMLButtonElement, command: string, team: string | null) => void) {
		for (const commandKey in this.elements) {
			const splitCommand = commandKey.split(":");
			let command = commandKey;
			let team: string | null = null;
			if (splitCommand.length === 2) {
				team = splitCommand[0];
				command = splitCommand[1];
			}
			for (const elem of this.elements[commandKey]) {
				const commandAttr = (elem as HTMLElement).dataset["command"];
				if (elem.tagName.toLowerCase() === "button" && commandAttr) {
					callback.call(null, elem, commandAttr, team);
				}
			}
		}
	}

	private clearTimers() {
		if (this.runningTimers) {
			this.runningTimers.forEach(t => t.dispose());
			this.runningTimers = [];
		}
	}

	private async sendPhaseTransition(transition: string, data?: any) {
		const result = await this.application.emitAction<{}, string>({
			request: "QUERY_TIMER",
			clientId: clientId,
			options: {
				transition: transition,
				data: data,
				timerId: this.state.id,
			},
		});
		if (result.data !== "ok") {
			throw new Error("Error querying timer w/ phase transition " + transition + ".");
		}
	}

	private async sendCommand(command: String, data?: any) {
		const result = await this.application.emitAction<{}, string>({
			request: "QUERY_TIMER",
			clientId: clientId,
			options: {
				command: command,
				data: JSON.stringify(data),
				timerId: this.state.id,
			},
		});
	}

	private async sendNewState(state: Partial<CurlingMachineState>) {
		const result = await this.application.emitAction<{}, string>({
			request: "QUERY_TIMER",
			clientId: clientId,
			options: {
				state: state,
				timerId: this.state.id,
			},
		});
	}

	private initElements(elem: Element) {
		this.populateElements(elem);

		// UI that is one-per-team
		for (const teamId of this.options.teams) {
			const key = this.teamsToDesignation[teamId] + ":";

			if (this.elements[`${key}begin-thinking`]) {
				this.thinkingButtons[teamId] = this.elements[`${key}begin-thinking`][0] as HTMLButtonElement;
			}
			if (this.elements[`${key}thinking-time`]) {
				this.thinkingTimeText[teamId] = this.elements[`${key}thinking-time`][0] as HTMLElement;
			}
			if (this.elements[`${key}timeouts-num`]) {
				this.timeoutsRemainingText[teamId] = this.elements[`${key}timeouts-num`][0] as HTMLElement;
			}
			if (this.elements[`${key}elapsed-thinking-time`]) {
				this.elapsedThinkingTime[teamId] = this.elements[`${key}elapsed-thinking-time`][0] as HTMLElement;
			}
			if (this.elements[`${key}add-timeout`]) {
				this.addTimeoutButtons[teamId] = this.elements[`${key}add-timeout`][0] as HTMLButtonElement;
			}
			if (this.elements[`${key}subtract-timeout`]) {
				this.subtractTimeoutButtons[teamId] = this.elements[`${key}subtract-timeout`][0] as HTMLButtonElement;
			}
			if (this.elements[`${key}minute-controls`]) {
				if (!this.timeControls[teamId]) {
					this.timeControls[teamId] = [];
				}
				this.timeControls[teamId].push(this.elements[`${key}minute-controls`][0] as HTMLElement);
			}
			if (this.elements[`${key}second-controls`]) {
				if (!this.timeControls[teamId]) {
					this.timeControls[teamId] = [];
				}
				this.timeControls[teamId].push(this.elements[`${key}second-controls`][0] as HTMLElement);
			}
		}

		// UI that exists once
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
		}
		if (this.elements["elapsed-thinking-time-container"] && this.elements["elapsed-thinking-time-container"][0]) {
			this.elapsedThinkingTimeContainer = this.elements["elapsed-thinking-time-container"][0] as HTMLElement;
		}
		if (this.elements["spacer"] && this.elements["spacer"][0]) {
			this.spacer = this.elements["spacer"][0] as HTMLElement;
		}
		if (this.elements["spacer-left"] && this.elements["spacer-left"][0]) {
			this.spacerLeft = this.elements["spacer-left"][0] as HTMLElement;
		}
		if (this.elements["spacer-right"] && this.elements["spacer-right"][0]) {
			this.spacerRight = this.elements["spacer-right"][0] as HTMLElement;
		}
		if (this.elements["spacer-center"] && this.elements["spacer-center"][0]) {
			this.spacerCenter = this.elements["spacer-center"][0] as HTMLElement;
		}
		if (this.elements["technical-info"] && this.elements["technical-info"][0]) {
			this.technicalInfo = this.elements["technical-info"][0] as HTMLElement;
		}
		if (this.elements["technical-timeout-time"] && this.elements["technical-timeout-time"][0]) {
			this.technicalTimeoutTime = this.elements["technical-timeout-time"][0] as HTMLElement;
		}
		if (this.elements["technical-timeout-title"] && this.elements["technical-timeout-title"][0]) {
			this.technicalTimeoutTitle = this.elements["technical-timeout-title"][0] as HTMLElement;
		}
	}

	private populateElements(elem: Element, teamContext: string | null = null) {
		let key = "";
		const elemData = (elem as HTMLElement).dataset["key"] || (elem as HTMLElement).dataset["action"];
		if (elemData) {
			key = elemData;
		} else {
			const nonTeamClasses = Array.prototype.filter.call(
				elem.classList,
				(c: string) => c.substr(0, 5) !== "team",
			);
			if (nonTeamClasses.length === 1) {
				key = nonTeamClasses[0];
			}
		}

		let foundTeamContext = teamContext;
		if (foundTeamContext === null) {
			const testForTeamInClassname = /team-([a-z]+)\b/i.exec(elem.className);
			if (testForTeamInClassname && testForTeamInClassname[1]) {
				foundTeamContext = testForTeamInClassname[1];
			}
		}

		let teamPrefix = foundTeamContext === null ? "" : foundTeamContext + ":";
		key = teamPrefix + key;

		if (!this.elements[key]) {
			this.elements[key] = [];
		}
		this.elements[key].push(elem);

		if (elem.children) {
			for (let i = 0; i < elem.children.length; ++i) {
				this.populateElements(elem.children.item(i), foundTeamContext);
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

function strToSeconds(str: string) {
	const [m, s, ...rest] = str.split(":").map(v => Number(v));
	if (isNaN(m) || isNaN(s) || rest.length !== 0) {
		return null;
	}
	return m * 60 + s;
}

function setTimeToElem(elem: HTMLElement, seconds: number) {
	setMonospaceText(elem, secondsToStr(seconds));
}

function setMonospaceText(elem: HTMLElement, text: string) {
	elem.innerHTML = "";
	elem.textContent = text;
	forceMonospace(elem);
}

// 1 => 1st, 10 => 10th, 13 => 13th, 101 => 101st, etc.
function getOrdinalAdjective(num: number): HTMLElement {
	const elem = document.createElement("span");
	elem.classList.add("ordinal-adjective");

	const cardinalNumber = document.createElement("span");
	cardinalNumber.classList.add("cardinal-number");
	cardinalNumber.textContent = String(num);

	const superScript = document.createElement("sup");
	if (num % 100 > 10 && num % 100 < 14) {
		superScript.textContent = "th";
	} else {
		switch (num % 10) {
			case 1:
				superScript.textContent = "st";
				break;
			case 2:
				superScript.textContent = "nd";
				break;
			case 3:
				superScript.textContent = "rd";
				break;
			default:
				superScript.textContent = "th";
		}
	}
	elem.appendChild(cardinalNumber);
	elem.appendChild(superScript);
	return elem;
}

new TimeToCurl().init();
console.log(
	"Hey developers! Thanks for checking out the source of Time to Curl. The JavaScript included on this page is compiled from TypeScript source. I don't do source maps because source maps are for wimps. To see the original source, head on over to our GitHub repo at https://github.com/trianglecurling/timetocurl. Please use the GitHub page to let us know if you find any issues with this application.",
);
console.log(
	'Those looking a bit more closely may notice that the layout of this page is fairly horrendous. Lots of overlayed DIVs with absolute positioning—yuck! Here\'s my reasoning. When I first created the app, I started with the most bare-bones HTML possible with almost no CSS. Once I got a good amount of the functionality done, I decided to go back and add CSS to skin the app. However, the plan was to make the first skin as similar as possible to "CurlTime" to make for an easy transition. However, I wanted to keep my options open for re-skinning in the future, so I wanted the HTML to be easily modified without affecting the "Classic" layout. We\'ll see in time if that was a good decision. I\'m starting to regret it!',
);
/* keep the last line short... */
