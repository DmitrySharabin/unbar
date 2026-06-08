chrome.commands.onCommand.addListener(async command => {
	if (command !== "quick-unbar") return;

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab) return;

	const data = await chrome.storage.local.get(["slots", "defaultSlot", "width", "height"]);
	let w = data.width || 1280;
	let h = data.height || 800;

	if (data.slots && data.defaultSlot != null) {
		const slot = data.slots[data.defaultSlot];
		if (slot) {
			w = slot.w;
			h = slot.h;
		}
	}

	await chrome.windows.create({ tabId: tab.id, type: "popup", width: w, height: h });
});
