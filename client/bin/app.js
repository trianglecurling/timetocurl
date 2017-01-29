function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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
        this.machines = [];
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
    };
    TimeToCurl.prototype.setUpEvents = function () {
        var _this = this;
        document.addEventListener("DOMContentLoaded", function () {
            document.getElementById("createTimer").addEventListener("click", function () {
                _this.emitAction({
                    request: "CREATE_TIMER",
                    options: {}
                }).then(function (response) {
                    console.log("New curling machine added: " + JSON.stringify(response.data, null, 4));
                    _this.addCurlingMachine(response.data);
                });
            });
        });
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
    TimeToCurl.prototype.addCurlingMachine = function (state) {
        this.machines.push(new CurlingMachineUI(state, document.getElementById("timersContainer")));
    };
    return TimeToCurl;
}());
var CurlingMachineUI = (function () {
    function CurlingMachineUI(initialState, container) {
        this.container = container;
        this.elements = {};
        this.state = initialState;
        this.initUI();
    }
    CurlingMachineUI.prototype.initUI = function () {
        var template = document.getElementById("timerTemplate").children.item(0);
        var newUI = template.cloneNode(true);
        this.initElements(newUI);
        this.elements["team-1-thinking-time"].textContent = this.secondsToStr(this.state.timeRemaining["Yellow"]);
        this.elements["team-2-thinking-time"].textContent = this.secondsToStr(this.state.timeRemaining["Red"]);
        this.container.appendChild(newUI);
    };
    CurlingMachineUI.prototype.initElements = function (elem) {
        if (elem.className) {
            this.elements[elem.className] = elem;
        }
        if (elem.children) {
            for (var i = 0; i < elem.children.length; ++i) {
                this.initElements(elem.children.item(i));
            }
        }
    };
    CurlingMachineUI.prototype.secondsToStr = function (seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        var slz = s < 10 ? "0" + String(s) : String(s);
        return m + ":" + slz;
    };
    return CurlingMachineUI;
}());
new TimeToCurl().init();
