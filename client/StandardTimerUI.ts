import { TimerUIBase } from "./TimerUIBase";
import { CurlingMachineState, StandardTimerOptions, IMap, StandardStateAndOptions } from "./interfaces";
import { registerTimerType, TimeToCurl } from "./TimeToCurl";
import { secondsToStr, strToSeconds, setTimeToElem, clientId, invalidateScaledText, refitScaledElements } from "./util";
import confirm from "./confirm";
import { Stopwatch, TimeMinder } from "./time-minder";

export class StandardTimerUI extends TimerUIBase<CurlingMachineState, StandardTimerOptions> {
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

	public static readonly timerType = "standard";

	constructor(
		initParams: StandardStateAndOptions,
		protected container: HTMLElement,
		protected application: TimeToCurl,
	) {
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

	protected getTemplateId() {
		return "timerTemplate";
	}

	public initUI() {
		super.initUI();

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
	}

	public getState() {
		return { ...this.state };
	}

	public dispose() { }

	public setNewState(state: CurlingMachineState) {
		invalidateScaledText();
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

		// Title, root class changes
		this.titleElement.textContent = this.state.timerName;
		this.rootTimerElement.classList.remove(this.rootTimerElement.dataset["phase"]!);
		this.rootTimerElement.dataset["phase"] = this.state.phase;
		this.rootTimerElement.classList.add(this.rootTimerElement.dataset["phase"]!);

		this.clearTimers();

		// Hide time adjustment controls when timers are running
		if (this.state.phase === "thinking") {
			Object.keys(this.timeControls).forEach(k => {
				for (const elem of this.timeControls[k]) {
					elem.classList.add("invisible");
				}
			});
		} else {
			Object.keys(this.timeControls).forEach(k => {
				for (const elem of this.timeControls[k]) {
					elem.classList.remove("invisible");
				}
			});
		}
		refitScaledElements();
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
				(isImmediateInvocation: boolean) => {
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

		if (this.state.phase === "idle") {
			this.elements["game-start-warmup"][0].classList.add("irrelevant");
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
		if (this.elements["fullscreen-button"] && this.elements["fullscreen-button"][0]) {
			this.fullScreenButton = this.elements["fullscreen-button"][0] as HTMLButtonElement;
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

registerTimerType(StandardTimerUI, cm => cm.type === StandardTimerUI.timerType);
