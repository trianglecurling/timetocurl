const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { join } = require("path");
const CurlingMachine = require("./curl-timer");

function setupRoutes(app) {
	app.get("/", (req, res) => {
		res.sendFile(join(__dirname, "client/index.html"));
	});

	app.get("/app.js", (req, res) => {
		res.sendFile(join(__dirname, "client/bin/app.js"));
	});

	app.get("/time-minder.js", (req, res) => {
		res.sendFile(join(__dirname, "client/time-minder.js"));
	});

	app.get("/style.css", (req, res) => {
		res.sendFile(join(__dirname, "client/style.css"));
	});
}


app.use(express.static('client/icons'))

setupRoutes(app);

io.on("connection", (socket) => {
	console.log("A client connected");
	
	socket.on("action", (message) => {
		let payload;
		try {
			payload = JSON.parse(message);
		}
		catch (e) {
			throw new Error(`Failed to parse message as JSON: ${message}`);
		}
		handleAction(payload, socket);
	});
});

const games = {};

function handleAction(action, socket) {
	if (action.request === "CREATE_TIMER") {
		const curlingMachine = new CurlingMachine(action.options);
		games[curlingMachine.id] = curlingMachine;
		const response = {response: "CREATE_TIMER", token: action.token, data: curlingMachine.getSerializableState()};
		socket.emit("response", JSON.stringify(response));
	}

	if (action.request === "GET_TIMER") {
		const response = {response: "GET_TIMER", token: action.token, data: games[action.timerId]};
		socket.emit("response", JSON.stringify(response));
	}

	if (action.request === "DELETE_TIMER") {
		games[action.timerID].dispose();
		const deleted = !!games[action.timerID] ? "ok" : "not found";
		delete games[action.timerID];
		socket.emit("response", JSON.stringify({response: "DELETE_TIMER", token: action.token, data: deleted}));
	}

	if (action.request === "QUERY_TIMER") {
		const machine = games[action.timerID];

		// Query timer.
	}
}

http.listen(3001, () => {
	console.log("listening on *:3001");
});