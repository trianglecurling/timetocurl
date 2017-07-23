import scaleText from "./scaletext";
import { StateAndOptions, SimpleStateAndOptions, StandardStateAndOptions } from "./interfaces";

export function instanceOfAny(obj: any, types: any[]) {
	for (const type of types) {
		if (obj instanceof type) {
			return true;
		}
	}
	return false;
}

export function getDisplayedTimers(): string[] {
	const hash = window.location.hash;
	if (hash.length > 0) {
		return hash.substr(1).split(";");
	}
	return [];
}

export function setTimersInHash(ids: string[]) {
	window.location.hash = `#${ids.join(";")}`;
}

export function uuid(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0,
			v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export function isSimpleTimer(machine: StateAndOptions): machine is SimpleStateAndOptions {
	return machine.type === "simple";
}

export function isStandardTimer(machine: StateAndOptions): machine is StandardStateAndOptions {
	return machine.type === "standard";
}

export function calculateScrollbarWidth() {
	const c1 = document.createElement("div");
	const c2 = document.createElement("div");

	c1.style.width = "500px";
	c1.style.height = "500px";
	c1.style.position = "absolute";
	c1.style.top = "-1000px";
	c1.style.left = "-1000px";
	c1.style.overflow = "hidden";

	c2.style.position = "absolute";
	c2.style.top = "0";
	c2.style.left = "0";
	c2.style.right = "0";
	c2.style.bottom = "0";
	c2.style.overflow = "scroll";

	c1.appendChild(c2);
	document.body.appendChild(c1);

	const scrollbarWidth = c2.clientWidth - c2.offsetWidth;
	c1.remove();

	return scrollbarWidth;
}

export function roundPrecision(num: number, decimalPlaces: number) {
	const power = Math.pow(10, decimalPlaces);
	return Math.round(num * power) / power;
}

export function forceMonospace(element: Node) {
	for (let i = 0; i < element.childNodes.length; i++) {
		const child = element.childNodes[i];

		if (child.nodeType === Node.TEXT_NODE) {
			const $wrapper = document.createDocumentFragment();

			for (i = 0; i < child.nodeValue!.length; i++) {
				const $char = document.createElement("span");
				const val = child.nodeValue!.charAt(i);
				const charCode = val.charCodeAt(0);
				$char.className = "char" + (charCode >= 48 && charCode < 58 ? " digit" : "");
				$char.textContent = val;

				$wrapper.appendChild($char);
			}

			element.replaceChild($wrapper, child);
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			forceMonospace(child);
		}
	}
}

export function secondsToStr(seconds: number) {
	const clampedSeconds = Math.max(0, seconds);
	const h = Math.floor(clampedSeconds / 3600);
	const m = Math.floor((clampedSeconds - 3600 * h) / 60);
	const s = Math.floor(clampedSeconds - h * 3600 - m * 60);
	const slz = s < 10 ? "0" + String(s) : String(s);
	const mlz = h > 0 && m < 10 ? "0" + String(m) : String(m);
	const hwcolon = h > 0 ? String(h) + ":" : "";
	return `${hwcolon}${mlz}:${slz}`;
}

export function strToSeconds(str: string) {
	const sanitized = str.trim();
	const justSeconds = sanitized.match(/^(\d+)\s*((s|sec|second|seconds)\.?)?$/);
	if (justSeconds && justSeconds.length >= 2) {
		// Just one number - assume seconds
		return Number(justSeconds[1]);
	}

	const colonTime = sanitized.match(/^(?:(\d*):)?(\d*):(\d*)$/);
	if (colonTime && colonTime.length >= 3) {
		// In the format of [hh:]mm:ss, e.g. 8:22, 1:02:53, :56, or 20:
		return 3600 * Number(colonTime[1] || 0) + 60 * Number(colonTime[2]) + Number(colonTime[3]);
	}

	const verbose = sanitized
		.replace(",", "")
		.match(
			/^(?:(\d+)\s*(?:(?:h|hr|hrs|hour|hours)\.?))?\s*(?:(\d+)\s*(?:(?:m|min|mins|minute|minutes)\.?))?\s*(?:(\d+)\s*(?:(?:s|sec|secs|second|seconds)\.?))?$/,
		);
	if (verbose && verbose.length >= 4) {
		// In the format of hh hours mm minutes ss seconds, e.g.
		// 2h3m1s, 3 hours, 1 hour, 2 minutes, 3 seconds, etc.
		return 3600 * Number(verbose[1] || "0") + 60 * Number(verbose[2] || "0") + Number(verbose[3] || "0");
	}

	return null;
}

export function setTimeToElem(elem: HTMLElement, seconds: number) {
	setMonospaceText(elem, secondsToStr(seconds));
}

export function setMonospaceText(elem: HTMLElement, text: string) {
	elem.innerHTML = "";
	elem.textContent = text;
	scaleText(elem);
	forceMonospace(elem);
}

// 1 => 1st, 10 => 10th, 13 => 13th, 101 => 101st, etc.
export function getOrdinalAdjective(num: number): HTMLElement {
	const elem = document.createElement("span");
	elem.classList.add("ordinal-adjective");

	const cardinalNumber = document.createElement("span");
	cardinalNumber.classList.add("cardinal-number");
	cardinalNumber.textContent = String(num);

	const superScript = document.createElement("sup");
	if (num % 100 > 10 && num % 100 < 14) {
		superScript.textContent = "th";
	} else {
		switch (num % 10) {
			case 1:
				superScript.textContent = "st";
				break;
			case 2:
				superScript.textContent = "nd";
				break;
			case 3:
				superScript.textContent = "rd";
				break;
			default:
				superScript.textContent = "th";
		}
	}
	elem.appendChild(cardinalNumber);
	elem.appendChild(superScript);
	return elem;
}

export const clientId = uuid();
