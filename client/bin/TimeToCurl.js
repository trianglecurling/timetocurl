"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const confirm_1 = require("./confirm");
const lodash_1 = require("lodash");
const presets_1 = require("./presets");
const util_1 = require("./util");
class TimeToCurl {
    constructor() {
        this.speedyClocks = false;
    }
    init() {
        this.setUpEvents();
        this.socket = io();
        this.requests = {};
        this.requestResolvers = {};
        this.machines = {};
        this.machineOrder = {};
        this.nextSimpleTimerOptions = lodash_1.cloneDeep(presets_1.SimpleBaseOptions);
        this.nextStandardTimerOptions = lodash_1.cloneDeep(presets_1.StandardBaseOptions);
        this.nextTimerType = "standard" /* Standard */;
        this.socket.on("response", (result) => {
            let response;
            try {
                response = JSON.parse(result);
            }
            catch (ex) {
                throw new Error(`Could not parse response as JSON: ${result}`);
            }
            // Did we ask for this data?
            if (this.requestResolvers[response.token]) {
                this.requests[response.token] = response;
                this.requestResolvers[response.token].call(this, response);
            }
            else {
                console.warn(`Unexpected data from the server: ${result}`);
            }
        });
        this.socket.on("statechange", (message) => {
            const receivedMessage = JSON.parse(message);
            switch (receivedMessage.message) {
                case "SET_STATE":
                    this.machines[receivedMessage.machineId].setNewState(receivedMessage.data.state);
                    break;
                default:
                    throw new Error("Received an action that we didn't know how to handle... " + message);
            }
        });
        this.loadTimers(util_1.getDisplayedTimers());
    }
    async loadTimers(ids) {
        for (const timerId of ids) {
            const timer = await this.emitAction({
                request: "GET_TIMER",
                options: { timerId },
            });
            if (this.machines[timerId]) {
                this.machines[timerId].setNewState(timer.data.state);
            }
            else {
                this.addCurlingMachine(timer.data);
            }
        }
    }
    populateTimerOptions() {
        const simpleGroup = document.createElement("optgroup");
        simpleGroup.setAttribute("label", "Basic timers");
        const standardGroup = document.createElement("optgroup");
        standardGroup.setAttribute("label", "Full timers");
        for (const preset of presets_1.TimerPresets) {
            const option = document.createElement("option");
            option.value = preset.id;
            option.textContent = preset.name;
            if (preset.type === "simple" /* Simple */) {
                simpleGroup.appendChild(option);
            }
            else {
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
    restoreSettingsFromStorage() {
        const speedyClocks = window.localStorage["speedy-clocks"];
        const showDebug = window.localStorage["show-debug"];
        const simpleTimerOptions = window.localStorage["simple-timer-options"];
        const standardTimerOptions = window.localStorage["standard-timer-options"];
        const theme = window.localStorage["theme"];
        const timerType = window.localStorage["timer-type"];
        const speedyClocksCheckbox = document.getElementById("speedyClocks");
        const showDebugCheckbox = document.getElementById("showDebug");
        const themeSelect = document.getElementById("themeSelector");
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
    simpleInput(labelText, id, defaultValue) {
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
    checkboxInput(label, checked = false, onChange) {
        const showPacing = document.createElement("div");
        showPacing.classList.add("simple-input");
        const showPacingLabel = document.createElement("label");
        showPacingLabel.textContent = label;
        showPacingLabel.classList.add("simple-input-label");
        showPacingLabel.setAttribute("for", "showPacingCheckbox");
        const showPacingCheckbox = document.createElement("input");
        showPacingCheckbox.setAttribute("id", "showPacingCheckbox");
        showPacingCheckbox.setAttribute("type", "checkbox");
        showPacingCheckbox.setAttribute("value", "true");
        showPacingCheckbox.checked = checked;
        showPacingCheckbox.classList.add("simple-input-field");
        const previewDummy = document.createElement("div");
        previewDummy.classList.add("input-value-preview");
        showPacing.appendChild(showPacingLabel);
        showPacing.appendChild(showPacingCheckbox);
        showPacing.appendChild(previewDummy);
        if (onChange) {
            showPacingCheckbox.addEventListener("change", () => {
                onChange(showPacingCheckbox.checked);
            });
        }
        return showPacing;
    }
    evaluatePresetDropdown() {
        for (const preset of presets_1.TimerPresets) {
            if (this.nextTimerType === "standard" /* Standard */ && lodash_1.isEqual(preset.options, this.nextStandardTimerOptions)) {
                this.timerPresetsDropdown.value = preset.id;
                return;
            }
            if (this.nextTimerType === "simple" /* Simple */ && lodash_1.isEqual(preset.options, this.nextSimpleTimerOptions)) {
                this.timerPresetsDropdown.value = preset.id;
                return;
            }
        }
        this.timerPresetsDropdown.value = "custom";
    }
    getRadioValue(...radios) {
        for (const radio of radios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return null;
    }
    async customizeSettings() {
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
        if (this.nextTimerType === "simple" /* Simple */) {
            simpleRadioInput.checked = true;
        }
        const simpleRadioLabel = document.createElement("label");
        simpleRadioLabel.setAttribute("for", "simpleRadioButton");
        simpleRadioLabel.setAttribute("title", "Simple timer that counts down to zero. No active timekeeping required.");
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
        if (this.nextTimerType === "standard" /* Standard */) {
            standardRadioInput.checked = true;
        }
        const standardRadioLabel = document.createElement("label");
        standardRadioLabel.setAttribute("for", "standardRadioButton");
        standardRadioLabel.setAttribute("title", "Full timer with thinking time, timeouts, between end time, etc. Requires a dedicated timekeeper.");
        standardRadioLabel.textContent = "Standard";
        standardRadio.appendChild(standardRadioInput);
        standardRadio.appendChild(standardRadioLabel);
        simpleOrStandard.appendChild(radioGroupLabel);
        simpleOrStandard.appendChild(simpleRadio);
        simpleOrStandard.appendChild(standardRadio);
        const standardOptions = this.nextStandardTimerOptions;
        const thinkingTime = this.simpleInput("Thinking time", "thinkingTime", util_1.secondsToStr(standardOptions.thinkingTime));
        const numEndsStandard = this.simpleInput("Number of ends", "numEnds", standardOptions.numEnds);
        const extraEndThinkingTime = this.simpleInput("Thinking time added for an extra end", "extraEndThinkingTime", util_1.secondsToStr(standardOptions.extraEndThinkingTime));
        const numTimeouts = this.simpleInput("Number of timeouts per team", "numTimeouts", standardOptions.numTimeouts);
        const timeoutTime = this.simpleInput("Timeout time", "timeoutTime", util_1.secondsToStr(standardOptions.timeoutTime));
        const homeTravelTime = this.simpleInput("Travel time (home end)", "homeTravelTime", util_1.secondsToStr(standardOptions.travelTime.home));
        const awayTravelTime = this.simpleInput("Travel time (away end)", "awayTravelTime", util_1.secondsToStr(standardOptions.travelTime.away));
        const warmupTime = this.simpleInput("Warmup time", "warmupTime", util_1.secondsToStr(standardOptions.warmupTime));
        const betweenEndTime = this.simpleInput("Time between ends", "betweenEndTime", util_1.secondsToStr(standardOptions.betweenEndTime));
        const midGameBreakTime = this.simpleInput("Mid game break time", "midGameBreakTime", util_1.secondsToStr(standardOptions.midGameBreakTime));
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
        const totalTime = this.simpleInput("Total time", "totalTime", util_1.secondsToStr(simpleOptions.totalTime));
        const endTime = this.simpleInput("Turn red at", "noMoreEndsTime", util_1.secondsToStr(simpleOptions.noMoreEndsTime));
        const warningTime = this.simpleInput("Turn yellow at", "warningTime", util_1.secondsToStr(simpleOptions.warningTime));
        const additionalEnds = this.simpleInput("Ends allowed after timer turns red", "allowableAdditionalEnds", simpleOptions.allowableAdditionalEnds);
        const numEndsSimple = this.simpleInput("Number of ends", "numEnds", simpleOptions.numEnds);
        // const startSound = this.simpleInput("Start sound", "startSound");
        // const endSound = this.simpleInput("End sound", "endSound");
        // const warningSound = this.simpleInput("Warning sound", "warningSound");
        // const noMoreEndsSound = this.simpleInput("No more ends sound", "noMoreEndsSound");
        const showPacing = this.checkboxInput("Show recommended pacing", simpleOptions.showPacing, checked => {
            simpleOptions.showPacing = checked;
            this.evaluatePresetDropdown();
            this.saveTimerOptions();
        });
        const playSoundCheckbox = this.checkboxInput("Play sound when timer turns red", !!simpleOptions.sounds.noMoreEnds, checked => {
            simpleOptions.sounds.noMoreEnds = checked ? "cowbell.mp3" : "";
            this.evaluatePresetDropdown();
            this.saveTimerOptions();
        });
        const simpleContainer = document.createElement("div");
        simpleContainer.classList.add("custom-settings-fields-container", "simple-settings", "irrelevant");
        simpleContainer.appendChild(totalTime);
        simpleContainer.appendChild(warningTime);
        simpleContainer.appendChild(endTime);
        simpleContainer.appendChild(additionalEnds);
        simpleContainer.appendChild(numEndsSimple);
        simpleContainer.appendChild(showPacing);
        simpleContainer.appendChild(playSoundCheckbox);
        const onTimerTypeChanged = () => {
            const result = this.getRadioValue(simpleRadioInput, standardRadioInput);
            if (result === "standard") {
                this.nextTimerType = "standard" /* Standard */;
                simpleContainer.classList.add("irrelevant");
                standardContainer.classList.remove("irrelevant");
            }
            else if (result === "simple") {
                this.nextTimerType = "simple" /* Simple */;
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
        const prevStandardSettings = lodash_1.cloneDeep(standardOptions);
        const prevSimpleSettings = lodash_1.cloneDeep(simpleOptions);
        const prevTimerType = this.nextTimerType;
        allOptionsContainer.addEventListener("input", () => {
            const valThinkingTime = util_1.strToSeconds(thinkingTime.children[1].value);
            const valNumEndsStandard = Number(numEndsStandard.children[1].value);
            const valXEndThinkingTime = util_1.strToSeconds(extraEndThinkingTime.children[1].value);
            const valNumTimeouts = Number(numTimeouts.children[1].value);
            const valTimeoutTime = util_1.strToSeconds(timeoutTime.children[1].value);
            const valHomeTravelTime = util_1.strToSeconds(homeTravelTime.children[1].value);
            const valAwayTravelTime = util_1.strToSeconds(awayTravelTime.children[1].value);
            const valWarmupTime = util_1.strToSeconds(warmupTime.children[1].value);
            const valBetweenEndTime = util_1.strToSeconds(betweenEndTime.children[1].value);
            const valMidGameBreakTime = util_1.strToSeconds(midGameBreakTime.children[1].value);
            const valTotalTime = util_1.strToSeconds(totalTime.children[1].value);
            const valEndTime = util_1.strToSeconds(endTime.children[1].value);
            const valWarningTime = util_1.strToSeconds(warningTime.children[1].value);
            const valAdditionalEnds = Number(additionalEnds.children[1].value);
            const valNumEndsSimple = Number(numEndsSimple.children[1].value);
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
            thinkingTime.children[2].textContent = util_1.secondsToStr(standardOptions.thinkingTime);
            numEndsStandard.children[2].textContent = String(standardOptions.numEnds);
            extraEndThinkingTime.children[2].textContent = util_1.secondsToStr(standardOptions.extraEndThinkingTime);
            numTimeouts.children[2].textContent = String(standardOptions.numTimeouts);
            timeoutTime.children[2].textContent = util_1.secondsToStr(standardOptions.timeoutTime);
            homeTravelTime.children[2].textContent = util_1.secondsToStr(standardOptions.travelTime.home);
            awayTravelTime.children[2].textContent = util_1.secondsToStr(standardOptions.travelTime.away);
            warmupTime.children[2].textContent = util_1.secondsToStr(standardOptions.warmupTime);
            betweenEndTime.children[2].textContent = util_1.secondsToStr(standardOptions.betweenEndTime);
            midGameBreakTime.children[2].textContent = util_1.secondsToStr(standardOptions.midGameBreakTime);
            totalTime.children[2].textContent = util_1.secondsToStr(simpleOptions.totalTime);
            endTime.children[2].textContent = util_1.secondsToStr(simpleOptions.noMoreEndsTime);
            warningTime.children[2].textContent = util_1.secondsToStr(simpleOptions.warningTime);
            additionalEnds.children[2].textContent = String(simpleOptions.allowableAdditionalEnds);
            numEndsSimple.children[2].textContent = String(simpleOptions.numEnds);
            this.evaluatePresetDropdown();
            this.saveTimerOptions();
        }, true);
        if (!await confirm_1.default(optionsDialog, "Customize timer settings")) {
            this.nextStandardTimerOptions = prevStandardSettings;
            this.nextSimpleTimerOptions = prevSimpleSettings;
            this.nextTimerType = prevTimerType;
            this.evaluatePresetDropdown();
        }
    }
    setNextTimerOptionsFromDropdown() {
        const dropdownValue = this.timerPresetsDropdown.value;
        const matchedPreset = presets_1.TimerPresets.filter(p => p.id === dropdownValue)[0];
        if (matchedPreset) {
            if (matchedPreset.type === "simple" /* Simple */) {
                this.nextSimpleTimerOptions = lodash_1.cloneDeep(matchedPreset).options;
                this.nextTimerType = "simple" /* Simple */;
            }
            else {
                this.nextStandardTimerOptions = lodash_1.cloneDeep(matchedPreset).options;
                this.nextTimerType = "standard" /* Standard */;
            }
            this.saveTimerOptions();
        }
    }
    saveTimerOptions() {
        window.localStorage["standard-timer-options"] = JSON.stringify(this.nextStandardTimerOptions);
        window.localStorage["simple-timer-options"] = JSON.stringify(this.nextSimpleTimerOptions);
        window.localStorage["timer-type"] = String(this.nextTimerType);
    }
    setUpEvents() {
        document.addEventListener("DOMContentLoaded", async () => {
            this.timerPresetsDropdown = document.getElementById("timerPresets");
            this.populateTimerOptions();
            this.restoreSettingsFromStorage();
            document.getElementById("createTimer").addEventListener("click", async (event) => {
                if (Object.keys(this.machines).length > 0) {
                    if (await confirm_1.default("Reset timers. Are you sure?")) {
                        window.location.href = "/";
                    }
                }
                else {
                    const response = await this.emitAction({
                        request: "CREATE_TIMER",
                        clientId: util_1.clientId,
                        options: Object.assign({}, this.nextTimerType === "simple" /* Simple */
                            ? this.nextSimpleTimerOptions
                            : this.nextStandardTimerOptions, { lengthOfSecond: this.speedyClocks ? 100 : 1000, type: this.nextTimerType }),
                    });
                    this.addCurlingMachine(response.data).scrollIntoView();
                }
            });
            const showDebug = document.getElementById("showDebug");
            showDebug.addEventListener("change", this.onDebugToggled);
            this.timerPresetsDropdown.addEventListener("change", () => {
                if (this.timerPresetsDropdown.value === "custom") {
                    this.customizeSettings();
                }
                else {
                    this.setNextTimerOptionsFromDropdown();
                }
            });
            document.getElementById("speedyClocks").addEventListener("change", this.onSpeedyClocksToggled.bind(this));
            document.getElementById("themeSelector").addEventListener("change", this.onThemeChanged);
            document.getElementById("customizeSettings").addEventListener("click", () => {
                this.customizeSettings();
            });
            window.addEventListener("keydown", (event) => {
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
    onSpeedyClocksToggled() {
        const speedyClocks = document.getElementById("speedyClocks");
        this.speedyClocks = speedyClocks.checked;
        window.localStorage["speedy-clocks"] = this.speedyClocks;
    }
    onDebugToggled() {
        const showDebug = document.getElementById("showDebug");
        const debugElements = document.getElementsByClassName("debug");
        for (let i = 0; i < debugElements.length; ++i) {
            const elem = debugElements.item(i);
            elem.classList[showDebug.checked ? "remove" : "add"]("hidden");
        }
        window.localStorage["show-debug"] = showDebug.checked;
    }
    onThemeChanged() {
        const selector = document.getElementById("themeSelector");
        this.setTheme(selector.value);
        window.localStorage["theme"] = selector.value;
    }
    setTheme(themeName) {
        if (this.currentTheme) {
            document.body.classList.remove(this.currentTheme);
        }
        this.currentTheme = themeName;
        document.body.classList.add(this.currentTheme);
    }
    emitAction(action) {
        return new Promise((resolve, reject) => {
            const token = util_1.uuid();
            action.token = token;
            action.clientId = util_1.clientId;
            this.socket.emit("action", JSON.stringify(action));
            this.requestResolvers[token] = resolve;
        });
    }
    addCurlingMachine(cm) {
        this.machines[cm.state.id] = new (this.getMatchingTimer(cm))(cm, document.getElementById("timersContainer"), this);
        this.machines[cm.state.id].initUI();
        document.getElementById("createTimer").textContent = "Reset";
        const displayedTimers = util_1.getDisplayedTimers();
        if (displayedTimers.indexOf(cm.state.id) === -1) {
            displayedTimers.push(cm.state.id);
        }
        util_1.setTimersInHash(displayedTimers);
        return this.machines[cm.state.id];
    }
    getMatchingTimer(cm) {
        for (const registeredTimer of timerTypes) {
            if (registeredTimer.decider(cm)) {
                return registeredTimer.timer;
            }
        }
        throw new Error("Could not find a suitable UI for this timer.");
    }
}
exports.TimeToCurl = TimeToCurl;
const timerTypes = [];
function registerTimerType(timer, decider) {
    timerTypes.push({ timer, decider });
}
exports.registerTimerType = registerTimerType;
