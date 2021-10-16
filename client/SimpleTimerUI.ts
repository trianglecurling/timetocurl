import { TimerUIBase } from "./TimerUIBase";
import { SimpleTimerState, SimpleTimerOptions, SimpleStateAndOptions } from "./interfaces";
import { registerTimerType, TimeToCurl } from "./TimeToCurl";
import { setTimeToElem, roundPrecision, getOrdinalAdjective, refitScaledElements } from "./util";
import { TimeMinder } from "./time-minder";

export class SimpleTimerUI extends TimerUIBase<SimpleTimerState, SimpleTimerOptions> {
	protected addMinuteButton: HTMLButtonElement;
	protected addSecondButton: HTMLButtonElement;
	private currentMode: "normal" | "warning" | "noMoreEnds" = "normal";
	protected debugElement: HTMLElement;
	protected pacingElement: HTMLElement;
	protected pacingMessage: HTMLElement;
	protected pacingProgress: HTMLElement;
	protected pauseButton: HTMLButtonElement;
	protected remainingTime: HTMLElement;
	protected startButton: HTMLButtonElement;
	private lastTimeSet: number = 0;

	public static readonly timerType = "simple";

	constructor(initParams: SimpleStateAndOptions, protected container: HTMLElement, protected application: TimeToCurl) {
		super(initParams, container, application);
	}

	public initUI() {
		super.initUI();

		this.forEachCommand((elem: HTMLButtonElement, command: string, team: string | null) => {
			elem.addEventListener("click", () => {
				const data = JSON.parse(elem.dataset["data"] || "{}");
				this.sendCommand(command, data);
			});
		});

		this.setNewState(this.state);
	}

	protected getTemplateId() {
		return "simpleTimerTemplate";
	}

	public setNewState(state: SimpleTimerState): void {
		this.debugElement.textContent = JSON.stringify(state, null, 4);
		this.state = state;
		this.clearTimers();
		this.titleElement.textContent = this.state.timerName;

		const mainTimer = new TimeMinder(this.state.timeRemaining * this.lengthOfSecond, () => {
			if (this.options.sounds.end) {
				try {
					new Audio(this.options.sounds.end).play();
				} catch (e) {
					console.warn("Error playing audio.");
				}
			}
			this.timerContainerElement.classList.remove("warning", "pregame");
			this.timerContainerElement.classList.add("no-more-ends");
			this.pacingElement.classList.add("invisible");
		});

		mainTimer.every(
			this.lengthOfSecond / 10,
			() => {
				const timeRemaining = mainTimer.getTimeRemaining() / this.lengthOfSecond;
				const isPregame = timeRemaining > this.options.totalTime;
				let renderPacing = this.options.showPacing && !isPregame;

				const timeToSet = isPregame ? -1 * (timeRemaining - this.options.totalTime) : timeRemaining;

				const refit = timeToSet !== this.lastTimeSet;
				this.lastTimeSet = timeToSet;
				setTimeToElem(this.remainingTime, timeToSet, isPregame);

				if (refit) {
					refitScaledElements();
				}

				// We're in the pre-game phase
				if (isPregame) {
					this.timerContainerElement.classList.remove("warning", "no-more-ends");
					this.timerContainerElement.classList.add("pregame");
				} else if (timeRemaining <= this.options.noMoreEndsTime) {
					if (this.currentMode !== "noMoreEnds") {
						this.timerContainerElement.classList.remove("warning", "pregame");
						this.timerContainerElement.classList.add("no-more-ends");
						if (this.options.sounds.noMoreEnds) {
							new Audio(this.options.sounds.noMoreEnds).play();
						}
						this.currentMode = "noMoreEnds";
					}
					renderPacing = false;
				} else if (timeRemaining <= this.options.warningTime) {
					if (this.currentMode !== "warning") {
						this.timerContainerElement.classList.remove("no-more-ends", "pregame");
						this.timerContainerElement.classList.add("warning");
						if (this.options.sounds.warning) {
							new Audio(this.options.sounds.warning).play();
						}
						this.currentMode = "warning";
					}
				} else {
					this.currentMode = "normal";
					this.timerContainerElement.classList.remove("warning", "no-more-ends", "pregame");
				}
				if (renderPacing) {
					this.pacingElement.classList.remove("invisible");
					this.renderPacing(mainTimer);
				} else {
					this.pacingElement.classList.add("invisible");
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

	private renderPacing(timer: TimeMinder) {
		const ends = this.options.numEnds;
		const totalTimeUntilRed = this.options.totalTime - this.options.noMoreEndsTime;
		const elapsedTime = this.options.totalTime - timer.getTimeRemaining() / this.options.lengthOfSecond;

		// Subtract 1 because we assume teams will be allowed to finish their current end.
		const endsToPlayBeforeRed = ends - this.options.allowableAdditionalEnds - 1;

		const timePerEnd = totalTimeUntilRed / endsToPlayBeforeRed;
		const parEnd = Math.floor(elapsedTime / timePerEnd) + 1;
		const fractionThroughEnd = (elapsedTime % timePerEnd) / timePerEnd;

		this.pacingMessage.textContent = "End " + parEnd;

		const pacingPercentage = roundPrecision(fractionThroughEnd * 100, 2);
		this.pacingProgress.setAttribute("value", String(pacingPercentage));
		this.pacingProgress.textContent = pacingPercentage + "%";
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
		if (this.elements["fullscreen-button"] && this.elements["fullscreen-button"][0]) {
			this.fullScreenButton = this.elements["fullscreen-button"][0] as HTMLButtonElement;
		}
		if (this.elements["pacing"] && this.elements["pacing"][0]) {
			this.pacingElement = this.elements["pacing"][0] as HTMLElement;
		}
		if (this.elements["pacing-message"] && this.elements["pacing-message"][0]) {
			this.pacingMessage = this.elements["pacing-message"][0] as HTMLElement;
		}
		if (this.elements["pacing-progress"] && this.elements["pacing-progress"][0]) {
			this.pacingProgress = this.elements["pacing-progress"][0] as HTMLElement;
		}
	}
}

registerTimerType(SimpleTimerUI, cm => cm.type === SimpleTimerUI.timerType);
