"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardBaseOptions = {
    betweenEndTime: 60,
    extraEndThinkingTime: 4.5 * 60,
    lengthOfSecond: 1000,
    midGameBreakTime: 5 * 60,
    numEnds: 10,
    numTimeouts: 1,
    sounds: {
        start: "",
        end: "",
    },
    teams: ["Red", "Yellow"],
    thinkingTime: 38 * 60,
    timeoutTime: 60,
    timerName: "",
    travelTime: { home: 20, away: 40 },
    warmupTime: 9 * 60,
};
exports.SimpleBaseOptions = {
    allowableAdditionalEnds: 0,
    lengthOfSecond: 1000,
    noMoreEndsTime: 10 * 60,
    numEnds: 8,
    showPacing: true,
    sounds: {
        end: "",
        noMoreEnds: "cowbell.mp3",
        start: "",
        warning: "",
    },
    timerName: "",
    totalTime: 120 * 60,
    warningTime: 15 * 60,
};
exports.TimerPresets = [
    {
        id: "10-end",
        name: "10 Ends",
        options: Object.assign({}, exports.StandardBaseOptions),
        type: "standard" /* Standard */,
    },
    {
        id: "8-end",
        name: "8 Ends",
        options: Object.assign({}, exports.StandardBaseOptions, { thinkingTime: 30 * 60, numEnds: 8 }),
        type: "standard" /* Standard */,
    },
    {
        id: "mixed-doubles",
        name: "Mixed Doubles",
        options: Object.assign({}, exports.StandardBaseOptions, { thinkingTime: 22 * 60, numEnds: 8 }),
        type: "standard" /* Standard */,
    },
    {
        id: "1.5-hour",
        name: "1½ Hours (6 Ends)",
        options: Object.assign({}, exports.SimpleBaseOptions, { numEnds: 6, totalTime: 90 * 60 }),
        type: "simple" /* Simple */,
    },
    {
        id: "2-hour",
        name: "2 Hours (8 Ends)",
        options: Object.assign({}, exports.SimpleBaseOptions),
        type: "simple" /* Simple */,
    },
    {
        id: "2.5-hour",
        name: "2½ Hours (10 Ends)",
        options: Object.assign({}, exports.SimpleBaseOptions, { numEnds: 10, totalTime: 150 * 60 }),
        type: "simple" /* Simple */,
    },
];
