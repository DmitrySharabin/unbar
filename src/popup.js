const DEFAULT_SLOTS = [
  { w: 1280, h: 800, label: "16:10" },
  { w: 1920, h: 1080, label: "Full HD" },
  { w: 1024, h: 768, label: "4:3" },
  { w: 1440, h: 900, label: "16:10" },
  null, null, null, null, null,
];

let slots = [];
let defaultSlot = 0;
let editingIndex = -1;
let ratioLocked = false;
let aspectRatio = 1;

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

const KNOWN_RATIOS = [
  [16, 9], [16, 10], [4, 3], [21, 9],
  [3, 2], [5, 4], [1, 1], [32, 9],
];

function ratioLabel(w, h) {
  if (!w || !h) return "";
  const r = w / h;
  for (const [rw, rh] of KNOWN_RATIOS) {
    if (Math.abs(rw / rh - r) < 0.01) return `${rw}:${rh}`;
  }
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

async function loadSlots() {
  const data = await chrome.storage.local.get(["slots", "defaultSlot"]);
  slots = Array.isArray(data.slots) ? data.slots : [...DEFAULT_SLOTS];
  while (slots.length < 9) slots.push(null);
  defaultSlot = data.defaultSlot ?? 0;
}

async function saveSlots() {
  await chrome.storage.local.set({ slots, defaultSlot });
}

async function doUnbar(index) {
  const slot = slots[index];
  if (!slot) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  defaultSlot = index;
  await chrome.storage.local.set({ defaultSlot, width: slot.w, height: slot.h });
  await chrome.windows.create({ tabId: tab.id, type: "popup", width: slot.w, height: slot.h });
  window.close();
}

function openEditor(index) {
  editingIndex = index;
  ratioLocked = false;
  render();
  const w = document.getElementById("ed-w");
  if (w) w.focus();
}

function closeEditor() {
  editingIndex = -1;
  render();
}

function handleRowClick(index) {
  if (!slots[index]) openEditor(index);
  else doUnbar(index);
}

async function handleSave() {
  const wEl = document.getElementById("ed-w");
  const hEl = document.getElementById("ed-h");
  const wv = Math.round(+wEl.value);
  const hv = Math.round(+hEl.value);
  const lbl = document.getElementById("ed-label").value.trim();

  if (!(wv >= 200 && wv <= 7680)) { flagInvalid(wEl); return; }
  if (!(hv >= 200 && hv <= 4320)) { flagInvalid(hEl); return; }

  slots[editingIndex] = { w: wv, h: hv, label: lbl };
  await saveSlots();
  closeEditor();
}

function flagInvalid(el) {
  el.style.borderColor = "#e74c3c";
  el.focus();
}

async function handleClear() {
  const defaultRef = slots[defaultSlot];
  slots.splice(editingIndex, 1);
  slots.push(null);
  if (defaultRef && slots.includes(defaultRef)) {
    defaultSlot = slots.indexOf(defaultRef);
  } else {
    const first = slots.findIndex(Boolean);
    defaultSlot = first < 0 ? 0 : first;
  }
  await saveSlots();
  closeEditor();
}

function handleChainToggle() {
  const wv = +document.getElementById("ed-w").value;
  const hv = +document.getElementById("ed-h").value;
  if (!ratioLocked) {
    if (!wv || !hv) return;
    aspectRatio = wv / hv;
  }
  ratioLocked = !ratioLocked;
  updateChainUI();
}

function handleWInput() {
  const wEl = document.getElementById("ed-w");
  wEl.style.borderColor = "";
  if (ratioLocked && +wEl.value) {
    document.getElementById("ed-h").value = Math.round(+wEl.value / aspectRatio);
  }
  updateChainUI();
}

function handleHInput() {
  const hEl = document.getElementById("ed-h");
  hEl.style.borderColor = "";
  if (ratioLocked && +hEl.value) {
    document.getElementById("ed-w").value = Math.round(+hEl.value * aspectRatio);
  }
  updateChainUI();
}

const ICON_LINKED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l6-6"/><path d="M11 6l.463-.536a5 5 0 017.071 7.072l-.534.464"/><path d="M13 18l-.397.534a5.068 5.068 0 01-7.127 0 4.972 4.972 0 010-7.071l.524-.463"/></svg>';
const ICON_UNLINKED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a3.5 3.5 0 005 0l4-4a3.5 3.5 0 00-5-5l-.5.5"/><path d="M14 10a3.5 3.5 0 00-5 0l-4 4a3.5 3.5 0 005 5l.5-.5"/><line x1="16" y1="21" x2="16" y2="19"/><line x1="19" y1="16" x2="21" y2="16"/><line x1="3" y1="8" x2="5" y2="8"/><line x1="8" y1="3" x2="8" y2="5"/></svg>';
const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2.5 3.5h9M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M3.5 3.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8"/></svg>';

function updateChainUI() {
  const chainBtn = document.getElementById("chain-btn");
  if (!chainBtn) return;
  const chainIcon = document.getElementById("chain-icon");
  const ratioLbl = document.getElementById("ratio-lbl");

  if (ratioLocked) {
    chainBtn.classList.add("locked");
    chainIcon.innerHTML = ICON_LINKED;
    chainBtn.title = "Aspect ratio locked";
    const wv = +document.getElementById("ed-w").value;
    const hv = +document.getElementById("ed-h").value;
    ratioLbl.textContent = (wv && hv) ? ratioLabel(wv, hv) : "";
  } else {
    chainBtn.classList.remove("locked");
    chainIcon.innerHTML = ICON_UNLINKED;
    chainBtn.title = "Aspect ratio unlocked";
    ratioLbl.textContent = "";
  }
}

function render() {
  const container = document.getElementById("slots");
  let html = "";
  let shownEmpty = false;

  for (let i = 0; i < 9; i++) {
    const slot = slots[i];
    const isEmpty = !slot;
    if (isEmpty && shownEmpty) continue;
    if (isEmpty) shownEmpty = true;

    if (editingIndex === i) {
      html += buildEditorHTML(i, slot);
      continue;
    }

    const star = !isEmpty && i === defaultSlot ? '<span class="star">&#9733;</span>' : "";
    const dim = !isEmpty && slot.label ? `<span class="dim">${escHtml(slot.label)}</span>` : "";
    const edit = isEmpty ? "" : `<span class="edit-btn" data-action="edit" data-index="${i}">&#9998;</span>`;
    const cls = isEmpty ? "row empty-slot" : "row";
    const text = isEmpty ? "custom" : `${slot.w} &times; ${slot.h}`;

    html += `<button class="${cls}" data-action="row" data-index="${i}">
      <span class="key">${i + 1}</span>
      <span class="label">${text}</span>
      ${dim}${star}${edit}
    </button>`;
  }

  container.innerHTML = html;
  if (editingIndex >= 0) updateChainUI();
}

function buildEditorHTML(index, slot) {
  const w = slot ? slot.w : "";
  const h = slot ? slot.h : "";
  const label = slot ? (slot.label || "") : "";
  const isNew = !slot;

  return `<div class="editor">
    <div class="ed-sizes">
      <span class="key">${index + 1}</span>
      <input type="number" id="ed-w" value="${w}" placeholder="W" min="200" max="7680">
      <button type="button" class="chain-btn" id="chain-btn" data-action="chain">
        <span id="chain-icon">${ICON_UNLINKED}</span>
      </button>
      <input type="number" id="ed-h" value="${h}" placeholder="H" min="200" max="4320">
      <span class="ratio-label" id="ratio-lbl"></span>
    </div>
    <div class="ed-label">
      <input type="text" id="ed-label" value="${escHtml(label)}" placeholder="Label (optional)" maxlength="20">
    </div>
    <div class="ed-actions">
      <button type="button" class="btn-save" data-action="save">Save</button>
      <button type="button" class="btn-cancel" data-action="cancel">Cancel</button>
      ${isNew ? "" : `<button type="button" class="btn-clear" data-action="clear" title="Remove this preset">${ICON_TRASH}</button>`}
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function setupDelegation() {
  const container = document.getElementById("slots");

  container.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const idx = el.dataset.index != null ? +el.dataset.index : editingIndex;
    if (action === "edit") { e.stopPropagation(); openEditor(idx); }
    else if (action === "row") handleRowClick(idx);
    else if (action === "save") handleSave();
    else if (action === "cancel") closeEditor();
    else if (action === "clear") handleClear();
    else if (action === "chain") handleChainToggle();
  });

  container.addEventListener("input", (e) => {
    if (e.target.id === "ed-w") handleWInput();
    else if (e.target.id === "ed-h") handleHInput();
  });

  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.target.id === "ed-w") document.getElementById("ed-h").focus();
    else if (e.target.id === "ed-h" || e.target.id === "ed-label") handleSave();
  });
}

document.addEventListener("keydown", (e) => {
  if (editingIndex >= 0) return;
  if (e.target.tagName === "INPUT") return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) {
    if (slots[num - 1]) {
      e.preventDefault();
      doUnbar(num - 1);
    } else {
      const last = slots.reduce((max, s, i) => s ? i : max, -1);
      if (num - 1 <= last + 1) {
        e.preventDefault();
        openEditor(num - 1);
      }
    }
  }
});

async function init() {
  await loadSlots();
  setupDelegation();
  render();
  const commands = await chrome.commands.getAll();
  const cmd = commands.find((c) => c.name === "quick-unbar");
  if (cmd?.shortcut) {
    document.getElementById("shortcut-hint").textContent = `${cmd.shortcut} for instant unbar`;
  }
}

init();
