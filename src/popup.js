const DEFAULTS = [
	{ w: 1280, h: 800, label: "16:10" },
	{ w: 1920, h: 1080, label: "Full HD" },
	{ w: 1024, h: 768, label: "4:3" },
	{ w: 1440, h: 900, label: "16:10" },
	null,
	null,
	null,
	null,
	null,
];

const RATIOS = [
	[16, 9],
	[16, 10],
	[4, 3],
	[21, 9],
	[3, 2],
	[5, 4],
	[1, 1],
	[32, 9],
];

const LINKED =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l6-6"/><path d="M11 6l.463-.536a5 5 0 017.071 7.072l-.534.464"/><path d="M13 18l-.397.534a5.068 5.068 0 01-7.127 0 4.972 4.972 0 010-7.071l.524-.463"/></svg>';
const UNLINKED =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a3.5 3.5 0 005 0l4-4a3.5 3.5 0 00-5-5l-.5.5"/><path d="M14 10a3.5 3.5 0 00-5 0l-4 4a3.5 3.5 0 005 5l.5-.5"/><line x1="16" y1="21" x2="16" y2="19"/><line x1="19" y1="16" x2="21" y2="16"/><line x1="3" y1="8" x2="5" y2="8"/><line x1="8" y1="3" x2="8" y2="5"/></svg>';
const PENCIL =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>';
const TRASH =
	'<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2.5 3.5h9M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M3.5 3.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8"/></svg>';

let slots = [];
let defaultSlot = 0;
let editing = -1;
let locked = false;
let ratio = 1;

function gcd (a, b) {
	return b ? gcd(b, a % b) : a;
}

function ratioLabel (width, height) {
	if (!width || !height) {
		return "";
	}

	const aspect = width / height;
	for (const [rw, rh] of RATIOS) {
		if (Math.abs(rw / rh - aspect) < 0.01) {
			return `${rw}:${rh}`;
		}
	}

	const divisor = gcd(width, height);
	return `${width / divisor}:${height / divisor}`;
}

function esc (str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function flagInvalid (input) {
	input.style.borderColor = "var(--danger)";
	input.focus();
}

async function loadSlots () {
	const data = await chrome.storage.local.get(["slots", "defaultSlot"]);

	slots = Array.isArray(data.slots) ? data.slots : [...DEFAULTS];
	while (slots.length < 9) {
		slots.push(null);
	}
	defaultSlot = data.defaultSlot ?? 0;
}

async function saveSlots () {
	await chrome.storage.local.set({ slots, defaultSlot });
}

async function unbar (index) {
	const slot = slots[index];
	if (!slot) {
		return;
	}

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab) {
		return;
	}

	defaultSlot = index;
	await chrome.storage.local.set({ defaultSlot, width: slot.w, height: slot.h });
	await chrome.windows.create({ tabId: tab.id, type: "popup", width: slot.w, height: slot.h });
	window.close();
}

async function unbarAuto () {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab) {
		return;
	}

	const width = screen.availWidth;
	const height = screen.availHeight;
	defaultSlot = "auto";
	await chrome.storage.local.set({ defaultSlot });
	await chrome.windows.create({ tabId: tab.id, type: "popup", width, height });
	window.close();
}

function openEditor (index) {
	editing = index;
	locked = false;
	render();

	document.getElementById("width")?.focus();
}

function closeEditor () {
	editing = -1;
	render();
}

async function save () {
	const widthEl = document.getElementById("width");
	const heightEl = document.getElementById("height");
	const width = Math.round(+widthEl.value);
	const height = Math.round(+heightEl.value);
	const label = document.getElementById("label").value.trim();

	if (!(width >= 200 && width <= 7680)) {
		flagInvalid(widthEl);
		return;
	}
	if (!(height >= 200 && height <= 4320)) {
		flagInvalid(heightEl);
		return;
	}

	slots[editing] = { w: width, h: height, label };
	await saveSlots();
	closeEditor();
}

async function clear () {
	const ref = slots[defaultSlot];
	slots.splice(editing, 1);
	slots.push(null);

	if (defaultSlot !== "auto") {
		if (ref && slots.includes(ref)) {
			defaultSlot = slots.indexOf(ref);
		}
		else {
			const first = slots.findIndex(Boolean);
			defaultSlot = first < 0 ? 0 : first;
		}
	}

	await saveSlots();
	closeEditor();
}

function toggleChain () {
	const width = +document.getElementById("width").value;
	const height = +document.getElementById("height").value;

	if (!locked) {
		if (!width || !height) {
			return;
		}
		ratio = width / height;
	}

	locked = !locked;
	syncChain();
}

function onWidth () {
	const input = document.getElementById("width");
	input.style.borderColor = "";

	if (locked && +input.value) {
		document.getElementById("height").value = Math.round(+input.value / ratio);
	}

	syncChain();
}

function onHeight () {
	const input = document.getElementById("height");
	input.style.borderColor = "";

	if (locked && +input.value) {
		document.getElementById("width").value = Math.round(+input.value * ratio);
	}

	syncChain();
}

function syncChain () {
	const btn = document.getElementById("chain");
	if (!btn) {
		return;
	}

	const icon = document.getElementById("chain-icon");
	const ratioEl = document.getElementById("ratio");

	if (locked) {
		btn.classList.add("locked");
		icon.innerHTML = LINKED;
		btn.title = "Aspect ratio locked";

		const width = +document.getElementById("width").value;
		const height = +document.getElementById("height").value;
		ratioEl.textContent = width && height ? ratioLabel(width, height) : "";
	}
	else {
		btn.classList.remove("locked");
		icon.innerHTML = UNLINKED;
		btn.title = "Aspect ratio unlocked";
		ratioEl.textContent = "";
	}
}

function render () {
	const root = document.getElementById("slots");
	let html = "";
	let sawEmpty = false;

	for (let i = 0; i < 9; i++) {
		const slot = slots[i];
		if (!slot && sawEmpty) {
			continue;
		}
		if (!slot) {
			sawEmpty = true;
		}

		if (editing === i) {
			html += editorHTML(i, slot);
			continue;
		}

		const star = slot && i === defaultSlot ? '<span class="star">&#9733;</span>' : "";
		const dim = slot?.label ? `<span class="dim">${esc(slot.label)}</span>` : "";
		const edit = slot
			? `<button class="edit" aria-label="Edit preset" data-action="edit" data-index="${i}">${PENCIL}</button>`
			: "";
		const cls = slot ? "row" : "row empty-slot";
		const text = slot ? `${slot.w} &times; ${slot.h}` : "Add preset…";

		html += `<div class="${cls}">
      <button data-action="row" data-index="${i}">
        <kbd>${i + 1}</kbd>
        <span class="label">${text}</span>
        ${dim}${star}
      </button>
      ${edit}
    </div>`;
	}

	const star = defaultSlot === "auto" ? '<span class="star">&#9733;</span>' : "";
	const auto = `<div class="row auto-row">
    <button data-action="auto">
      <kbd>0</kbd>
      <span class="label">${screen.availWidth} &times; ${screen.availHeight}</span>
      <span class="dim">Fit screen</span>
      ${star}
    </button>
  </div>`;

	root.innerHTML = auto + '<hr class="divider">' + html;
	if (editing >= 0) {
		syncChain();
	}
}

function editorHTML (index, slot) {
	const width = slot ? slot.w : "";
	const height = slot ? slot.h : "";
	const label = slot ? slot.label || "" : "";

	return `<div class="editor">
    <div class="sizes">
      <kbd>${index + 1}</kbd>
      <input type="number" id="width" value="${width}" placeholder="1920" aria-label="Width" min="200" max="7680">
      <button type="button" class="chain" id="chain" data-action="chain">
        <span id="chain-icon">${UNLINKED}</span>
      </button>
      <input type="number" id="height" value="${height}" placeholder="1080" aria-label="Height" min="200" max="4320">
      <span class="ratio-label" id="ratio"></span>
    </div>
    <div class="label">
      <input type="text" id="label" value="${esc(label)}" placeholder="e.g. Full HD" aria-label="Label" maxlength="20">
    </div>
    <div class="actions">
      <button type="button" class="save" data-action="save">Save</button>
      <button type="button" class="cancel" data-action="cancel">Cancel</button>
      ${slot ? `<button type="button" class="delete" data-action="clear" title="Remove this preset">${TRASH}</button>` : ""}
    </div>
  </div>`;
}

function bindEvents () {
	const root = document.getElementById("slots");

	root.addEventListener("click", e => {
		const target = e.target.closest("[data-action]");
		if (!target) {
			return;
		}

		const action = target.dataset.action;
		const idx = target.dataset.index != null ? +target.dataset.index : editing;

		if (action === "edit") {
			openEditor(idx);
		}
		else if (action === "row") {
			slots[idx] ? unbar(idx) : openEditor(idx);
		}
		else if (action === "save") {
			save();
		}
		else if (action === "cancel") {
			closeEditor();
		}
		else if (action === "clear") {
			clear();
		}
		else if (action === "auto") {
			unbarAuto();
		}
		else if (action === "chain") {
			toggleChain();
		}
	});

	root.addEventListener("input", e => {
		if (e.target.id === "width") {
			onWidth();
		}
		else if (e.target.id === "height") {
			onHeight();
		}
	});

	root.addEventListener("keydown", e => {
		if (e.key !== "Enter") {
			return;
		}

		if (e.target.id === "width") {
			document.getElementById("height").focus();
		}
		else if (e.target.id === "height" || e.target.id === "label") {
			save();
		}
	});
}

document.addEventListener("keydown", e => {
	if (editing >= 0) {
		return;
	}
	if (e.target.tagName === "INPUT") {
		return;
	}
	if (e.key === "0") {
		e.preventDefault();
		unbarAuto();
		return;
	}

	const num = parseInt(e.key);
	if (num >= 1 && num <= 9) {
		if (slots[num - 1]) {
			e.preventDefault();
			unbar(num - 1);
		}
		else {
			const last = slots.reduce((max, slot, idx) => (slot ? idx : max), -1);
			if (num - 1 <= last + 1) {
				e.preventDefault();
				openEditor(num - 1);
			}
		}
	}
});

async function init () {
	await loadSlots();
	bindEvents();
	render();

	const commands = await chrome.commands.getAll();
	const cmd = commands.find(c => c.name === "quick-unbar");
	if (cmd?.shortcut) {
		document.getElementById("shortcut-hint").textContent = `${cmd.shortcut} for instant unbar`;
	}
}

init();
