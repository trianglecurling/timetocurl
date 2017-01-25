const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { join } = require("path");

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
});



http.listen(3001, () => {
	console.log("listening on *:3001");
});