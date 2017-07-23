import { TimerUIBase } from "./TimerUIBase";
import { SimpleTimerState, SimpleTimerOptions, SimpleStateAndOptions } from "./interfaces";
import { registerTimerType, TimeToCurl } from "./TimeToCurl";
import { setTimeToElem } from "./util";

export class SimpleTimerUI extends TimerUIBase<SimpleTimerState, SimpleTimerOptions> {
	protected addMinuteButton: HTMLButtonElement;
	protected addSecondButton: HTMLButtonElement;
	protected debugElement: HTMLElement;
	protected pacingElement: HTMLElement;
	protected pauseButton: HTMLButtonElement;
	protected remainingTime: HTMLElement;
	protected startButton: HTMLButtonElement;

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
		if (this.elements["fullscreen-button"] && this.elements["fullscreen-button"][0]) {
			this.fullScreenButton = this.elements["fullscreen-button"][0] as HTMLButtonElement;
		}
	}
}

registerTimerType(SimpleTimerUI, cm => cm.type === "standard");
