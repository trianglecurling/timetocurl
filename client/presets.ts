import { TimerOptions, TimerPreset } from "./interfaces";

export const BaseOptions: TimerOptions = {
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

export const TimerPresets: TimerPreset[] = [
	{
		id: "10-end",
		name: "10 Ends",
		options: { ...BaseOptions },
	},
	{
		id: "8-end",
		name: "8 Ends",
		options: {
			...BaseOptions,
			thinkingTime: 30 * 60,
			numEnds: 8,
		},
	},
	{
		id: "mixed-doubles",
		name: "Mixed Doubles",
		options: {
			...BaseOptions,
			thinkingTime: 22 * 60,
			numEnds: 8,
		},
	},
];
