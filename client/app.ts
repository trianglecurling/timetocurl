interface TimerOptions {
	thinkingTime?: number;
	numTimeouts?: number;
	timeoutTime?: number;
	betweenEndTime?: number;
	midGameBreakTime?: number;
	teams?: string[];
	warmupTime?: number;
}

interface SocketAction<TOptions> {
	request: string;
	options: TOptions;
	token: string;
}

interface SocketResponse<TData> {
	response: string;
	token: string;
	data: TData;
}

interface CurlingMachineState {
	end: number | null;
	phase: string;
	phaseData: {[key: string]: string};
	timeRemaining: number;
	timeoutsRemaining: number;
	timeoutTimeRemaining: number;
	currentlyThinking: string | null;
	currentlyRunningTimeout: string | null;
	betweenEndTimeRemaining: number;
}

function uuid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
}

class TimeToCurl {
	private socket: SocketIOClient.Socket;
	private requests: {[key: string]: any};
	private requestResolvers: {[key: string]: (value?: any | PromiseLike<any>) => void};

	public init() {
		this.setUpEvents();
		this.socket = io();
		this.requests = {};
		this.requestResolvers = {};

		this.socket.on("response", (result: string) => {
			let response: SocketResponse<any>;
			try {
				response = JSON.parse(result);
			} catch (ex) {
				throw new Error(`Could not parse response as JSON: ${result}`);
			}

			// Did we ask for this data?
			if (this.requestResolvers[response.token]) {
				this.requests[response.token] = response;
				this.requestResolvers[response.token].call(this, response);
			} else {
				console.warn(`Unexpected data from the server: ${result}`);
			}
		});
	}

	// private handleResponse(data: SocketResponse<any>) {
	// 	if (data.response === "CREATE_TIMER") {
	// 		this.handleCreateTimer(data.data);
	// 	}
	// }

	private handleCreateTimer(curlingMachineState: CurlingMachineState) {
		
	}

	private setUpEvents() {
		document.addEventListener("DOMContentLoaded", () => {
			document.getElementById("createTimer")!.addEventListener("click", () => {
				this.emitAction<TimerOptions, CurlingMachineState>(<SocketAction<TimerOptions>>{
					request: "CREATE_TIMER",
					options: {

					}
				}).then(response => {
					console.log(`New curling machine added: ${JSON.stringify(response.data, null, 4)}`);
				});
			});
		});
	}

	private emitAction<TAction, TResponse>(action: SocketAction<TAction>): PromiseLike<SocketResponse<TResponse>> {
		return new Promise<SocketResponse<TResponse>>((resolve, reject) => {
			const token = uuid();
			action.token = token;
			this.socket.emit("action", JSON.stringify(action));
			this.requestResolvers[token] = resolve;
		});
	}
}

new TimeToCurl().init();