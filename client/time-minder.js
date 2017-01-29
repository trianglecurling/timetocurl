"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TimeMinder = function () {
	function TimeMinder(totalTime, onComplete) {
		_classCallCheck(this, TimeMinder);

		this.totalTime = totalTime;
		this.intervals = [];
		this.onComplete = onComplete;
	}

	_createClass(TimeMinder, [{
		key: "start",
		value: function start() {
			var _this = this;

			if (this.isRunning() || this.getTimeRemaining() <= 0) {
				return;
			}
			this.intervals.push({
				start: new Date(),
				end: null
			});
			this.timeout = setTimeout(function () {
				_this.intervals[_this.intervals.length - 1].end = new Date();
				_this.onComplete(_this.intervals);
			}, this.getTimeRemaining());
		}
	}, {
		key: "getTimeSpent",
		value: function getTimeSpent() {
			return this.intervals.map(function (i) {
				return (i.end && i.end.getTime() || Date.now()) - i.start.getTime();
			}).reduce(function (prev, current) {
				return current + prev;
			}, 0);
		}
	}, {
		key: "getTimeRemaining",
		value: function getTimeRemaining() {
			return this.totalTime - this.getTimeSpent();
		}
	}, {
		key: "getTotalTimeSinceStart",
		value: function getTotalTimeSinceStart() {
			return Date.now() - this.intervals[0].start.getTime();
		}
	}, {
		key: "pause",
		value: function pause() {
			if (!this.isRunning()) {
				return;
			}
			clearTimeout(this.timeout);

			// People running around with chainsaws is not Leah's thing.
			this.intervals[this.intervals.length - 1].end = new Date();
		}
	}, {
		key: "isRunning",
		value: function isRunning() {
			return this.intervals.length && this.intervals[this.intervals.length - 1].end === null;
		}
	}]);

	return TimeMinder;
}();