function setupRoutes(app) {
	app.get("/", (req, res) => {
		console.log("Test");
		res.sendFile("client/index.html");
	});

	app.get("/app.js", (req, res) => {
		res.sendFile("client/bin/app.js")
	});

	app.get("/style.css", (req, res) => {
		res.sendFile("client/style.css");
	});
}

var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.use(express.static('client/icons'))

setupRoutes(app);

io.on("connection", (socket) => {
	console.log("A client connected");
});

http.listen(3001, () => {
	console.log("listening on *:3001");
});