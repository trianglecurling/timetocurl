"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scaletext_1 = require("./scaletext");
function instanceOfAny(obj, types) {
    for (const type of types) {
        if (obj instanceof type) {
            return true;
        }
    }
    return false;
}
exports.instanceOfAny = instanceOfAny;
function getDisplayedTimers() {
    const hash = window.location.pathname.substr(3);
    if (hash.length > 0) {
        return hash.substr(1).split(";");
    }
    return [];
}
exports.getDisplayedTimers = getDisplayedTimers;
function setTimersInHash(ids) {
    window.history.replaceState(null, document.title, `${window.location.origin}/t/${ids.join(";")}`);
}
exports.setTimersInHash = setTimersInHash;
function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
exports.uuid = uuid;
function isSimpleTimer(machine) {
    return machine.type === "simple";
}
exports.isSimpleTimer = isSimpleTimer;
function isStandardTimer(machine) {
    return machine.type === "standard";
}
exports.isStandardTimer = isStandardTimer;
function calculateScrollbarWidth() {
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
exports.calculateScrollbarWidth = calculateScrollbarWidth;
function roundPrecision(num, decimalPlaces) {
    const power = Math.pow(10, decimalPlaces);
    return Math.round(num * power) / power;
}
exports.roundPrecision = roundPrecision;
function forceMonospace(element) {
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
            const $wrapper = document.createDocumentFragment();
            for (i = 0; i < child.nodeValue.length; i++) {
                const $char = document.createElement("span");
                const val = child.nodeValue.charAt(i);
                const charCode = val.charCodeAt(0);
                $char.className = "char" + (charCode >= 48 && charCode < 58 ? " digit" : "");
                $char.textContent = val;
                $wrapper.appendChild($char);
            }
            element.replaceChild($wrapper, child);
        }
        else if (child.nodeType === Node.ELEMENT_NODE) {
            forceMonospace(child);
        }
    }
}
exports.forceMonospace = forceMonospace;
function secondsToStr(seconds) {
    const clampedSeconds = Math.max(0, seconds);
    const h = Math.floor(clampedSeconds / 3600);
    const m = Math.floor((clampedSeconds - 3600 * h) / 60);
    const s = Math.floor(clampedSeconds - h * 3600 - m * 60);
    const slz = s < 10 ? "0" + String(s) : String(s);
    const mlz = h > 0 && m < 10 ? "0" + String(m) : String(m);
    const hwcolon = h > 0 ? String(h) + ":" : "";
    return `${hwcolon}${mlz}:${slz}`;
}
exports.secondsToStr = secondsToStr;
function strToSeconds(str) {
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
        .match(/^(?:(\d+)\s*(?:(?:h|hr|hrs|hour|hours)\.?))?\s*(?:(\d+)\s*(?:(?:m|min|mins|minute|minutes)\.?))?\s*(?:(\d+)\s*(?:(?:s|sec|secs|second|seconds)\.?))?$/);
    if (verbose && verbose.length >= 4) {
        // In the format of hh hours mm minutes ss seconds, e.g.
        // 2h3m1s, 3 hours, 1 hour, 2 minutes, 3 seconds, etc.
        return 3600 * Number(verbose[1] || "0") + 60 * Number(verbose[2] || "0") + Number(verbose[3] || "0");
    }
    return null;
}
exports.strToSeconds = strToSeconds;
function setTimeToElem(elem, seconds) {
    setMonospaceText(elem, secondsToStr(seconds));
}
exports.setTimeToElem = setTimeToElem;
const scaledElements = new Set();
(function () {
    window.addEventListener("resize", resizeThrottler);
    let resizeTimeout = null;
    function resizeThrottler() {
        // ignore resize events as long as an actualResizeHandler execution is in the queue
        if (!resizeTimeout) {
            resizeTimeout = setTimeout(function () {
                resizeTimeout = null;
                actualResizeHandler();
                // The actualResizeHandler will execute at a rate of 10fps
            }, 100);
        }
    }
    function actualResizeHandler() {
        for (const elem of scaledElements) {
            scaletext_1.default(elem);
        }
    }
})();
function invalidateScaledText() {
    scaledElements.clear();
}
exports.invalidateScaledText = invalidateScaledText;
function refitScaledElements() {
    for (const elem of scaledElements) {
        scaletext_1.default(elem);
    }
}
exports.refitScaledElements = refitScaledElements;
function setMonospaceText(elem, text) {
    elem.innerHTML = "";
    elem.textContent = text;
    if (!scaledElements.has(elem)) {
        scaledElements.add(elem);
        scaletext_1.default(elem);
    }
    forceMonospace(elem);
}
exports.setMonospaceText = setMonospaceText;
// 1 => 1st, 10 => 10th, 13 => 13th, 101 => 101st, etc.
function getOrdinalAdjective(num) {
    const elem = document.createElement("span");
    elem.classList.add("ordinal-adjective");
    const cardinalNumber = document.createElement("span");
    cardinalNumber.classList.add("cardinal-number");
    cardinalNumber.textContent = String(num);
    const superScript = document.createElement("sup");
    if (num % 100 > 10 && num % 100 < 14) {
        superScript.textContent = "th";
    }
    else {
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
exports.getOrdinalAdjective = getOrdinalAdjective;
exports.clientId = uuid();
