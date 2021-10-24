"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
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
require("./polyfills");
var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var join = require("path").join;
var _a = require("./curl-timer"), CurlingMachine = _a.CurlingMachine, SimpleTimerMachine = _a.SimpleTimerMachine;
var fs = require("fs");
var path = require("path");
function loadPlugins() {
    var plugins = [];
    var pluginPathArg = process.argv.indexOf("--plugins-path");
    if (pluginPathArg >= 0) {
        var argPath = process.argv[pluginPathArg + 1];
        var pluginPath = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);
        var items = fs.readdirSync(pluginPath);
        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
            var item = items_1[_i];
            if (/\.plugin\.js$/.test(item)) {
                plugins.push(require(path.join(pluginPath, item)));
            }
        }
    }
    return plugins;
}
var plugins = loadPlugins();
function forEachPlugin(action) {
    for (var _i = 0, plugins_1 = plugins; _i < plugins_1.length; _i++) {
        var plugin = plugins_1[_i];
        action(plugin);
    }
}
function setupRoutes(app) {
    var _this = this;
    app.get(/(^\/$)|(^\/t\/.*$)/, function (req, res) {
        console.log(__dirname);
        res.sendFile(join(__dirname, "../client/index.html"));
    });
    app.post("/", function (req, res) {
        console.log(req.body);
        var result = handleAction(req.body.action);
        if (result) {
            res.status(200).end(JSON.stringify(result, null, 4));
        }
        else {
            res.status(201).end();
        }
    });
    app.get("/style.css", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            res.sendFile(join(__dirname, "../client/bin/main.css"));
            return [2 /*return*/];
        });
    }); });
    app.get("/plugins.js", function (req, res) {
        var pluginScripts = [];
        forEachPlugin(function (p) {
            if (typeof p.getScripts === "function") {
                pluginScripts.push(p.getScripts());
            }
        });
        res.end(pluginScripts.map(function (s) { return "!function(){\n" + s + "\n}();"; }).join("\n\n"));
    });
    app.use(express.static(join(__dirname, "../client", "icons")));
    app.use(express.static(join(__dirname, "../client", "bin")));
    app.use(express.static(join(__dirname, "../assets")));
    forEachPlugin(function (p) {
        if (typeof p.setupRoutes === "function") {
            p.setupRoutes(app);
        }
    });
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
setupRoutes(app);
io.on("connection", function (socket) {
    socket.on("action", function (message) {
        var payload;
        try {
            payload = JSON.parse(message);
        }
        catch (e) {
            throw new Error("Failed to parse message as JSON: " + message);
        }
        handleAction(payload, socket);
    });
});
var games = {};
function dispatchStateChange(sockets, machineId) {
    console.log("sending updated state");
    var game = getGame(machineId);
    if (game) {
        for (var _i = 0, sockets_1 = sockets; _i < sockets_1.length; _i++) {
            var socket = sockets_1[_i];
            socket.emit("statechange", JSON.stringify({
                message: "SET_STATE",
                machineId: machineId,
                data: game.getSerializableState(),
            }));
        }
    }
}
function getGame(timerNameOrId) {
    return games[timerNameOrId] || games[Object.keys(games).find(function (g) { return games[g].options.timerName === timerNameOrId; })];
}
function handleAction(action, socket) {
    //console.log("Action: " + action.request);
    if (socket === void 0) { socket = null; }
    if (action.request === "CREATE_TIMER") {
        if (action.options.timerName) {
            var existingGame = getGame(action.options.timerName);
            if (existingGame) {
                existingGame.dispose();
                delete games[existingGame.id];
            }
        }
        var curlingMachine_1;
        if (action.options.type === "simple") {
            curlingMachine_1 = new SimpleTimerMachine(action.options, function (sockets) {
                dispatchStateChange(sockets, curlingMachine_1.id);
            });
        }
        else if (action.options.type === "standard") {
            curlingMachine_1 = new CurlingMachine(action.options, function (sockets) {
                dispatchStateChange(sockets, curlingMachine_1.id);
            });
        }
        if (curlingMachine_1) {
            socket && curlingMachine_1.registerSocket(action.clientId, socket);
            games[curlingMachine_1.id] = curlingMachine_1;
            var response = {
                response: "CREATE_TIMER",
                token: action.token,
                data: curlingMachine_1.getSerializableState(),
            };
            socket && socket.emit("response", JSON.stringify(response));
            forEachPlugin(function (p) {
                if (typeof p.onTimerCreated === "function") {
                    p.onTimerCreated(curlingMachine_1);
                }
            });
        }
        else {
            socket && socket.emit("response", JSON.stringify({ error: true, message: "Unknown timer type." }));
        }
    }
    if (action.request === "GET_TIMER") {
        var timerId = action.options.timerId;
        var dollarIndex = timerId.indexOf("$");
        if (dollarIndex >= 0) {
            timerId = timerId.substr(0, dollarIndex);
        }
        var game = getGame(timerId);
        var response = {
            response: "GET_TIMER",
            token: action.token,
            data: game ? game.getSerializableState() : undefined,
        };
        if (socket && game) {
            game.registerSocket(action.clientId, socket);
            //console.log("GET_TIMER response: " + require("util").inspect(response));
            socket && socket.emit("response", JSON.stringify(response));
        }
        else {
            socket &&
                socket.emit("response", JSON.stringify({
                    response: "error",
                    data: "game not found",
                }));
        }
        return response;
    }
    if (action.request === "DELETE_TIMER") {
        var game = getGame(action.options.timerId);
        if (game) {
            game.dispose();
            delete games[game.id];
        }
        socket &&
            socket.emit("response", JSON.stringify({
                response: "DELETE_TIMER",
                token: action.token,
                data: !!game,
            }));
    }
    if (action.request === "QUERY_TIMER") {
        //console.log("Query timer: " + JSON.stringify(action, null, 4));
        var machine = getGame(action.options.timerId);
        socket && machine.registerSocket(action.clientId, socket);
        if (machine) {
            if (action.options.state) {
                machine.handleAction({
                    state: action.options.state,
                });
                socket &&
                    socket.emit("response", JSON.stringify({
                        response: "QUERY_TIMER",
                        token: action.token,
                        data: "ok",
                    }));
            }
            else if (action.options.transition) {
                //console.log("Transition: " + action.options.transition);
                machine.handleAction({
                    transition: action.options.transition,
                    data: action.options.data,
                });
                socket &&
                    socket.emit("response", JSON.stringify({
                        response: "QUERY_TIMER",
                        token: action.token,
                        data: "ok",
                    }));
            }
            else if (action.options.command) {
                machine.handleAction({
                    command: action.options.command,
                    data: JSON.parse(action.options.data || "{}"),
                });
            }
            else {
                socket &&
                    socket.emit("response", JSON.stringify({
                        response: "QUERY_TIMER",
                        token: action.token,
                        data: "no action given",
                    }));
            }
        }
        else {
            socket &&
                socket.emit("response", JSON.stringify({
                    response: "QUERY_TIMER",
                    token: action.token,
                    data: "unknown machine",
                }));
        }
    }
}
var port = 0;
if (process.env.PORT) {
    var portNum = parseInt(process.env.PORT, 10);
    if (!isNaN(portNum)) {
        port = portNum;
    }
}
if (!port && process.env.NODE_ENV) {
    if (process.env.NODE_ENV.toLowerCase() === "production") {
        port = 80;
    }
}
var listener = http.listen(process.env.PORT || 3001, function () {
    console.log("listening on *:" + String(port));
});
