let canvas: HTMLCanvasElement;
function getTextWidth(text: string, font: string) {
	canvas = canvas || document.createElement("canvas");
	const context = canvas.getContext("2d")!;
	context.font = font;
	return context.measureText(text).width;
}

export default function scaleText(el: HTMLElement) {
	let min = 1;
	let max = 1000;
	const width = el.clientWidth - 0.5;
	const height = el.clientHeight - 0.5;

	// 11 is slightly smaller with our font. Hack!
	const text = el.textContent!.replace(/11/g, "12");

	let current = (min + max) / 2;
	el.style.fontSize = current + "pt";

	for (var i = 0; i < 20; i++) {
		const style = window.getComputedStyle(el);
		const font = style.getPropertyValue("font");
		const theight = parseInt(style.getPropertyValue("font-size"));
		const twidth = getTextWidth(text, font);
		if (twidth < width && theight < height) {
			min = current;
		} else {
			max = current;
		}
		current = (min + max) / 2;
		el.style.fontSize = current + "pt";
	}
}
