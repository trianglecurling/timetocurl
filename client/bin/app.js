var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
function getDisplayedTimers() {
    var hash = window.location.hash;
    if (hash.length > 0) {
        return hash.substr(1).split(";");
    }
    return [];
}
function setTimersInHash(ids) {
    window.location.hash = "#" + ids.join(";");
}
function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function roundPrecision(num, decimalPlaces) {
    var power = Math.pow(10, decimalPlaces);
    return Math.round(num * power) / power;
}
var TimeToCurl = (function () {
    function TimeToCurl() {
    }
    TimeToCurl.prototype.init = function () {
        var _this = this;
        this.setUpEvents();
        this.socket = io();
        this.requests = {};
        this.requestResolvers = {};
        this.machines = {};
        this.machineOrder = {};
        this.socket.on("response", function (result) {
            var response;
            try {
                response = JSON.parse(result);
            }
            catch (ex) {
                throw new Error("Could not parse response as JSON: " + result);
            }
            // Did we ask for this data?
            if (_this.requestResolvers[response.token]) {
                _this.requests[response.token] = response;
                _this.requestResolvers[response.token].call(_this, response);
            }
            else {
                console.warn("Unexpected data from the server: " + result);
            }
        });
        this.socket.on("statechange", function (message) {
            var receivedMessage = JSON.parse(message);
            switch (receivedMessage.message) {
                case "SET_STATE":
                    _this.machines[receivedMessage.machineId].setNewState(receivedMessage.data.state);
                    break;
                default:
                    throw new Error("Received an action that we didn't know how to handle... " + message);
            }
        });
        this.loadTimers(getDisplayedTimers());
    };
    TimeToCurl.prototype.loadTimers = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, ids_1, timerId, timer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, ids_1 = ids;
                        _a.label = 1;
                    case 1:
                        if (!(_i < ids_1.length)) return [3 /*break*/, 4];
                        timerId = ids_1[_i];
                        return [4 /*yield*/, this.emitAction({
                                request: "GET_TIMER",
                                options: { timerId: timerId }
                            })];
                    case 2:
                        timer = _a.sent();
                        if (this.machines[timerId]) {
                            this.machines[timerId].setNewState(timer.data.state);
                        }
                        else {
                            this.addCurlingMachine(timer.data);
                        }
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TimeToCurl.prototype.setUpEvents = function () {
        var _this = this;
        document.addEventListener("DOMContentLoaded", function () {
            document.getElementById("createTimer").addEventListener("click", function () { return __awaiter(_this, void 0, void 0, function () {
                var timerName, response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            timerName = document.getElementById("timerName").value || "Timer";
                            return [4 /*yield*/, this.emitAction({
                                    request: "CREATE_TIMER",
                                    options: {
                                        name: timerName
                                    }
                                })];
                        case 1:
                            response = _a.sent();
                            this.addCurlingMachine(response.data);
                            return [2 /*return*/];
                    }
                });
            }); });
            document.getElementById("showDebug").addEventListener("change", _this.onDebugToggled);
            document.getElementById("themeSelector").addEventListener("change", _this.onThemeChanged);
            _this.onThemeChanged();
            _this.onDebugToggled();
        });
    };
    TimeToCurl.prototype.onDebugToggled = function () {
        var showDebug = document.getElementById("showDebug");
        var debugElements = document.getElementsByClassName("debug");
        for (var i = 0; i < debugElements.length; ++i) {
            var elem = debugElements.item(i);
            elem.classList[showDebug.checked ? "remove" : "add"]("hidden");
        }
    };
    TimeToCurl.prototype.onThemeChanged = function () {
        var selector = document.getElementById("themeSelector");
        this.setTheme(selector.value);
    };
    TimeToCurl.prototype.setTheme = function (themeName) {
        this.currentTheme = themeName;
        document.body.className = this.currentTheme;
    };
    TimeToCurl.prototype.emitAction = function (action) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var token = uuid();
            action.token = token;
            _this.socket.emit("action", JSON.stringify(action));
            _this.requestResolvers[token] = resolve;
        });
    };
    TimeToCurl.prototype.addCurlingMachine = function (cm) {
        this.machines[cm.state.id] = new CurlingMachineUI(cm, document.getElementById("timersContainer"), this);
        var displayedTimers = getDisplayedTimers();
        if (displayedTimers.indexOf(cm.state.id) === -1) {
            displayedTimers.push(cm.state.id);
        }
        setTimersInHash(displayedTimers);
    };
    return TimeToCurl;
}());
var CurlingMachineUI = (function () {
    function CurlingMachineUI(initParams, container, application) {
        this.container = container;
        this.application = application;
        this.elements = {};
        this.thinkingButtons = {};
        this.thinkingTimeText = {};
        this.state = initParams.state;
        this.options = initParams.options;
        this.initUI();
    }
    CurlingMachineUI.prototype.initUI = function () {
        var _this = this;
        var template = document.getElementById("timerTemplate").children.item(0);
        var newUI = template.cloneNode(true);
        this.initElements(newUI);
        var _loop_1 = function (teamId) {
            this_1.thinkingButtons[teamId].addEventListener("click", function () {
                _this.sendPhaseTransition("begin-thinking", { team: teamId });
            });
        };
        var this_1 = this;
        for (var _i = 0, _a = Object.keys(this.thinkingButtons); _i < _a.length; _i++) {
            var teamId = _a[_i];
            _loop_1(teamId);
        }
        this.forEachAction(function (elem, action) {
            if (action === "begin-thinking") {
                return;
            }
            elem.addEventListener("click", function () {
                _this.sendPhaseTransition(action);
            });
        });
        this.setNewState(this.state);
        this.container.appendChild(newUI);
    };
    CurlingMachineUI.prototype.getState = function () {
        return __assign({}, this.state);
    };
    CurlingMachineUI.prototype.dispose = function () {
    };
    CurlingMachineUI.prototype.setNewState = function (state) {
        var _this = this;
        this.debugElement.textContent = JSON.stringify(state, null, 4);
        this.state = state;
        // Enable buttons for legal actions only
        this.forEachAction(function (elem, action) {
            if (_this.state.legalActions.indexOf(action) >= 0) {
                elem.disabled = false;
            }
            else {
                elem.disabled = true;
            }
        });
        this.clearTimer();
        var _loop_2 = function (teamId) {
            this_2.thinkingTimeText[teamId].textContent = this_2.secondsToStr(this_2.state.timeRemaining[teamId]);
            if (this_2.state.phase === "thinking") {
                var thinkingTeam = this_2.state.phaseData["team"];
                if (thinkingTeam === teamId) {
                    this_2.thinkingButtons[teamId].disabled = true;
                    var timer_1 = new TimeMinder(this_2.state.timeRemaining[thinkingTeam] * _settings.lengthOfSecond);
                    timer_1.every(_settings.lengthOfSecond / 10, function () {
                        _this.thinkingTimeText[teamId].textContent = _this.secondsToStr(timer_1.getTimeRemaining() / _settings.lengthOfSecond);
                    }, false);
                    timer_1.start();
                    this_2.runningTimer = timer_1;
                }
                else {
                    this_2.thinkingButtons[teamId].disabled = false;
                }
            }
        };
        var this_2 = this;
        for (var _i = 0, _a = this.options.teams; _i < _a.length; _i++) {
            var teamId = _a[_i];
            _loop_2(teamId);
        }
        if (this.state.phase === "warm-up") {
            this.elements["warmup-time-container"][0].classList.remove("irrelevant");
            var timer_2 = new TimeMinder(this.state.warmupTimeRemaining * _settings.lengthOfSecond);
            timer_2.every(_settings.lengthOfSecond / 10, function () {
                _this.warmupTimeText.textContent = _this.secondsToStr(timer_2.getTimeRemaining() / _settings.lengthOfSecond);
            }, false);
            timer_2.start();
            this.runningTimer = timer_2;
        }
        else if (this.state.phase !== "technical") {
            this.elements["warmup-time-container"][0].classList.add("irrelevant");
        }
        if (this.state.phase === "between-ends") {
            this.elements["between-end-time-container"][0].classList.remove("irrelevant");
            var timer_3 = new TimeMinder(this.state.betweenEndTimeRemaining * _settings.lengthOfSecond);
            timer_3.every(_settings.lengthOfSecond / 10, function () {
                _this.betweenEndTimeText.textContent = _this.secondsToStr(timer_3.getTimeRemaining() / _settings.lengthOfSecond);
            }, false);
            timer_3.start();
            this.runningTimer = timer_3;
        }
        else if (this.state.phase !== "technical") {
            this.elements["between-end-time-container"][0].classList.add("irrelevant");
        }
        if (this.state.phase === "timeout") {
            this.elements["timeout-time-container"][0].classList.remove("irrelevant");
            var timer_4 = new TimeMinder(this.state.timeoutTimeRemaining * _settings.lengthOfSecond);
            timer_4.every(_settings.lengthOfSecond / 10, function () {
                _this.timeoutTimeText.textContent = _this.secondsToStr(timer_4.getTimeRemaining() / _settings.lengthOfSecond);
            }, false);
            timer_4.start();
            this.runningTimer = timer_4;
        }
        else if (this.state.phase !== "technical") {
            this.elements["timeout-time-container"][0].classList.add("irrelevant");
        }
        // Title
        this.titleElement.textContent = this.state.timerName;
        this.rootTimerElement.classList.remove(this.rootTimerElement.dataset["phase"]);
        this.rootTimerElement.dataset["phase"] = this.state.phase;
        this.rootTimerElement.classList.add(this.rootTimerElement.dataset["phase"]);
    };
    CurlingMachineUI.prototype.forEachAction = function (callback) {
        for (var action in this.elements) {
            for (var _i = 0, _a = this.elements[action]; _i < _a.length; _i++) {
                var elem = _a[_i];
                var actionAttr = elem.dataset["action"];
                if (elem.tagName.toLowerCase() === "button" && actionAttr) {
                    callback.call(null, elem, actionAttr);
                }
            }
        }
    };
    CurlingMachineUI.prototype.clearTimer = function () {
        if (this.runningTimer) {
            this.runningTimer.dispose();
        }
    };
    CurlingMachineUI.prototype.sendPhaseTransition = function (transition, data) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.application.emitAction({
                            request: "QUERY_TIMER",
                            options: {
                                transition: transition,
                                data: data,
                                timerId: this.state.id
                            }
                        })];
                    case 1:
                        result = _a.sent();
                        if (result.data !== "ok") {
                            throw new Error("Error querying timer w/ phase transition " + transition + ".");
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    CurlingMachineUI.prototype.initElements = function (elem) {
        var _this = this;
        var key = "";
        var elemData = elem.dataset["action"];
        if (elemData) {
            key = elemData;
        }
        else if (elem.classList.length === 1) {
            key = elem.className;
        }
        if (!this.elements[key]) {
            this.elements[key] = [];
        }
        this.elements[key].push(elem);
        for (var i = 0; i < this.options.teams.length; ++i) {
            if (this.elements["begin-thinking"] && this.elements["begin-thinking"][i]) {
                this.thinkingButtons[this.options.teams[i]] = this.elements["begin-thinking"][i];
            }
            if (this.elements["thinking-time"] && this.elements["thinking-time"][i]) {
                this.thinkingTimeText[this.options.teams[i]] = this.elements["thinking-time"][i];
            }
        }
        if (this.elements["timer"] && this.elements["timer"][0]) {
            this.rootTimerElement = this.elements["timer"][0];
        }
        if (this.elements["warmup-time"] && this.elements["warmup-time"][0]) {
            this.warmupTimeText = this.elements["warmup-time"][0];
        }
        if (this.elements["between-end-time"] && this.elements["between-end-time"][0]) {
            this.betweenEndTimeText = this.elements["between-end-time"][0];
        }
        if (this.elements["debug"] && this.elements["debug"][0]) {
            this.debugElement = this.elements["debug"][0];
        }
        if (this.elements["timeout-time"] && this.elements["timeout-time"][0]) {
            this.timeoutTimeText = this.elements["timeout-time"][0];
        }
        if (this.elements["timer-title"] && this.elements["timer-title"][0]) {
            this.titleElement = this.elements["timer-title"][0];
        }
        if (this.elements["timer-container"] && this.elements["timer-container"][0]) {
            this.timerContainerElement = this.elements["timer-container"][0];
            // set up click-to-scroll
            this.titleElement.addEventListener("click", function () {
                _this.timerContainerElement.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            });
        }
        if (elem.children) {
            for (var i = 0; i < elem.children.length; ++i) {
                this.initElements(elem.children.item(i));
            }
        }
    };
    CurlingMachineUI.prototype.secondsToStr = function (seconds) {
        var clampedSeconds = Math.max(0, seconds);
        var m = Math.floor(clampedSeconds / 60);
        var s = roundPrecision(clampedSeconds, 0) % 60;
        var slz = s < 10 ? "0" + String(s) : String(s);
        return m + ":" + slz;
    };
    return CurlingMachineUI;
}());
new TimeToCurl().init();
