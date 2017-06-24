"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseOptions = {
    betweenEndTime: 60,
    extraEndThinkingTime: 4.5 * 60,
    lengthOfSecond: 1000,
    midGameBreakTime: 5 * 60,
    numEnds: 10,
    numTimeouts: 1,
    teams: ["Red", "Yellow"],
    thinkingTime: 38 * 60,
    timeoutTime: 60,
    timerName: "",
    travelTime: { home: 20, away: 40 },
    warmupTime: 9 * 60,
};
exports.TimerPresets = [
    {
        id: "10-end",
        name: "10 Ends",
        options: Object.assign({}, exports.BaseOptions),
    },
    {
        id: "8-end",
        name: "8 Ends",
        options: Object.assign({}, exports.BaseOptions, { thinkingTime: 30 * 60, numEnds: 8 }),
    },
    {
        id: "mixed-doubles",
        name: "Mixed Doubles",
        options: Object.assign({}, exports.BaseOptions, { thinkingTime: 22 * 60, numEnds: 8 }),
    },
];
