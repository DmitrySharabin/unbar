const DEFAULTS = [
	{ width: 1280, height: 800, label: "16:10" },
	{ width: 1920, height: 1080, label: "Full HD" },
	{ width: 1024, height: 768, label: "4:3" },
	{ width: 1440, height: 900, label: "16:10" },
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
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
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
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab) {
		return;
	}

	let width, height;

	if (index != null) {
		const slot = slots[index];
		if (!slot) {
			return;
		}
		width = slot.width;
		height = slot.height;
		defaultSlot = index;
		await chrome.storage.local.set({ defaultSlot, width, height });
	}
	else {
		width = screen.availWidth;
		height = screen.availHeight;
		defaultSlot = "auto";
		await chrome.storage.local.set({ defaultSlot });
	}

	await chrome.windows.create({ tabId: tab.id, type: "popup", width, height });
	window.close();
}

function openEditor (index) {
	editing = index;
	locked = false;
	render();

	document.querySelector("form")?.elements.width?.focus();
}

function closeEditor () {
	const index = editing;
	editing = -1;
	render();

	const target =
		document.querySelector(`[data-action="row"][data-index="${index}"]`) ??
		document.querySelector("[data-action]");
	target?.focus();
}

async function save (form) {
	const { width, height, label } = form.elements;
	slots[editing] = {
		width: Math.round(+width.value),
		height: Math.round(+height.value),
		label: label.value.trim(),
	};
	await saveSlots();
	closeEditor();
}

async function remove () {
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
	const form = document.querySelector("form");
	const width = +form.elements.width.value;
	const height = +form.elements.height.value;

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
	if (locked) {
		const form = document.querySelector("form");
		const width = +form.elements.width.value;
		if (width) {
			form.elements.height.value = Math.round(width / ratio);
		}
	}

	syncChain();
}

function onHeight () {
	if (locked) {
		const form = document.querySelector("form");
		const height = +form.elements.height.value;
		if (height) {
			form.elements.width.value = Math.round(height * ratio);
		}
	}

	syncChain();
}

function syncChain () {
	const chain = document.getElementById("chain");
	if (!chain) {
		return;
	}

	chain.ariaPressed = locked;
	chain.title = locked ? "Aspect ratio locked" : "Aspect ratio unlocked";

	const output = document.getElementById("ratio");
	if (locked) {
		const form = document.querySelector("form");
		const width = +form.elements.width.value;
		const height = +form.elements.height.value;
		output.textContent = width && height ? ratioLabel(width, height) : "";
	}
	else {
		output.textContent = "";
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
			html += `<li>${editorHTML(i, slot)}</li>`;
			continue;
		}

		const star = slot && i === defaultSlot ? '<span class="star">&#9733;</span>' : "";
		const dim = slot?.label ? `<span class="dim">${esc(slot.label)}</span>` : "";
		const edit = slot
			? `<button class="edit" aria-label="Edit preset" data-action="edit" data-index="${i}"><svg width="14" height="14"><use href="#icon-pencil"/></svg></button>`
			: "";
		const cls = slot ? "row" : "row empty-slot";
		const text = slot ? `${slot.width} &times; ${slot.height}` : "Add preset…";

		html += `<li class="${cls}">
      <button data-action="row" data-index="${i}">
        <kbd>${i + 1}</kbd>
        <span class="label">${text}</span>
        ${dim}${star}
      </button>
      ${edit}
    </li>`;
	}

	const star = defaultSlot === "auto" ? '<span class="star">&#9733;</span>' : "";
	const auto = `<li class="row auto-row">
    <button data-action="auto">
      <kbd>0</kbd>
      <span class="label">${screen.availWidth} &times; ${screen.availHeight}</span>
      <span class="dim">Fit screen</span>
      ${star}
    </button>
  </li>`;

	root.innerHTML = auto + '<hr class="divider">' + html;
	if (editing >= 0) {
		syncChain();
	}
}

function editorHTML (index, slot) {
	const width = slot ? slot.width : "";
	const height = slot ? slot.height : "";
	const label = slot ? slot.label || "" : "";

	return `<form class="editor">
    <div class="sizes">
      <kbd>${index + 1}</kbd>
      <input type="number" name="width" value="${width}" placeholder="1920" aria-label="Width" min="200" required>
      <button type="button" class="chain" id="chain" data-action="chain">
        <svg class="linked" width="16" height="16"><use href="#icon-linked"/></svg>
        <svg class="unlinked" width="16" height="16"><use href="#icon-unlinked"/></svg>
      </button>
      <input type="number" name="height" value="${height}" placeholder="1080" aria-label="Height" min="200" required>
      <output id="ratio"></output>
    </div>
    <label>
      <input type="text" name="label" value="${esc(label)}" placeholder="e.g. Full HD" aria-label="Label" maxlength="20">
    </label>
    <footer>
      <button type="submit" class="save">Save</button>
      <button type="button" class="cancel" data-action="cancel">Cancel</button>
      ${slot ? `<button type="button" class="remove" data-action="remove" title="Remove this preset"><svg width="14" height="14"><use href="#icon-trash"/></svg></button>` : ""}
    </footer>
  </form>`;
}

function bindEvents () {
	const root = document.getElementById("slots");

	root.addEventListener("click", event => {
		const target = event.target.closest("[data-action]");
		if (!target) {
			return;
		}

		const action = target.dataset.action;
		const index = target.dataset.index != null ? +target.dataset.index : editing;

		if (action === "edit") {
			openEditor(index);
		}
		else if (action === "row") {
			slots[index] ? unbar(index) : openEditor(index);
		}
		else if (action === "cancel") {
			closeEditor();
		}
		else if (action === "remove") {
			remove();
		}
		else if (action === "auto") {
			unbar();
		}
		else if (action === "chain") {
			toggleChain();
		}
	});

	root.addEventListener("submit", event => {
		event.preventDefault();
		save(event.target);
	});

	root.addEventListener("input", event => {
		if (event.target.name === "width") {
			onWidth();
		}
		else if (event.target.name === "height") {
			onHeight();
		}
	});

	root.addEventListener("keydown", event => {
		if (event.key === "Escape" && editing >= 0) {
			event.preventDefault();
			closeEditor();
		}
		else if (event.key === "Enter" && event.target.name === "width") {
			event.preventDefault();
			document.querySelector("form").elements.height.focus();
		}
	});
}

document.addEventListener("keydown", event => {
	if (editing >= 0) {
		return;
	}
	if (event.target.tagName === "INPUT") {
		return;
	}

	if (event.key === "ArrowDown" || event.key === "ArrowUp") {
		const rows = [...document.querySelectorAll(".row")];
		const current = rows.findIndex(row => row.contains(document.activeElement));
		if (current < 0) {
			return;
		}

		event.preventDefault();
		const next =
			event.key === "ArrowDown"
				? (current + 1) % rows.length
				: (current - 1 + rows.length) % rows.length;
		rows[next].querySelector("button")?.focus();
		return;
	}

	if (event.key === "0") {
		event.preventDefault();
		unbar();
		return;
	}

	const num = parseInt(event.key);
	if (num >= 1 && num <= 9) {
		if (slots[num - 1]) {
			event.preventDefault();
			unbar(num - 1);
		}
		else {
			const last = slots.reduce((max, slot, index) => (slot ? index : max), -1);
			if (num - 1 <= last + 1) {
				event.preventDefault();
				openEditor(num - 1);
			}
		}
	}
});

await loadSlots();
bindEvents();
render();
document.querySelector(".star")?.closest(".row")?.querySelector("button")?.focus();

const commands = await chrome.commands.getAll();
const command = commands.find(cmd => cmd.name === "quick-unbar");
if (command?.shortcut) {
	document.getElementById("shortcut-hint").textContent = `${command.shortcut} for instant unbar`;
}
