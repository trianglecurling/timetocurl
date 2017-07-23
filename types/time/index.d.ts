declare class Stopwatch {
	constructor(onDispose?: (timerData: any) => void);
	public dispose(): void;
	public start(): void;
	public unpause(): void;
	public every(
		ms: number,
		callback: (isImmediateInvocation?: boolean) => void,
		runWhenPaused?: boolean,
		invokeImmediately?: boolean,
	): void;
	public split(): void;
	public getSplits(): number[];
	public elapsedTime(): number;
	public getTotalTimeSinceStart(): number;
	public pause(): void;
	public isRunning(): boolean;
}

declare class TimeMinder extends Stopwatch {
	constructor(totalTime: number, onComplete?: (timerData: any) => void, onDispose?: (timerData: any) => void);
	public getTimeRemaining(): number;
}
