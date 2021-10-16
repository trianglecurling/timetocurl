import fscreen from "fscreen";

let currentOverlay: HTMLElement | null = null;
let currentDialog: HTMLElement | null = null;
let resolver: ((value?: boolean | PromiseLike<boolean>) => void) | undefined = undefined;

export default async function confirm(
	message: string | HTMLElement,
	title: string | null = null,
	okText: string = "OK",
	cancelText: string = "Cancel",
) {
	document.body.classList.add("scroll-disabled");
	const dialog = document.createElement("div");
	const overlay = document.createElement("div");

	dialog.classList.add("confirm-dialog");
	overlay.classList.add("modal-overlay");

	// Title
	const titleArea = document.createElement("div");
	titleArea.classList.add("confirm-dialog-title");
	const titleElement = document.createElement("span");
	titleElement.classList.add("title");

	if (title === null) {
		titleArea.classList.add("irrelevant");
	} else {
		titleElement.textContent = title;
	}
	titleArea.appendChild(titleElement);

	// Message
	const messageArea = document.createElement("div");
	messageArea.classList.add("confirm-dialog-message");
	let messageElement: HTMLElement;
	if (typeof message === "string") {
		messageElement = document.createElement("div");
		messageElement.textContent = message;
	} else {
		messageElement = message;
	}
	messageArea.appendChild(messageElement);

	// Buttons
	const buttonsArea = document.createElement("div");
	buttonsArea.classList.add("confirm-dialog-buttons");
	const okButton = document.createElement("button");
	const cancelButton = document.createElement("button");
	okButton.classList.add("confirm-ok-button");
	cancelButton.classList.add("confirm-cancel-button");
	okButton.textContent = okText;
	cancelButton.textContent = cancelText;

	const promise = new Promise((resolve, reject) => {
		okButton.addEventListener("click", resolve);
		cancelButton.addEventListener("click", reject);
	});

	buttonsArea.appendChild(okButton);
	buttonsArea.appendChild(cancelButton);

	// Compose
	dialog.appendChild(titleArea);
	dialog.appendChild(messageArea);
	dialog.appendChild(buttonsArea);

	// Render
	const appendToElement = fscreen.fullscreenElement || document.body;
	appendToElement.appendChild(overlay);
	appendToElement.appendChild(dialog);

	currentOverlay = overlay;
	currentDialog = dialog;

	try {
		await promise;
		return onConfirmButtonClick(true);
	} catch {
		return onConfirmButtonClick(false);
	}
}

function onConfirmButtonClick(value: boolean) {
	document.body.classList.remove("scroll-disabled");
	if (currentOverlay) {
		currentOverlay.remove();
	}
	if (currentDialog) {
		currentDialog.remove();
	}
	return value;
}
