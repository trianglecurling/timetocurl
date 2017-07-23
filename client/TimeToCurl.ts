import confirm from "./confirm";
import {
	IMap,
	SimpleTimerOptions,
	StandardTimerOptions,
	TimerType,
	SocketResponse,
	ActionMessage,
	StandardStateAndOptions,
	SocketAction,
	StateAndOptions,
	TimerDecider,
	TimerUI,
	TimerUIConstructor,
} from "./interfaces";
import { TimerUIBase } from "./TimerUIBase";
import { cloneDeep, isEqual } from "lodash";
import { SimpleBaseOptions, StandardBaseOptions, TimerPresets } from "./presets";
import {
	getDisplayedTimers,
	secondsToStr,
	strToSeconds,
	clientId,
	uuid,
	isSimpleTimer,
	isStandardTimer,
	setTimersInHash,
} from "./util";

export class TimeToCurl {
	private socket: SocketIOClient.Socket;
	private requests: { [key: string]: any };
	private requestResolvers: { [key: string]: (value?: any | PromiseLike<any>) => void };
	private machines: IMap<TimerUI>;
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

			document.getElementById("createTimer")!.addEventListener("click", async event => {
				(event.target as HTMLButtonElement).textContent = "Reset";
				if (Object.keys(this.machines).length > 0) {
					if (await confirm("Reset timers. Are you sure?")) {
						window.location.href = "/";
					}
				} else {
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
				}
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
		this.machines[cm.state.id] = new (this.getMatchingTimer(cm))(
			cm,
			document.getElementById("timersContainer")!,
			this,
		);
		this.machines[cm.state.id].initUI();
		const displayedTimers = getDisplayedTimers();
		if (displayedTimers.indexOf(cm.state.id) === -1) {
			displayedTimers.push(cm.state.id);
		}
		setTimersInHash(displayedTimers);
		return this.machines[cm.state.id];
	}

	private getMatchingTimer(cm: StateAndOptions) {
		for (const registeredTimer of timerTypes) {
			if (registeredTimer.decider(cm)) {
				return registeredTimer.timer;
			}
		}
		throw new Error("Could not find a suitable UI for this timer.");
	}
}

const timerTypes: { decider: TimerDecider; timer: TimerUIConstructor }[] = [];
export function registerTimerType(timer: TimerUIConstructor, decider: TimerDecider) {
	timerTypes.push({ timer, decider });
}
