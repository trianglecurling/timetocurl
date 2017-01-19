function setupRoutes(app) {
    app.get("/", (req, res) => {
        res.sendfile("client/index.html");
    });

    app.get("/app.js", (req, res) => {
        res.sendfile("client/bin/app.js")
    });

    app.get("/style.css", (req, res) => {
        res.sendfile("client/style.css");
    });
}

var app = require("express")();
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

