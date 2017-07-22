declare module "fscreen" {
	namespace fscreen {
		export const fullscreenEnabled: boolean;
		export const fullscreenElement: Element | null;
		export const requestFullscreen: (elem: Element) => void;
		export const requestFullscreenFunction: (elem: Element) => () => void;
		export const exitFullscreen: () => void;
		export let onfullscreenchange: Function;
		export const addEventListener: (
			event: "fullscreenchange" | "fullscreenerror",
			handler: () => void,
			options?: any,
		) => void;
		export const removeEventListener: (event: "fullscreenchange" | "fullscreenerror", handler: () => void) => void;
		export let onfullscreenerror: Function;
	}
	export default fscreen;
}
