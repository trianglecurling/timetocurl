"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fscreen_1 = require("fscreen");
const util_1 = require("./util");
const IGNORE_HOTKEY_TYPES = [HTMLInputElement, HTMLButtonElement, HTMLTextAreaElement, HTMLSelectElement];
class TimerUIBase {
    constructor(initParams, container, application) {
        this.container = container;
        this.application = application;
        this.elements = {};
        this.state = initParams.state;
        this.options = initParams.options;
        this.runningTimers = [];
        if (initParams.options.lengthOfSecond) {
            this.lengthOfSecond = initParams.options.lengthOfSecond;
        }
    }
    handleFullscreenToggled() {
        if (fscreen_1.default.fullscreenElement) {
            fscreen_1.default.exitFullscreen();
        }
        else {
            fscreen_1.default.requestFullscreen(this.timerContainerElement);
        }
    }
    initUI() {
        const template = document.getElementById(this.getTemplateId()).children.item(0);
        const newUI = template.cloneNode(true);
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
            this.fullScreenButton.addEventListener("click", this.handleFullscreenToggled.bind(this));
        }
        document.addEventListener("keydown", event => {
            if (!event.defaultPrevented && event.key === " " && !util_1.instanceOfAny(event.target, IGNORE_HOTKEY_TYPES)) {
                this.handleFullscreenToggled();
            }
        });
        fscreen_1.default.addEventListener("fullscreenchange", () => {
            if (fscreen_1.default.fullscreenElement) {
                this.fullScreenButton.classList.add("exit");
                this.fullScreenButton.classList.remove("enter");
            }
            else {
                this.fullScreenButton.classList.add("enter");
                this.fullScreenButton.classList.remove("exit");
            }
        });
    }
    scrollIntoView() {
        this.timerContainerElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }
    clearTimers() {
        if (this.runningTimers) {
            this.runningTimers.forEach(t => t.dispose());
            this.runningTimers = [];
        }
    }
    async sendCommand(command, data) {
        const result = await this.application.emitAction({
            request: "QUERY_TIMER",
            clientId: util_1.clientId,
            options: {
                command: command,
                data: JSON.stringify(data),
                timerId: this.state.id,
            },
        });
    }
    forEachAction(callback) {
        for (const action in this.elements) {
            for (const elem of this.elements[action]) {
                const actionAttr = elem.dataset["action"];
                if (elem.tagName.toLowerCase() === "button" && actionAttr) {
                    callback.call(null, elem, actionAttr);
                }
            }
        }
    }
    forEachCommand(callback) {
        for (const commandKey in this.elements) {
            const splitCommand = commandKey.split(":");
            let command = commandKey;
            let team = null;
            if (splitCommand.length === 2) {
                team = splitCommand[0];
                command = splitCommand[1];
            }
            for (const elem of this.elements[commandKey]) {
                const commandAttr = elem.dataset["command"];
                if (elem.tagName.toLowerCase() === "button" && commandAttr) {
                    callback.call(null, elem, commandAttr, team);
                }
            }
        }
    }
    populateElements(elem, teamContext = null) {
        let key = "";
        const elemData = elem.dataset["key"] || elem.dataset["action"];
        if (elemData) {
            key = elemData;
        }
        else {
            const nonTeamClasses = Array.prototype.filter.call(elem.classList, (c) => c.substr(0, 5) !== "team");
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
exports.TimerUIBase = TimerUIBase;
