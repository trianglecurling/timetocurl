"use strict";
var ManagedTimer = (function () {
    function ManagedTimer(callback, ms, recurring, st, ct, si, ci) {
        this.callback = callback;
        this.recurring = recurring;
        this.ms = ms;
        this.si = si;
        this.ci = ci;
        this.st = st;
        this.ct = ct;
        this.elapsed = 0;
    }
    ManagedTimer.prototype.start = function () {
        if (this.firstStarted) {
            throw new Error("Timer already started.");
        }
        this.firstStarted = Date.now();
        this._start();
    };
    ManagedTimer.prototype.reset = function () {
        this.cancel();
        this.firstStarted = null;
    };
    ManagedTimer.prototype._start = function () {
        var _this = this;
        var setMethod = this.recurring ? this.si : this.st;
        this.clearMethod = this.recurring ? this.ci : this.ct;
        this.startedAt = Date.now();
        var handle = setMethod(function () {
            _this._invoke();
        }, this.ms);
        this.clear = this.clearMethod.bind(this, handle);
    };
    ManagedTimer.prototype._invoke = function () {
        this.callback();
        this.startedAt = Date.now();
        this.elapsed = 0;
    };
    ManagedTimer.prototype.setTimeRemaining = function (ms) {
        this.pause();
        this.elapsed = this.ms - ms;
        this.unpause();
    };
    ManagedTimer.prototype.cancel = function () {
        if (this.clear) {
            this.clear();
        }
    };
    ManagedTimer.prototype.pause = function () {
        this.elapsed += Date.now() - this.startedAt;
        this.clear();
    };
    ManagedTimer.prototype.unpause = function () {
        var _this = this;
        this.startedAt = Date.now();
        var handle = this.st(function () {
            _this._invoke();
            if (_this.recurring) {
                _this._start();
            }
        }, this.ms - this.elapsed);
        this.clear = this.ct.bind(this, handle);
    };
    return ManagedTimer;
}());
var Stopwatch = (function () {
    function Stopwatch() {
        this.splits = [];
        this.intervals = [];
        this.startupTasks = [];
        this.started = false;
        this.disposed = false;
        this.tickTimers = [];
    }
    Stopwatch.prototype.dispose = function () {
        for (var _i = 0, _a = this.tickTimers; _i < _a.length; _i++) {
            var timer = _a[_i];
            timer.timer.cancel();
        }
        this.disposed = true;
    };
    Stopwatch.prototype.start = function () {
        if (this.isRunning()) {
            return;
        }
        this.started = true;
        this.unpause();
        for (var _i = 0, _a = this.startupTasks; _i < _a.length; _i++) {
            var task = _a[_i];
            task.call(this);
        }
    };
    Stopwatch.prototype.unpause = function () {
        this.intervals.push({
            start: new Date(),
            end: null,
        });
        // Unpause all tick timers that were paused
        for (var _i = 0, _a = this.tickTimers; _i < _a.length; _i++) {
            var timer = _a[_i];
            if (!timer.runWhenPaused) {
                timer.timer.unpause();
            }
        }
    };
    Stopwatch.prototype.every = function (ms, callback, runWhenPaused) {
        if (runWhenPaused === void 0) { runWhenPaused = false; }
        if (!this.started) {
            this.startupTasks.push(this.every.bind(this, ms, callback, runWhenPaused));
            return;
        }
        var timer = new ManagedTimer(callback, ms, true, // recurring
        window.setTimeout.bind(window), window.clearTimeout.bind(window), window.setInterval.bind(window), window.clearInterval.bind(window));
        if (runWhenPaused || this.isRunning()) {
            timer.start();
        }
        this.tickTimers.push({ timer: timer, runWhenPaused: runWhenPaused });
    };
    Stopwatch.prototype.split = function () {
        this.splits.push(this.elapsedTime());
    };
    Stopwatch.prototype.getSplits = function () {
        return this.splits;
    };
    Stopwatch.prototype.elapsedTime = function () {
        return this.intervals
            .map(function (i) {
            return ((i.end && i.end.getTime()) || Date.now()) - i.start.getTime();
        })
            .reduce(function (prev, current) { return current + prev; }, 0);
    };
    Stopwatch.prototype.getTotalTimeSinceStart = function () {
        return Date.now() - this.intervals[0].start.getTime();
    };
    Stopwatch.prototype.pause = function () {
        if (!this.isRunning()) {
            return;
        }
        // People running around with chainsaws is not Leah's thing.
        this.intervals[this.intervals.length - 1].end = new Date();
        // Pause all tick timers that don't run when paused.
        for (var _i = 0, _a = this.tickTimers; _i < _a.length; _i++) {
            var timer = _a[_i];
            if (!timer.runWhenPaused) {
                timer.timer.pause();
            }
        }
    };
    Stopwatch.prototype.isRunning = function () {
        return this.intervals.length && this.intervals[this.intervals.length - 1].end === null;
    };
    return Stopwatch;
}());
var TimeMinder = (function () {
    function TimeMinder(totalTime, onComplete) {
        this.totalTime = totalTime;
        this.intervals = [];
        this.onComplete = onComplete;
        this.startupTasks = [];
        this.started = false;
        this.disposed = false;
        this.tickTimers = [];
    }
    TimeMinder.prototype.dispose = function () {
        clearTimeout(this.timeout);
        for (var _i = 0, _a = this.tickTimers; _i < _a.length; _i++) {
            var timer = _a[_i];
            timer.timer.cancel();
        }
        this.disposed = true;
    };
    TimeMinder.prototype.start = function (segmentName) {
        if (this.isRunning() || this.getTimeRemaining() <= 0) {
            return;
        }
        this.started = true;
        this.unpause(segmentName);
        for (var _i = 0, _a = this.startupTasks; _i < _a.length; _i++) {
            var task = _a[_i];
            task.call(this);
        }
    };
    TimeMinder.prototype.unpause = function (segmentName) {
        var _this = this;
        if (!this.started) {
            this.start(segmentName);
            return;
        }
        var newInterval = {
            start: new Date(),
            end: null,
        };
        if (segmentName) {
            newInterval.segmentName = segmentName;
        }
        this.intervals.push(newInterval);
        this.timeout = setTimeout(function () {
            _this.intervals[_this.intervals.length - 1].end = new Date();
            if (_this.onComplete) {
                _this.onComplete(_this.intervals);
            }
            for (var _i = 0, _a = _this.tickTimers; _i < _a.length; _i++) {
                var timer = _a[_i];
                timer.timer.cancel();
            }
        }, this.getTimeRemaining());
        // Unpause all tick timers that were paused
        for (var _i = 0, _a = this.tickTimers; _i < _a.length; _i++) {
            var timer = _a[_i];
            if (!timer.runWhenPaused) {
                timer.timer.unpause();
            }
        }
    };
    TimeMinder.prototype.every = function (ms, callback, runWhenPaused) {
        if (runWhenPaused === void 0) { runWhenPaused = false; }
        if (!this.started) {
            this.startupTasks.push(this.every.bind(this, ms, callback, runWhenPaused));
            return;
        }
        var timer = new ManagedTimer(callback, ms, true, // recurring
        window.setTimeout.bind(window), window.clearTimeout.bind(window), window.setInterval.bind(window), window.clearInterval.bind(window));
        timer.start();
        this.tickTimers.push({ timer: timer, runWhenPaused: runWhenPaused });
    };
    TimeMinder.prototype.elapsedTime = function (intervals) {
        return (intervals || this.intervals)
            .map(function (i) {
            if (typeof i.adjustment !== "undefined") {
                return i.adjustment;
            }
            return ((i.end && i.end.getTime()) || Date.now()) - i.start.getTime();
        })
            .reduce(function (prev, current) { return current + prev; }, 0);
    };
    TimeMinder.prototype.getTimeRemaining = function () {
        return this.totalTime - this.elapsedTime();
    };
    TimeMinder.prototype.getTotalTimeSinceStart = function () {
        return Date.now() - this.intervals[0].start.getTime();
    };
    TimeMinder.prototype.getTotalSegmentTime = function (segmentName) {
        return this.elapsedTime(this.intervals.filter(function (i) { return i.segmentName === segmentName; }));
    };
    TimeMinder.prototype.setTimeRemaining = function (ms) {
        var wasRunning = this.isRunning();
        if (wasRunning) {
            this.pause();
        }
        this.intervals.push({ adjustment: this.getTimeRemaining() - ms });
        if (wasRunning) {
            this.unpause();
        }
    };
    TimeMinder.prototype.pause = function () {
        if (!this.isRunning()) {
            return;
        }
        clearTimeout(this.timeout);
        // People running around with chainsaws is not Leah's thing.
        this.intervals[this.intervals.length - 1].end = new Date();
        // Pause all tick timers that don't run when paused.
        for (var _i = 0, _a = this.tickTimers; _i < _a.length; _i++) {
            var timer = _a[_i];
            if (!timer.runWhenPaused) {
                timer.timer.pause();
            }
        }
    };
    TimeMinder.prototype.isRunning = function () {
        return this.intervals.length && this.intervals[this.intervals.length - 1].end === null;
    };
    return TimeMinder;
}());
module.exports = { TimeMinder: TimeMinder, Stopwatch: Stopwatch, ManagedTimer: ManagedTimer };
