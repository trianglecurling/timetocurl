import { confirm } from "./confirm";
import {
	ActionMessage,
	CurlingMachineState,
	IMap,
	SocketAction,
	SocketResponse,
	StandardStateAndOptions,
	StandardTimerOptions,
	TimerOptions,
	TimerType,
	SimpleTimerOptions,
	SimpleStateAndOptions,
	SimpleTimerState,
	BaseTimerState,
	StateAndOptions,
} from "./interfaces";
import { StandardBaseOptions, TimerPresets, SimpleBaseOptions } from "./presets";
import { cloneDeep, isEqual } from "lodash";

require("./style.scss");

declare class Stopwatch {
	constructor(onDispose?: (timerData: any) => void);
	public dispose(): void;
	public start(): void;
	public unpause(): void;
	public every(
		ms: number,
		callback: (isImmediateInvocation?: boolean) => void,
		runWhenPaused?: boolean,
		invokeImmediately?: boolean,
	): void;
	public split(): void;
	public getSplits(): number[];
	public elapsedTime(): number;
	public getTotalTimeSinceStart(): number;
	public pause(): void;
	public isRunning(): boolean;
}

declare class TimeMinder extends Stopwatch {
	constructor(totalTime: number, onComplete?: (timerData: any) => void, onDispose?: (timerData: any) => void);
	public getTimeRemaining(): number;
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

function isSimpleTimer(machine: StateAndOptions): machine is SimpleStateAndOptions {
	return machine.type === "simple";
}

function isStandardTimer(machine: StateAndOptions): machine is StandardStateAndOptions {
	return machine.type === "standard";
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
	private machines: IMap<TimerUIBase>;
	private machineOrder: IMap<number>;
	private currentTheme: string;
	private speedyClocks: boolean = false;
	private nextSimpleTimerOptions: SimpleTimerOptions;
	private nextStandardTimerOptions: StandardTimerOptions;
	private nextTimerType: TimerType;
	private timerPresetsDropdown: HTMLSelectElement;

	public init() {
		this.setUpEvents();
		this.socket = io();
		this.requests = {};
		this.requestResolvers = {};
		this.machines = {};
		this.machineOrder = {};
		this.nextSimpleTimerOptions = cloneDeep(SimpleBaseOptions);
		this.nextStandardTimerOptions = cloneDeep(StandardBaseOptions);
		this.nextTimerType = TimerType.Standard;

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
			const timer = await this.emitAction<{ timerId: string }, StandardStateAndOptions>(
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

	private populateTimerOptions() {
		const simpleGroup = document.createElement("optgroup");
		simpleGroup.setAttribute("label", "Basic timers");
		const standardGroup = document.createElement("optgroup");
		standardGroup.setAttribute("label", "Full timers");

		for (const preset of TimerPresets) {
			const option = document.createElement("option");
			option.value = preset.id;
			option.textContent = preset.name;
			if (preset.type === TimerType.Simple) {
				simpleGroup.appendChild(option);
			} else {
				standardGroup.appendChild(option);
			}
		}
		this.timerPresetsDropdown.appendChild(simpleGroup);
		this.timerPresetsDropdown.appendChild(standardGroup);

		const customOption = document.createElement("option");
		customOption.value = "custom";
		customOption.textContent = "Custom";
		this.timerPresetsDropdown.appendChild(customOption);
	}

	private restoreSettingsFromStorage() {
		const speedyClocks = window.localStorage["speedy-clocks"];
		const showDebug = window.localStorage["show-debug"];
		const simpleTimerOptions = window.localStorage["simple-timer-options"];
		const standardTimerOptions = window.localStorage["standard-timer-options"];
		const theme = window.localStorage["theme"];
		const timerType = window.localStorage["timer-type"];

		const speedyClocksCheckbox = document.getElementById("speedyClocks")! as HTMLInputElement;
		const showDebugCheckbox = document.getElementById("showDebug")! as HTMLInputElement;
		const themeSelect = document.getElementById("themeSelector") as HTMLSelectElement;

		if (speedyClocks) {
			speedyClocksCheckbox.checked = speedyClocks === "true";
		}
		if (showDebug) {
			showDebugCheckbox.checked = showDebug === "true";
		}
		if (standardTimerOptions) {
			this.nextStandardTimerOptions = JSON.parse(standardTimerOptions);
		}
		if (simpleTimerOptions) {
			this.nextSimpleTimerOptions = JSON.parse(simpleTimerOptions);
		}
		if (timerType) {
			this.nextTimerType = timerType;
		}
		if (theme) {
			themeSelect.value = theme;
		}
		this.evaluatePresetDropdown();
	}

	private simpleInput(labelText: string, id: string, defaultValue?: any) {
		const container = document.createElement("div");
		container.classList.add("simple-input");

		const label = document.createElement("label");
		label.classList.add("simple-input-label");
		label.setAttribute("for", id);
		label.textContent = labelText;

		const field = document.createElement("input");
		field.setAttribute("type", "text");
		field.setAttribute("id", id);
		field.classList.add("simple-input-field");

		const currentValue = document.createElement("div");
		currentValue.classList.add("input-value-preview");
		currentValue.setAttribute("id", `${id}Value`);
		if (defaultValue !== undefined) {
			currentValue.textContent = defaultValue.toString();
		}

		container.appendChild(label);
		container.appendChild(field);
		container.appendChild(currentValue);
		return container;
	}

	private evaluatePresetDropdown() {
		for (const preset of TimerPresets) {
			if (this.nextTimerType === TimerType.Standard && isEqual(preset.options, this.nextStandardTimerOptions)) {
				this.timerPresetsDropdown.value = preset.id;
				return;
			}
			if (this.nextTimerType === TimerType.Simple && isEqual(preset.options, this.nextSimpleTimerOptions)) {
				this.timerPresetsDropdown.value = preset.id;
				return;
			}
		}
		this.timerPresetsDropdown.value = "custom";
	}

	private getRadioValue(...radios: HTMLInputElement[]) {
		for (const radio of radios) {
			if (radio.checked) {
				return radio.value;
			}
		}
		return null;
	}

	private async customizeSettings() {
		const simpleOrStandard = document.createElement("div");
		simpleOrStandard.classList.add("simple-or-standard-radios");

		const radioGroupLabel = document.createElement("div");
		radioGroupLabel.textContent = "Timer type";
		radioGroupLabel.classList.add("simple-or-standard-radio-group-label");

		const simpleRadio = document.createElement("div");
		simpleRadio.classList.add("radio-label-pair");
		const simpleRadioInput = document.createElement("input");
		simpleRadioInput.setAttribute("type", "radio");
		simpleRadioInput.setAttribute("id", "simpleRadioButton");
		simpleRadioInput.setAttribute("name", "simple-or-standard-radio");
		simpleRadioInput.value = "simple";
		if (this.nextTimerType === TimerType.Simple) {
			simpleRadioInput.checked = true;
		}
		const simpleRadioLabel = document.createElement("label");
		simpleRadioLabel.setAttribute("for", "simpleRadioButton");
		simpleRadioLabel.setAttribute(
			"title",
			"Simple timer that counts down to zero. No active timekeeping required.",
		);
		simpleRadioLabel.textContent = "Simple";
		simpleRadio.appendChild(simpleRadioInput);
		simpleRadio.appendChild(simpleRadioLabel);

		const standardRadio = document.createElement("div");
		standardRadio.classList.add("radio-label-pair");
		const standardRadioInput = document.createElement("input");
		standardRadioInput.setAttribute("type", "radio");
		standardRadioInput.setAttribute("id", "standardRadioButton");
		standardRadioInput.setAttribute("name", "simple-or-standard-radio");
		standardRadioInput.value = "standard";
		if (this.nextTimerType === TimerType.Standard) {
			standardRadioInput.checked = true;
		}
		const standardRadioLabel = document.createElement("label");
		standardRadioLabel.setAttribute("for", "standardRadioButton");
		standardRadioLabel.setAttribute(
			"title",
			"Full timer with thinking time, timeouts, between end time, etc. Requires a dedicated timekeeper.",
		);
		standardRadioLabel.textContent = "Standard";
		standardRadio.appendChild(standardRadioInput);
		standardRadio.appendChild(standardRadioLabel);

		simpleOrStandard.appendChild(radioGroupLabel);
		simpleOrStandard.appendChild(simpleRadio);
		simpleOrStandard.appendChild(standardRadio);

		const standardOptions = this.nextStandardTimerOptions;
		const thinkingTime = this.simpleInput(
			"Thinking time",
			"thinkingTime",
			secondsToStr(standardOptions.thinkingTime),
		);
		const numEndsStandard = this.simpleInput("Number of ends", "numEnds", standardOptions.numEnds);
		const extraEndThinkingTime = this.simpleInput(
			"Thinking time added for an extra end",
			"extraEndThinkingTime",
			secondsToStr(standardOptions.extraEndThinkingTime),
		);
		const numTimeouts = this.simpleInput("Number of timeouts per team", "numTimeouts", standardOptions.numTimeouts);
		const timeoutTime = this.simpleInput("Timeout time", "timeoutTime", secondsToStr(standardOptions.timeoutTime));
		const homeTravelTime = this.simpleInput(
			"Travel time (home end)",
			"homeTravelTime",
			secondsToStr(standardOptions.travelTime.home),
		);
		const awayTravelTime = this.simpleInput(
			"Travel time (away end)",
			"awayTravelTime",
			secondsToStr(standardOptions.travelTime.away),
		);
		const warmupTime = this.simpleInput("Warmup time", "warmupTime", secondsToStr(standardOptions.warmupTime));
		const betweenEndTime = this.simpleInput(
			"Time between ends",
			"betweenEndTime",
			secondsToStr(standardOptions.betweenEndTime),
		);
		const midGameBreakTime = this.simpleInput(
			"Mid game break time",
			"midGameBreakTime",
			secondsToStr(standardOptions.midGameBreakTime),
		);

		const standardContainer = document.createElement("div");
		standardContainer.classList.add("custom-settings-fields-container", "standard-settings", "irrelevant");
		standardContainer.appendChild(thinkingTime);
		standardContainer.appendChild(numEndsStandard);
		standardContainer.appendChild(extraEndThinkingTime);
		standardContainer.appendChild(numTimeouts);
		standardContainer.appendChild(timeoutTime);
		standardContainer.appendChild(homeTravelTime);
		standardContainer.appendChild(awayTravelTime);
		standardContainer.appendChild(warmupTime);
		standardContainer.appendChild(betweenEndTime);
		standardContainer.appendChild(midGameBreakTime);

		const simpleOptions = this.nextSimpleTimerOptions;
		const totalTime = this.simpleInput("Total time", "totalTime", secondsToStr(simpleOptions.totalTime));
		const endTime = this.simpleInput("Turn red at", "noMoreEndsTime", secondsToStr(simpleOptions.noMoreEndsTime));
		const warningTime = this.simpleInput("Turn yellow at", "warningTime", secondsToStr(simpleOptions.warningTime));
		const additionalEnds = this.simpleInput(
			"Ends allowed after timer turns red",
			"allowableAdditionalEnds",
			simpleOptions.allowableAdditionalEnds,
		);
		const numEndsSimple = this.simpleInput("Number of ends", "numEnds", simpleOptions.numEnds);

		const showPacing = document.createElement("div");
		showPacing.classList.add("simple-input");
		const showPacingLabel = document.createElement("label");
		showPacingLabel.textContent = "Display recommended pacing";
		showPacingLabel.classList.add("simple-input-label");
		showPacingLabel.setAttribute("for", "showPacingCheckbox");
		const showPacingCheckbox = document.createElement("input");
		showPacingCheckbox.setAttribute("id", "showPacingCheckbox");
		showPacingCheckbox.setAttribute("type", "checkbox");
		showPacingCheckbox.setAttribute("value", "true");
		showPacingCheckbox.checked = simpleOptions.showPacing;
		showPacingCheckbox.classList.add("simple-input-field");
		const previewDummy = document.createElement("div");
		previewDummy.classList.add("input-value-preview");
		showPacing.appendChild(showPacingLabel);
		showPacing.appendChild(showPacingCheckbox);
		showPacing.appendChild(previewDummy);

		const simpleContainer = document.createElement("div");
		simpleContainer.classList.add("custom-settings-fields-container", "simple-settings", "irrelevant");
		simpleContainer.appendChild(totalTime);
		simpleContainer.appendChild(warningTime);
		simpleContainer.appendChild(endTime);
		simpleContainer.appendChild(additionalEnds);
		simpleContainer.appendChild(numEndsSimple);
		simpleContainer.appendChild(showPacing);

		const onTimerTypeChanged = () => {
			const result = this.getRadioValue(simpleRadioInput, standardRadioInput);
			if (result === "standard") {
				this.nextTimerType = TimerType.Standard;
				simpleContainer.classList.add("irrelevant");
				standardContainer.classList.remove("irrelevant");
			} else if (result === "simple") {
				this.nextTimerType = TimerType.Simple;
				standardContainer.classList.add("irrelevant");
				simpleContainer.classList.remove("irrelevant");
			}
			this.evaluatePresetDropdown();
			this.saveTimerOptions();
		};
		simpleRadioInput.addEventListener("change", onTimerTypeChanged);
		standardRadioInput.addEventListener("change", onTimerTypeChanged);
		onTimerTypeChanged();

		const optionsDialog = document.createElement("div");
		optionsDialog.classList.add("customize-timer-dialog");
		const allOptionsContainer = document.createElement("div");
		allOptionsContainer.appendChild(simpleContainer);
		allOptionsContainer.appendChild(standardContainer);
		optionsDialog.appendChild(simpleOrStandard);
		optionsDialog.appendChild(allOptionsContainer);

		const prevStandardSettings = cloneDeep(standardOptions);
		const prevSimpleSettings = cloneDeep(simpleOptions);
		const prevTimerType = this.nextTimerType;
		showPacingCheckbox.addEventListener("change", () => {
			simpleOptions.showPacing = showPacingCheckbox.checked;
			this.evaluatePresetDropdown();
			this.saveTimerOptions();
		});
		allOptionsContainer.addEventListener(
			"input",
			() => {
				const valThinkingTime = strToSeconds((thinkingTime.children[1] as HTMLInputElement).value);
				const valNumEndsStandard = Number((numEndsStandard.children[1] as HTMLInputElement).value);
				const valXEndThinkingTime = strToSeconds((extraEndThinkingTime.children[1] as HTMLInputElement).value);
				const valNumTimeouts = Number((numTimeouts.children[1] as HTMLInputElement).value);
				const valTimeoutTime = strToSeconds((timeoutTime.children[1] as HTMLInputElement).value);
				const valHomeTravelTime = strToSeconds((homeTravelTime.children[1] as HTMLInputElement).value);
				const valAwayTravelTime = strToSeconds((awayTravelTime.children[1] as HTMLInputElement).value);
				const valWarmupTime = strToSeconds((warmupTime.children[1] as HTMLInputElement).value);
				const valBetweenEndTime = strToSeconds((betweenEndTime.children[1] as HTMLInputElement).value);
				const valMidGameBreakTime = strToSeconds((midGameBreakTime.children[1] as HTMLInputElement).value);

				const valTotalTime = strToSeconds((totalTime.children[1] as HTMLInputElement).value);
				const valEndTime = strToSeconds((endTime.children[1] as HTMLInputElement).value);
				const valWarningTime = strToSeconds((warningTime.children[1] as HTMLInputElement).value);
				const valAdditionalEnds = Number((additionalEnds.children[1] as HTMLInputElement).value);
				const valNumEndsSimple = Number((numEndsSimple.children[1] as HTMLInputElement).value);

				standardOptions.thinkingTime = valThinkingTime || prevStandardSettings.thinkingTime;
				standardOptions.numEnds = valNumEndsStandard || prevStandardSettings.numEnds;
				standardOptions.extraEndThinkingTime = valXEndThinkingTime || prevStandardSettings.extraEndThinkingTime;
				standardOptions.numTimeouts = valNumTimeouts || prevStandardSettings.numTimeouts;
				standardOptions.timeoutTime = valTimeoutTime || prevStandardSettings.timeoutTime;
				standardOptions.travelTime.home = valHomeTravelTime || prevStandardSettings.travelTime.home;
				standardOptions.travelTime.away = valAwayTravelTime || prevStandardSettings.travelTime.away;
				standardOptions.warmupTime = valWarmupTime || prevStandardSettings.warmupTime;
				standardOptions.betweenEndTime = valBetweenEndTime || prevStandardSettings.betweenEndTime;
				standardOptions.midGameBreakTime = valMidGameBreakTime || prevStandardSettings.midGameBreakTime;

				simpleOptions.totalTime = valTotalTime || prevSimpleSettings.totalTime;
				simpleOptions.noMoreEndsTime = valEndTime || prevSimpleSettings.noMoreEndsTime;
				simpleOptions.warningTime = valWarningTime || prevSimpleSettings.warningTime;
				simpleOptions.allowableAdditionalEnds = isNaN(valAdditionalEnds)
					? prevSimpleSettings.allowableAdditionalEnds
					: valAdditionalEnds;
				simpleOptions.numEnds = valNumEndsSimple || prevSimpleSettings.numEnds;

				thinkingTime.children[2].textContent = secondsToStr(standardOptions.thinkingTime);
				numEndsStandard.children[2].textContent = String(standardOptions.numEnds);
				extraEndThinkingTime.children[2].textContent = secondsToStr(standardOptions.extraEndThinkingTime);
				numTimeouts.children[2].textContent = String(standardOptions.numTimeouts);
				timeoutTime.children[2].textContent = secondsToStr(standardOptions.timeoutTime);
				homeTravelTime.children[2].textContent = secondsToStr(standardOptions.travelTime.home);
				awayTravelTime.children[2].textContent = secondsToStr(standardOptions.travelTime.away);
				warmupTime.children[2].textContent = secondsToStr(standardOptions.warmupTime);
				betweenEndTime.children[2].textContent = secondsToStr(standardOptions.betweenEndTime);
				midGameBreakTime.children[2].textContent = secondsToStr(standardOptions.midGameBreakTime);

				totalTime.children[2].textContent = secondsToStr(simpleOptions.totalTime);
				endTime.children[2].textContent = secondsToStr(simpleOptions.noMoreEndsTime);
				warningTime.children[2].textContent = secondsToStr(simpleOptions.warningTime);
				additionalEnds.children[2].textContent = String(simpleOptions.allowableAdditionalEnds);
				numEndsSimple.children[2].textContent = String(simpleOptions.numEnds);

				this.evaluatePresetDropdown();
				this.saveTimerOptions();
			},
			true,
		);

		if (!await confirm(optionsDialog, "Customize timer settings")) {
			this.nextStandardTimerOptions = prevStandardSettings;
			this.nextSimpleTimerOptions = prevSimpleSettings;
			this.nextTimerType = prevTimerType;
			this.evaluatePresetDropdown();
		}
	}

	private setNextTimerOptionsFromDropdown() {
		const dropdownValue = this.timerPresetsDropdown.value;
		const matchedPreset = TimerPresets.filter(p => p.id === dropdownValue)[0];
		if (matchedPreset) {
			if (matchedPreset.type === TimerType.Simple) {
				this.nextSimpleTimerOptions = cloneDeep(matchedPreset).options as SimpleTimerOptions;
				this.nextTimerType = TimerType.Simple;
			} else {
				this.nextStandardTimerOptions = cloneDeep(matchedPreset).options as StandardTimerOptions;
				this.nextTimerType = TimerType.Standard;
			}
			this.saveTimerOptions();
		}
	}

	private saveTimerOptions() {
		window.localStorage["standard-timer-options"] = JSON.stringify(this.nextStandardTimerOptions);
		window.localStorage["simple-timer-options"] = JSON.stringify(this.nextSimpleTimerOptions);
		window.localStorage["timer-type"] = String(this.nextTimerType);
	}

	private setUpEvents() {
		document.addEventListener("DOMContentLoaded", async () => {
			this.timerPresetsDropdown = document.getElementById("timerPresets")! as HTMLSelectElement;
			this.populateTimerOptions();
			this.restoreSettingsFromStorage();

			document.getElementById("createTimer")!.addEventListener("click", async () => {
				const response = await this.emitAction<Partial<StandardTimerOptions>, StandardStateAndOptions>(
					<SocketAction<Partial<StandardTimerOptions>>>{
						request: "CREATE_TIMER",
						clientId: clientId,
						options: {
							...this.nextTimerType === TimerType.Simple
								? this.nextSimpleTimerOptions
								: this.nextStandardTimerOptions,
							lengthOfSecond: this.speedyClocks ? 100 : 1000,
							type: this.nextTimerType,
						},
					},
				);
				this.addCurlingMachine(response.data).scrollIntoView();
			});
			const showDebug = document.getElementById("showDebug")! as HTMLInputElement;
			showDebug.addEventListener("change", this.onDebugToggled);
			this.timerPresetsDropdown.addEventListener("change", () => {
				if (this.timerPresetsDropdown.value === "custom") {
					this.customizeSettings();
				} else {
					this.setNextTimerOptionsFromDropdown();
				}
			});
			document.getElementById("speedyClocks")!.addEventListener("change", this.onSpeedyClocksToggled.bind(this));
			document.getElementById("themeSelector")!.addEventListener("change", this.onThemeChanged);
			document.getElementById("customizeSettings")!.addEventListener("click", () => {
				this.customizeSettings();
			});
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
		this.speedyClocks = speedyClocks.checked;
		window.localStorage["speedy-clocks"] = this.speedyClocks;
	}

	private onDebugToggled() {
		const showDebug = document.getElementById("showDebug")! as HTMLInputElement;
		const debugElements = document.getElementsByClassName("debug");
		for (let i = 0; i < debugElements.length; ++i) {
			const elem = debugElements.item(i);
			elem.classList[showDebug.checked ? "remove" : "add"]("hidden");
		}
		window.localStorage["show-debug"] = showDebug.checked;
	}

	private onThemeChanged() {
		const selector = document.getElementById("themeSelector") as HTMLSelectElement;
		this.setTheme(selector.value);
		window.localStorage["theme"] = selector.value;
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
		if (isSimpleTimer(cm)) {
			this.machines[cm.state.id] = new SimpleTimerUI(cm, document.getElementById("timersContainer")!, this);
		} else if (isStandardTimer(cm)) {
			this.machines[cm.state.id] = new CurlingMachineUI(cm, document.getElementById("timersContainer")!, this);
		}
		this.machines[cm.state.id].initUI();
		const displayedTimers = getDisplayedTimers();
		if (displayedTimers.indexOf(cm.state.id) === -1) {
			displayedTimers.push(cm.state.id);
		}
		setTimersInHash(displayedTimers);
		return this.machines[cm.state.id];
	}
}

abstract class TimerUIBase<
	TState extends BaseTimerState = BaseTimerState,
	TOptions extends TimerOptions = TimerOptions
> {
	protected elements: IMap<Element[]>;
	protected lengthOfSecond: number;
	protected options: TOptions;
	protected rootTimerElement: HTMLElement;
	protected runningTimers: Stopwatch[];
	protected state: TState;
	protected timerContainerElement: HTMLElement;
	protected titleElement: HTMLElement;

	constructor(
		initParams: StateAndOptions<TState, TOptions>,
		protected container: Element,
		protected application: TimeToCurl,
	) {
		this.elements = {};
		this.state = initParams.state;
		this.options = initParams.options;
		this.runningTimers = [];
		if (initParams.options.lengthOfSecond) {
			this.lengthOfSecond = initParams.options.lengthOfSecond;
		}
	}

	public abstract initUI(): void;

	public abstract setNewState(state: TState): void;

	protected abstract initElements(template: Element): void;

	public scrollIntoView() {
		this.timerContainerElement.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}

	protected clearTimers() {
		if (this.runningTimers) {
			this.runningTimers.forEach(t => t.dispose());
			this.runningTimers = [];
		}
	}

	protected async sendCommand(command: String, data?: any) {
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

	protected forEachAction(callback: (elem: HTMLButtonElement, action: string) => void) {
		for (const action in this.elements) {
			for (const elem of this.elements[action]) {
				const actionAttr = (elem as HTMLElement).dataset["action"];
				if (elem.tagName.toLowerCase() === "button" && actionAttr) {
					callback.call(null, elem, actionAttr);
				}
			}
		}
	}

	protected forEachCommand(callback: (elem: HTMLButtonElement, command: string, team: string | null) => void) {
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

	protected populateElements(elem: Element, teamContext: string | null = null) {
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

		const teamPrefix = foundTeamContext === null ? "" : foundTeamContext + ":";
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

class SimpleTimerUI extends TimerUIBase<SimpleTimerState, SimpleTimerOptions> {
	protected addMinuteButton: HTMLButtonElement;
	protected addSecondButton: HTMLButtonElement;
	protected debugElement: HTMLElement;
	protected pacingElement: HTMLElement;
	protected pauseButton: HTMLButtonElement;
	protected remainingTime: HTMLElement;
	protected startButton: HTMLButtonElement;

	constructor(initParams: SimpleStateAndOptions, protected container: Element, protected application: TimeToCurl) {
		super(initParams, container, application);
	}

	public initUI() {
		const template = document.getElementById("simpleTimerTemplate")!.children!.item(0);
		const newUI = template.cloneNode(true) as Element;
		this.initElements(newUI);

		this.forEachCommand((elem: HTMLButtonElement, command: string, team: string | null) => {
			elem.addEventListener("click", () => {
				const data = JSON.parse(elem.dataset["data"] || "{}");
				this.sendCommand(command, data);
			});
		});

		this.setNewState(this.state);
		this.container.appendChild(newUI);
	}

	public setNewState(state: SimpleTimerState): void {
		this.debugElement.textContent = JSON.stringify(state, null, 4);
		this.state = state;
		this.clearTimers();

		const mainTimer = new TimeMinder(this.state.timeRemaining * this.lengthOfSecond);
		mainTimer.every(
			this.lengthOfSecond / 10,
			() => {
				const timeRemaining = mainTimer.getTimeRemaining() / this.lengthOfSecond;
				setTimeToElem(this.remainingTime, mainTimer.getTimeRemaining() / this.lengthOfSecond);

				this.timerContainerElement.classList.remove("warning");
				this.timerContainerElement.classList.remove("no-more-ends");
				if (timeRemaining <= this.options.noMoreEndsTime) {
					this.timerContainerElement.classList.add("no-more-ends");
				} else if (timeRemaining <= this.options.warningTime) {
					this.timerContainerElement.classList.add("warning");
				}
			},
			false,
		);
		this.runningTimers.push(mainTimer);
		if (this.state.timerIsRunning) {
			mainTimer.start();
			this.pauseButton.classList.remove("irrelevant");
			this.startButton.classList.add("irrelevant");
		} else {
			this.pauseButton.classList.add("irrelevant");
			this.startButton.classList.remove("irrelevant");
		}
	}

	protected initElements(template: Element): void {
		this.populateElements(template);
		if (this.elements["debug"] && this.elements["debug"][0]) {
			this.debugElement = this.elements["debug"][0] as HTMLElement;
		}
		if (this.elements["timer"] && this.elements["timer"][0]) {
			this.rootTimerElement = this.elements["timer"][0] as HTMLElement;
		}
		if (this.elements["timer-container"] && this.elements["timer-container"][0]) {
			this.timerContainerElement = this.elements["timer-container"][0] as HTMLElement;
		}
		if (this.elements["start-timer"] && this.elements["start-timer"][0]) {
			this.startButton = this.elements["start-timer"][0] as HTMLButtonElement;
		}
		if (this.elements["pause-timer"] && this.elements["pause-timer"][0]) {
			this.pauseButton = this.elements["pause-timer"][0] as HTMLButtonElement;
		}
		if (this.elements["timer-title"] && this.elements["timer-title"][0]) {
			this.titleElement = this.elements["timer-title"][0] as HTMLElement;
		}
		if (this.elements["remaining-time"] && this.elements["remaining-time"][0]) {
			this.remainingTime = this.elements["remaining-time"][0] as HTMLElement;
		}
	}
}

class CurlingMachineUI extends TimerUIBase<CurlingMachineState, StandardTimerOptions> {
	protected addTimeoutButtons: IMap<HTMLButtonElement>;
	protected betweenEndTimeText: HTMLElement;
	protected debugElement: HTMLElement;
	protected designationToTeam: IMap<string>;
	protected elapsedThinkingTime: IMap<HTMLElement>;
	protected elapsedThinkingTimeContainer: HTMLElement;
	protected spacer: HTMLElement;
	protected spacerCenter: HTMLElement;
	protected spacerLeft: HTMLElement;
	protected spacerRight: HTMLElement;
	protected subtractTimeoutButtons: IMap<HTMLButtonElement>;
	protected teamsToDesignation: IMap<string>;
	protected technicalInfo: HTMLElement;
	protected technicalTimeoutTime: HTMLElement;
	protected technicalTimeoutTitle: HTMLElement;
	protected thinkingButtons: IMap<HTMLButtonElement>;
	protected thinkingTimeText: IMap<HTMLElement>;
	protected timeControls: IMap<HTMLElement[]>;
	protected timeoutsRemainingContainerElement: HTMLElement;
	protected timeoutsRemainingText: IMap<HTMLElement>;
	protected timeoutTimeText: HTMLElement;
	protected travelTimeCancelButton: HTMLButtonElement;
	protected travelTimeContainer: HTMLElement;
	protected travelTimeValue: HTMLElement;
	protected warmupTimeText: HTMLElement;

	constructor(initParams: StandardStateAndOptions, protected container: Element, protected application: TimeToCurl) {
		super(initParams, container, application);
		this.addTimeoutButtons = {};
		this.designationToTeam = {};
		this.elapsedThinkingTime = {};
		this.teamsToDesignation = {};
		this.thinkingButtons = {};
		this.thinkingTimeText = {};
		this.timeControls = {};
		this.timeoutsRemainingText = {};
		this.subtractTimeoutButtons = {};
		if (initParams.options.lengthOfSecond) {
			this.lengthOfSecond = initParams.options.lengthOfSecond;
		}

		for (let i = 0; i < this.options.teams.length; ++i) {
			const designation = String.fromCharCode(65 + i);
			const team = this.options.teams[i];

			this.teamsToDesignation[team] = designation;
			this.designationToTeam[designation] = team;
		}
	}

	public initUI() {
		const template = document.getElementById("timerTemplate")!.children!.item(0);
		const newUI = template.cloneNode(true) as Element;
		this.initElements(newUI);

		// set up click-to-scroll
		this.titleElement.addEventListener("click", () => {
			this.scrollIntoView();
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
			elem.addEventListener("click", () => {
				const data = JSON.parse(elem.dataset["data"] || "{}");
				if (team) {
					data.team = this.designationToTeam[team];
				}
				this.sendCommand(command, data);
			});
		});

		this.travelTimeCancelButton.addEventListener("click", () => {
			const travelTime =
				(this.state.end || 0) % 2 === 0 ? this.options.travelTime["away"] : this.options.travelTime["home"];
			if (this.travelTimeCancelButton.textContent === "Undo") {
				this.travelTimeCancelButton.textContent = "No coach";
				this.travelTimeCancelButton.dataset["data"] = JSON.stringify({ value: -1 * travelTime });
				this.travelTimeContainer.classList.remove("irrelevant");
			} else {
				this.travelTimeCancelButton.textContent = "Undo";
				this.travelTimeCancelButton.dataset["data"] = JSON.stringify({ value: travelTime });
				this.travelTimeContainer.classList.add("irrelevant");
			}
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
			const scheduledTravelTime =
				(this.state.end || 0) % 2 === 0 ? this.options.travelTime["away"] : this.options.travelTime["home"];

			// timeoutTimeRemaining includes travel time
			const travelTime = Math.max(0, this.state.timeoutTimeRemaining - this.options.timeoutTime);

			const timeoutTimer = new TimeMinder(
				(this.state.timeoutTimeRemaining - travelTime) * this.lengthOfSecond,
				undefined,
				() => {
					this.travelTimeCancelButton.textContent = "No coach";
					this.travelTimeCancelButton.dataset["data"] = JSON.stringify({ value: -1 * scheduledTravelTime });
					this.travelTimeContainer.classList.remove("irrelevant");
				},
			);
			timeoutTimer.every(
				this.lengthOfSecond / 10,
				isImmediateInvocation => {
					if (
						this.options.timeoutTime >= this.state.timeoutTimeRemaining + scheduledTravelTime ||
						(this.travelTimeCancelButton.textContent === "No coach" && !isImmediateInvocation)
					) {
						this.travelTimeCancelButton.disabled = true;
					} else {
						this.travelTimeCancelButton.disabled = false;
					}
					setTimeToElem(this.timeoutTimeText, timeoutTimer.getTimeRemaining() / this.lengthOfSecond);
				},
				false,
				true,
			);
			const travelTimer = new TimeMinder(travelTime * this.lengthOfSecond, () => {
				timeoutTimer.start();
				this.runningTimers.push(timeoutTimer);
				this.travelTimeContainer.classList.add("irrelevant");
			});
			travelTimer.every(
				this.lengthOfSecond / 10,
				() => {
					setTimeToElem(this.travelTimeValue, travelTimer.getTimeRemaining() / this.lengthOfSecond);
				},
				false,
				true,
			);
			if (travelTime > 0) {
				this.travelTimeCancelButton.dataset["data"] = JSON.stringify({ value: scheduledTravelTime * -1 });
				this.travelTimeContainer.classList.remove("irrelevant");
				travelTimer.start();
				this.runningTimers.push(travelTimer);
			} else {
				timeoutTimer.start();
				this.runningTimers.push(timeoutTimer);
				this.travelTimeContainer.classList.add("irrelevant");
			}
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

	protected initElements(template: Element) {
		this.populateElements(template);

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
		if (this.elements["travel-time-cancel"] && this.elements["travel-time-cancel"][0]) {
			this.travelTimeCancelButton = this.elements["travel-time-cancel"][0] as HTMLButtonElement;
		}
		if (this.elements["travel-time-container"] && this.elements["travel-time-container"][0]) {
			this.travelTimeContainer = this.elements["travel-time-container"][0] as HTMLElement;
		}
		if (this.elements["travel-time-value"] && this.elements["travel-time-value"][0]) {
			this.travelTimeValue = this.elements["travel-time-value"][0] as HTMLElement;
		}
	}
}

function secondsToStr(seconds: number) {
	const clampedSeconds = Math.max(0, seconds);
	const h = Math.floor(clampedSeconds / 3600);
	const m = Math.floor((clampedSeconds - 3600 * h) / 60);
	const s = roundPrecision(clampedSeconds - h * 3600 - m * 60, 0);
	const slz = s < 10 ? "0" + String(s) : String(s);
	const mlz = h > 0 && m < 10 ? "0" + String(m) : String(m);
	const hwcolon = h > 0 ? String(h) + ":" : "";
	return `${hwcolon}${mlz}:${slz}`;
}

function strToSeconds(str: string) {
	const sanitized = str.trim();
	const justSeconds = sanitized.match(/^(\d+)\s*((s|sec|second|seconds)\.?)?$/);
	if (justSeconds && justSeconds.length >= 2) {
		// Just one number - assume seconds
		return Number(justSeconds[1]);
	}

	const colonTime = sanitized.match(/^(\d*):(\d*)$/);
	if (colonTime && colonTime.length >= 3) {
		// In the format of mm:ss, e.g. 8:22, :56, or 20:
		return 60 * Number(colonTime[1]) + Number(colonTime[2]);
	}

	const verbose = sanitized
		.replace(",", "")
		.match(
			/^(?:(\d+)\s*(?:(?:h|hr|hrs|hour|hours)\.?))?\s*(?:(\d+)\s*(?:(?:m|min|mins|minute|minutes)\.?))?\s*(?:(\d+)\s*(?:(?:s|sec|secs|second|seconds)\.?))?$/,
		);
	if (verbose && verbose.length >= 4) {
		// In the format of hh hours mm minutes ss seconds, e.g.
		// 2h3m1s, 3 hours, 1 hour, 2 minutes, 3 seconds, etc.
		return 3600 * Number(verbose[1] || "0") + 60 * Number(verbose[2] || "0") + Number(verbose[3] || "0");
	}

	return null;
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
