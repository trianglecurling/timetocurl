import { TimerUIBase } from "./TimerUIBase";
import { SimpleTimerState, SimpleTimerOptions, SimpleStateAndOptions } from "./interfaces";
import { registerTimerType, TimeToCurl } from "./TimeToCurl";
import { setTimeToElem, roundPrecision, getOrdinalAdjective } from "./util";
import { TimeMinder } from "./time-minder";

export class SimpleTimerUI extends TimerUIBase<SimpleTimerState, SimpleTimerOptions> {
	protected addMinuteButton: HTMLButtonElement;
	protected addSecondButton: HTMLButtonElement;
	private currentMode: "normal" | "warning" | "noMoreEnds" = "normal";
	protected debugElement: HTMLElement;
	protected pacingElement: HTMLElement;
	protected pacingTitle: HTMLElement;
	protected pacingOrdinal: HTMLElement;
	protected pacingProgress: HTMLElement;
	protected pauseButton: HTMLButtonElement;
	protected remainingTime: HTMLElement;
	protected startButton: HTMLButtonElement;

	public static readonly timerType = "simple";

	constructor(
		initParams: SimpleStateAndOptions,
		protected container: HTMLElement,
		protected application: TimeToCurl,
	) {
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
				new Audio(this.options.sounds.end).play();
			}
		});

		mainTimer.every(
			this.lengthOfSecond / 10,
			() => {
				let renderPacing = this.options.showPacing;
				const timeRemaining = mainTimer.getTimeRemaining() / this.lengthOfSecond;
				setTimeToElem(this.remainingTime, mainTimer.getTimeRemaining() / this.lengthOfSecond);

				if (timeRemaining <= this.options.noMoreEndsTime) {
					if (this.currentMode !== "noMoreEnds") {
						this.timerContainerElement.classList.remove("warning");
						this.timerContainerElement.classList.add("no-more-ends");
						if (this.options.sounds.noMoreEnds) {
							new Audio(this.options.sounds.noMoreEnds).play();
						}
						this.currentMode = "noMoreEnds";
					}
					renderPacing = false;
				} else if (timeRemaining <= this.options.warningTime) {
					if (this.currentMode !== "warning") {
						this.timerContainerElement.classList.remove("no-more-ends");
						this.timerContainerElement.classList.add("warning");
						if (this.options.sounds.warning) {
							new Audio(this.options.sounds.warning).play();
						}
						this.currentMode = "warning";
					}
				} else {
					this.currentMode = "normal";
					this.timerContainerElement.classList.remove("warning");
					this.timerContainerElement.classList.remove("no-more-ends");
				}
				if (renderPacing) {
					this.pacingElement.classList.remove("irrelevant");
					this.renderPacing(mainTimer);
				} else {
					this.pacingElement.classList.add("irrelevant");
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
		const fractionThroughEnd = elapsedTime % timePerEnd / timePerEnd;

		const ordinalElem = getOrdinalAdjective(parEnd);
		this.pacingOrdinal.parentNode!.replaceChild(ordinalElem, this.pacingOrdinal);
		this.pacingOrdinal = ordinalElem;
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
		if (this.elements["pacing-title"] && this.elements["pacing-title"][0]) {
			this.pacingTitle = this.elements["pacing-title"][0] as HTMLElement;
		}
		if (this.elements["pacing-ordinal"] && this.elements["pacing-ordinal"][0]) {
			this.pacingOrdinal = this.elements["pacing-ordinal"][0] as HTMLElement;
		}
		if (this.elements["pacing-progress"] && this.elements["pacing-progress"][0]) {
			this.pacingProgress = this.elements["pacing-progress"][0] as HTMLElement;
		}
	}
}

registerTimerType(SimpleTimerUI, cm => cm.type === SimpleTimerUI.timerType);
