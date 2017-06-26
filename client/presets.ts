import { SimpleTimerOptions, StandardTimerOptions, TimerPreset, TimerType } from "./interfaces";

export const StandardBaseOptions: StandardTimerOptions = {
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

export const SimpleBaseOptions: SimpleTimerOptions = {
	allowableAdditionalEnds: 0,
	lengthOfSecond: 1000,
	noMoreEndsTime: 10 * 60,
	numEnds: 8,
	warningTime: 15 * 60,
	timerName: "",
	totalTime: 120 * 60,
};

export const TimerPresets: TimerPreset[] = [
	{
		id: "10-end",
		name: "10 Ends",
		options: { ...StandardBaseOptions },
		type: TimerType.Standard,
	},
	{
		id: "8-end",
		name: "8 Ends",
		options: {
			...StandardBaseOptions,
			thinkingTime: 30 * 60,
			numEnds: 8,
		},
		type: TimerType.Standard,
	},
	{
		id: "mixed-doubles",
		name: "Mixed Doubles",
		options: {
			...StandardBaseOptions,
			thinkingTime: 22 * 60,
			numEnds: 8,
		},
		type: TimerType.Standard,
	},
	{
		id: "2-hour",
		name: "2 Hours (8 Ends)",
		options: {
			...SimpleBaseOptions,
		},
		type: TimerType.Simple,
	},
	{
		id: "3-hour",
		name: "3 Hours (10 Ends)",
		options: {
			...SimpleBaseOptions,
			numEnds: 10,
			totalTime: 180 * 60,
		},
		type: TimerType.Simple,
	},
];
