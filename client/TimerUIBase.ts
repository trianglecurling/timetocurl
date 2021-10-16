import fscreen from "fscreen";
import { BaseTimerState, TimerOptions, IMap, StateAndOptions, TimerUI } from "./interfaces";
import { TimeToCurl } from "./TimeToCurl";
import { instanceOfAny, clientId } from "./util";
import { Stopwatch } from "./time-minder";

const IGNORE_HOTKEY_TYPES = [HTMLInputElement, HTMLButtonElement, HTMLTextAreaElement, HTMLSelectElement];

export abstract class TimerUIBase<TState extends BaseTimerState = BaseTimerState, TOptions extends TimerOptions = TimerOptions>
	implements TimerUI {
	protected elements: IMap<Element[]>;
	protected fullScreenButton!: HTMLButtonElement;
	protected lengthOfSecond!: number;
	protected options: TOptions;
	protected rootTimerElement!: HTMLElement;
	protected runningTimers: Stopwatch[];
	protected state: TState;
	protected timerContainerElement!: HTMLElement;
	protected titleElement!: HTMLElement;

	constructor(initParams: StateAndOptions<TState, TOptions>, protected container: HTMLElement, protected application: TimeToCurl) {
		this.elements = {};
		this.state = initParams.state;
		this.options = initParams.options;
		this.runningTimers = [];
		if (initParams.options.lengthOfSecond) {
			this.lengthOfSecond = initParams.options.lengthOfSecond;
		}
	}

	protected abstract getTemplateId(): string;

	public toggleFullscreen() {
		if (fscreen.fullscreenElement) {
			fscreen.exitFullscreen();
		} else {
			fscreen.requestFullscreen(this.timerContainerElement);
		}
	}

	public initUI() {
		const template = document.getElementById(this.getTemplateId())!.children!.item(0)!;
		const newUI = template.cloneNode(true) as Element;
		this.initElements(newUI);
		this.container.appendChild(newUI);

		// set up click-to-scroll
		if (this.titleElement) {
			this.titleElement.addEventListener("click", () => {
				this.scrollIntoView();
			});
		}

		// full screen mode
		if (this.fullScreenButton) {
			this.fullScreenButton.addEventListener("click", this.toggleFullscreen.bind(this));
		}

		document.addEventListener("keydown", event => {
			if (!event.defaultPrevented && event.key === " " && !instanceOfAny(event.target, IGNORE_HOTKEY_TYPES)) {
				this.toggleFullscreen();
			}
		});

		fscreen.addEventListener("fullscreenchange", () => {
			if (fscreen.fullscreenElement) {
				this.fullScreenButton.classList.add("exit");
				this.fullScreenButton.classList.remove("enter");
			} else {
				this.fullScreenButton.classList.add("enter");
				this.fullScreenButton.classList.remove("exit");
			}
		});
	}

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
					callback.call(null, elem as HTMLButtonElement, actionAttr);
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
					callback.call(null, elem as HTMLButtonElement, commandAttr, team);
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
			const nonTeamClasses = Array.prototype.filter.call(elem.classList, (c: string) => c.substr(0, 5) !== "team");
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
				this.populateElements(elem.children.item(i)!, foundTeamContext);
			}
		}
	}
}
