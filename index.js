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

class TimeMinder {
    constructor(totalSeconds, onComplete) {
        this.intervals = [];
        this.onComplete = onComplete;
    }

    start() {
        const numIntervals = this.intervals.length;
        if (numIntervals && this.intervals[numIntervals - 1].end === null) {
            // timer was already started
            return;
        } 
        this.intervals.push({
            start: new Date(),
            end: null
        });
        this.timeout = setTimeout(() => {
            this.onComplete(this.intervals);
        }, this.getTimeRemaining());
    }

    getTimeRemaining() {
        return this.intervals.map(i => i.end.getTime() - i.start.getTime()).reduce((prev, current) => current + prev, 0);
    }

    pause() {
        if (!this.intervals.length || this.intervals[this.intervals.length - 1].end) {
            // timer has not started
            return;
        }
        clearTimeout(this.timeout);

        // People running around with chainsaws is not Leah's thing.
        this.intervals[this.intervals.length - 1].end = new Date();
    }
}

class CurlTimer {
    
    constructor(options) {
        this._options = options;
        this.teamATimer = new TimeMinder(this.options.thinkingTime);
        this.teamBTimer = new TimeMinder(this.options.thinkingTime);
        this.currentTimerStartedAt = null;
        this.phase = "pregame";
    }

    beforeEnd() {
        this.phase = "beforeEnd";
        this.interEndTimer = new TimeMinder(this.options.betweenEndTime, () => {
            this.startEnd();
        });
        this.interEndTimer.start();
    }

    startEnd() {
        this.phase = "inEnd";
        this.end++;
        this.currentRock = 0;
    }

    startGame() {
        this.end = 0;
        this.phase = "between_ends";
    }

    startATime() {
        if (this.phase === "inEnd") {
            this.currentRock++;
            this.teamATimer.start();
        }
    }

    stopATime() {
        this.teamATimer.pause();
    }

    startBTime() {
        if (this.phase === "inEnd") {
            this.currentRock++;
            this.teamBTimer.start();
        }
    }

    stopBTime() {
        this.teamBTimer.stop();
    }

    getState() {
        return {
            end: this.end,

        }
    }
}