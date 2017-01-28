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
		console.log("Creating timer.");
		const curlingMachine = new CurlingMachine(action.options);
		games[curlingMachine.id] = curlingMachine;
		const response = {response: "CREATE_TIMER", token: action.token, data: curlingMachine.getSerializableState()};
		console.log(`Emitting... ${JSON.stringify(response)}`);
		socket.emit("response", JSON.stringify(response));
	}
}

http.listen(3001, () => {
	console.log("listening on *:3001");
});