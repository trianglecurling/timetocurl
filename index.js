require("./polyfills");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { join } = require("path");
const { CurlingMachine, SimpleTimerMachine } = require("./curl-timer");
const fs = require("fs");
const path = require("path");

function loadPlugins() {
	const plugins = [];
	const pluginPathArg = process.argv.indexOf("--plugins-path");
	if (pluginPathArg >= 0) {
		const argPath = process.argv[pluginPathArg + 1];
		const pluginPath = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);
		const items = fs.readdirSync(pluginPath);
		for (const item of items) {
			if (/\.plugin\.js$/.test(item)) {
				plugins.push(require(path.join(pluginPath, item)));
			}
		}
	}
	return plugins;
}

const plugins = loadPlugins();

function forEachPlugin(action) {
	for (const plugin of plugins) {
		action(plugin);
	}
}

function setupRoutes(app) {
	app.get(/(^\/$)|(^\/t\/.*$)/, (req, res) => {
		console.log(__dirname);
		res.sendFile(join(__dirname, "../client/index.html"));
	});

	app.post("/", (req, res) => {
		console.log(req.body);
		handleAction(req.body.action);
		res.status(201).end();
	});

	app.get("/style.css", async (req, res) => {
		res.sendFile(join(__dirname, "../client/bin/main.css"));
	});

	app.get("/plugins.js", (req, res) => {
		const pluginScripts = [];
		forEachPlugin(p => {
			if (typeof p.getScripts === "function") {
				pluginScripts.push(p.getScripts());
			}
		});

		res.end(pluginScripts.map(s => "!function(){\n" + s + "\n}();").join("\n\n"));
	});

	app.use(express.static(join(__dirname, "../client", "icons")));
	app.use(express.static(join(__dirname, "../client", "bin")));
	app.use(express.static(join(__dirname, "../assets")));

	forEachPlugin(p => {
		if (typeof p.setupRoutes === "function") {
			p.setupRoutes(app);
		}
	});
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

setupRoutes(app);

io.on("connection", socket => {
	socket.on("action", message => {
		let payload;
		try {
			payload = JSON.parse(message);
		} catch (e) {
			throw new Error(`Failed to parse message as JSON: ${message}`);
		}
		handleAction(payload, socket);
	});
});

const games = {};

function dispatchStateChange(sockets, machineId) {
	console.log("sending updated state");
	const game = getGame(machineId);
	if (game) {
		for (const socket of sockets) {
			socket.emit(
				"statechange",
				JSON.stringify({
					message: "SET_STATE",
					machineId: machineId,
					data: game.getSerializableState(),
				}),
			);
		}
	}
}

function getGame(timerNameOrId) {
	return games[timerNameOrId] || games[Object.keys(games).find(g => games[g].options.timerName === timerNameOrId)];
}

function handleAction(action, socket = null) {
	//console.log("Action: " + action.request);

	if (action.request === "CREATE_TIMER") {
		if (action.options.timerName) {
			const existingGame = getGame(action.options.timerName);
			if (existingGame) {
				existingGame.dispose();
				delete games[existingGame.id];
			}
		}
		let curlingMachine;
		if (action.options.type === "simple") {
			curlingMachine = new SimpleTimerMachine(action.options, sockets => {
				dispatchStateChange(sockets, curlingMachine.id);
			});
		} else if (action.options.type === "standard") {
			curlingMachine = new CurlingMachine(action.options, sockets => {
				dispatchStateChange(sockets, curlingMachine.id);
			});
		}
		if (curlingMachine) {
			socket && curlingMachine.registerSocket(action.clientId, socket);
			games[curlingMachine.id] = curlingMachine;
			const response = {
				response: "CREATE_TIMER",
				token: action.token,
				data: curlingMachine.getSerializableState(),
			};
			socket && socket.emit("response", JSON.stringify(response));
			forEachPlugin(p => {
				if (typeof p.onTimerCreated === "function") {
					p.onTimerCreated(curlingMachine);
				}
			});
		} else {
			socket && socket.emit("response", JSON.stringify({ error: true, message: "Unknown timer type." }));
		}
	}

	if (action.request === "GET_TIMER") {
		let timerId = action.options.timerId;
		const dollarIndex = timerId.indexOf("$");
		if (dollarIndex >= 0) {
			timerId = timerId.substr(0, dollarIndex);
		}
		let game = getGame(timerId);

		if (socket && game) {
			game.registerSocket(action.clientId, socket);
			const response = {
				response: "GET_TIMER",
				token: action.token,
				data: game.getSerializableState(),
			};

			//console.log("GET_TIMER response: " + require("util").inspect(response));
			socket && socket.emit("response", JSON.stringify(response));
		} else {
			socket &&
				socket.emit(
					"response",
					JSON.stringify({
						response: "error",
						data: "game not found",
					}),
				);
		}
	}

	if (action.request === "DELETE_TIMER") {
		const game = getGame(action.options.timerId);
		if (game) {
			game.dispose();
			delete games[game.id];
		}
		socket &&
			socket.emit(
				"response",
				JSON.stringify({
					response: "DELETE_TIMER",
					token: action.token,
					data: !!game,
				}),
			);
	}

	if (action.request === "QUERY_TIMER") {
		//console.log("Query timer: " + JSON.stringify(action, null, 4));
		const machine = getGame(action.options.timerId);
		socket && machine.registerSocket(action.clientId, socket);
		if (machine) {
			if (action.options.state) {
				machine.handleAction({
					state: action.options.state,
				});
				socket &&
					socket.emit(
						"response",
						JSON.stringify({
							response: "QUERY_TIMER",
							token: action.token,
							data: "ok",
						}),
					);
			} else if (action.options.transition) {
				//console.log("Transition: " + action.options.transition);
				machine.handleAction({
					transition: action.options.transition,
					data: action.options.data,
				});
				socket &&
					socket.emit(
						"response",
						JSON.stringify({
							response: "QUERY_TIMER",
							token: action.token,
							data: "ok",
						}),
					);
			} else if (action.options.command) {
				machine.handleAction({
					command: action.options.command,
					data: JSON.parse(action.options.data || "{}"),
				});
			} else {
				socket &&
					socket.emit(
						"response",
						JSON.stringify({
							response: "QUERY_TIMER",
							token: action.token,
							data: "no action given",
						}),
					);
			}
		} else {
			socket &&
				socket.emit(
					"response",
					JSON.stringify({
						response: "QUERY_TIMER",
						token: action.token,
						data: "unknown machine",
					}),
				);
		}
	}
}

let port = 0;
if (process.env.PORT) {
	const portNum = parseInt(process.env.PORT, 10);
	if (!isNaN(portNum)) {
		port = portNum;
	}
}
if (!port && process.env.NODE_ENV) {
	if (process.env.NODE_ENV.toLowerCase() === "production") {
		port = 80;
	}
}

const listener = http.listen(process.env.PORT || 3001, () => {
	console.log(`listening on *:${String(port)}`);
});
