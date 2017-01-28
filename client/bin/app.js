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
    // private handleResponse(data: SocketResponse<any>) {
    // 	if (data.response === "CREATE_TIMER") {
    // 		this.handleCreateTimer(data.data);
    // 	}
    // }
    TimeToCurl.prototype.handleCreateTimer = function (curlingMachineState) {
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
    return TimeToCurl;
}());
new TimeToCurl().init();
