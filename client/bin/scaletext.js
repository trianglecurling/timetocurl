"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let canvas;
function getTextWidth(text, font) {
    canvas = canvas || document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
}
function scaleText(el) {
    let min = 1;
    let max = 1000;
    const width = el.clientWidth - 0.5;
    const height = el.clientHeight - 0.5;
    // 11 is slightly smaller with our font. Hack!
    const text = el.textContent.replace(/11/g, "12");
    let current = (min + max) / 2;
    el.style.fontSize = current + "pt";
    for (var i = 0; i < 10; i++) {
        const style = window.getComputedStyle(el);
        const font = style.getPropertyValue("font");
        const theight = parseInt(style.getPropertyValue("font-size"));
        const twidth = getTextWidth(text, font);
        if (twidth < width && theight < height) {
            min = current;
        }
        else {
            max = current;
        }
        current = (min + max) / 2;
        el.style.fontSize = current + "pt";
    }
}
exports.default = scaleText;
