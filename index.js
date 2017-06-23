require("./polyfills");
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { join } = require("path");
const CurlingMachine = require("./curl-timer");
const fs = require("fs");

function setupRoutes(app) {
    app.get("/", (req, res) => {
        res.sendFile(join(__dirname, "../client/index.html"));
    });

    app.get("/time-minder.js", (req, res) => {
        res.sendFile(join(__dirname, "../client/time-minder.js"));
    });

    app.get("/style.css", async (req, res) => {
        res.sendFile(join(__dirname, "../client/bin/main.css"));
    });

    app.use(express.static("../client/icons"));
    app.use(express.static("../client/bin"));
}

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
    for (const socket of sockets) {
        socket.emit(
            "statechange",
            JSON.stringify({
                message: "SET_STATE",
                machineId: machineId,
                data: games[machineId].getSerializableState(),
            }),
        );
    }
}

function handleAction(action, socket) {
    //console.log("Action: " + action.request);

    if (action.request === "CREATE_TIMER") {
        const curlingMachine = new CurlingMachine(action.options, sockets => {
            dispatchStateChange(sockets, curlingMachine.id);
        });
        curlingMachine.registerSocket(action.clientId, socket);
        games[curlingMachine.id] = curlingMachine;
        const response = {
            response: "CREATE_TIMER",
            token: action.token,
            data: curlingMachine.getSerializableState(),
        };
        socket.emit("response", JSON.stringify(response));
    }

    if (action.request === "GET_TIMER") {
        const game = games[action.options.timerId];
        game.registerSocket(action.clientId, socket);
        if (game) {
            const response = {
                response: "GET_TIMER",
                token: action.token,
                data: game.getSerializableState(),
            };

            //console.log("GET_TIMER response: " + require("util").inspect(response));
            socket.emit("response", JSON.stringify(response));
        } else {
            socket.emit("response", "game not found");
        }
    }

    if (action.request === "DELETE_TIMER") {
        games[action.options.timerId].dispose();
        const deleted = !!games[action.options.timerId] ? "ok" : "not found";
        delete games[action.options.timerId];
        socket.emit(
            "response",
            JSON.stringify({
                response: "DELETE_TIMER",
                token: action.token,
                data: deleted,
            }),
        );
    }

    if (action.request === "QUERY_TIMER") {
        //console.log("Query timer: " + JSON.stringify(action, null, 4));
        const machine = games[action.options.timerId];
        machine.registerSocket(action.clientId, socket);
        if (machine) {
            if (action.options.state) {
                machine.handleAction({
                    state: action.options.state,
                });
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
                    data: JSON.parse(action.options.data),
                });
            } else {
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

const listener = http.listen(port || 3001, () => {
    console.log(`listening on *:${String(port)}`);
});
