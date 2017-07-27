"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TimerUIBase_1 = require("./TimerUIBase");
const TimeToCurl_1 = require("./TimeToCurl");
const util_1 = require("./util");
class SimpleTimerUI extends TimerUIBase_1.TimerUIBase {
    constructor(initParams, container, application) {
        super(initParams, container, application);
        this.container = container;
        this.application = application;
    }
    initUI() {
        super.initUI();
        this.forEachCommand((elem, command, team) => {
            elem.addEventListener("click", () => {
                const data = JSON.parse(elem.dataset["data"] || "{}");
                this.sendCommand(command, data);
            });
        });
        this.setNewState(this.state);
    }
    getTemplateId() {
        return "simpleTimerTemplate";
    }
    setNewState(state) {
        this.debugElement.textContent = JSON.stringify(state, null, 4);
        this.state = state;
        this.clearTimers();
        this.titleElement.textContent = this.state.timerName;
        const mainTimer = new TimeMinder(this.state.timeRemaining * this.lengthOfSecond);
        mainTimer.every(this.lengthOfSecond / 10, () => {
            const timeRemaining = mainTimer.getTimeRemaining() / this.lengthOfSecond;
            util_1.setTimeToElem(this.remainingTime, mainTimer.getTimeRemaining() / this.lengthOfSecond);
            this.timerContainerElement.classList.remove("warning");
            this.timerContainerElement.classList.remove("no-more-ends");
            if (timeRemaining <= this.options.noMoreEndsTime) {
                this.timerContainerElement.classList.add("no-more-ends");
            }
            else if (timeRemaining <= this.options.warningTime) {
                this.timerContainerElement.classList.add("warning");
            }
        }, false);
        this.runningTimers.push(mainTimer);
        if (this.state.timerIsRunning) {
            mainTimer.start();
            this.pauseButton.classList.remove("irrelevant");
            this.startButton.classList.add("irrelevant");
        }
        else {
            this.pauseButton.classList.add("irrelevant");
            this.startButton.classList.remove("irrelevant");
        }
    }
    initElements(template) {
        this.populateElements(template);
        if (this.elements["debug"] && this.elements["debug"][0]) {
            this.debugElement = this.elements["debug"][0];
        }
        if (this.elements["timer"] && this.elements["timer"][0]) {
            this.rootTimerElement = this.elements["timer"][0];
        }
        if (this.elements["timer-container"] && this.elements["timer-container"][0]) {
            this.timerContainerElement = this.elements["timer-container"][0];
        }
        if (this.elements["start-timer"] && this.elements["start-timer"][0]) {
            this.startButton = this.elements["start-timer"][0];
        }
        if (this.elements["pause-timer"] && this.elements["pause-timer"][0]) {
            this.pauseButton = this.elements["pause-timer"][0];
        }
        if (this.elements["timer-title"] && this.elements["timer-title"][0]) {
            this.titleElement = this.elements["timer-title"][0];
        }
        if (this.elements["remaining-time"] && this.elements["remaining-time"][0]) {
            this.remainingTime = this.elements["remaining-time"][0];
        }
        if (this.elements["fullscreen-button"] && this.elements["fullscreen-button"][0]) {
            this.fullScreenButton = this.elements["fullscreen-button"][0];
        }
    }
}
exports.SimpleTimerUI = SimpleTimerUI;
TimeToCurl_1.registerTimerType(SimpleTimerUI, cm => cm.type === "standard");
