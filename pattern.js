import { loadColors } from './components/state.js';
import { generate }   from './components/generate.js';
import { initSliders, sliderEls, numEls, updateTotal } from './components/sliders.js';
import { initMasks, renderCircleList } from './components/masks.js';
import { initToolbar } from './components/toolbar.js';
import { initExport }  from './components/export.js';
import { initPan, setPanSelectedIndex } from './components/pan.js';
import { SIZES, pct, savePct, circles, saveCircles } from './components/state.js';
import { init as historyInit, undo, redo, push } from './components/history.js';
import { selectedMaskIndex, setSelectedMaskIndex, selectMask } from './components/masks.js';

// ── Init all components ───────────────────────────────────────────────────────
initSliders();
initMasks();
initToolbar();
initExport();
initPan();

// ── Undo / Redo ───────────────────────────────────────────────────────────────
function syncUI() {
  SIZES.forEach(size => {
    sliderEls[size].value = pct[size] ?? 0;
    numEls[size].value    = pct[size] ?? 0;
  });
  updateTotal();
  renderCircleList();
  generate();
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(syncUI);
    else            undo(syncUI);
    return;
  }

  // Z-order: Ctrl+Shift+[ = send to back, Ctrl+Shift+] = bring to front
  if (e.ctrlKey && e.shiftKey && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const idx = selectedMaskIndex;
    if (idx < 0 || idx >= circles.length) return;
    e.preventDefault();
    push();
    const [mask] = circles.splice(idx, 1);
    let newIdx;
    if (e.code === 'BracketRight') {        // bring to front → index 0
      circles.unshift(mask);
      newIdx = 0;
    } else {                                // send to back → last index
      circles.push(mask);
      newIdx = circles.length - 1;
    }
    setSelectedMaskIndex(newIdx);
    setPanSelectedIndex(newIdx);
    saveCircles(); renderCircleList(); generate();
  }
});

// ── Restore colors ────────────────────────────────────────────────────────────
const colors = loadColors();
if (colors) {
  document.getElementById('rect-color').value = colors.rectColor ?? '#000000';
  document.getElementById('bg-color').value   = colors.bgColor   ?? '#ffffff';
}

// ── Generate + Reset buttons ──────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', generate);

document.getElementById('btn-reset').addEventListener('click', () => {
  push();
  SIZES.forEach(size => {
    pct[size] = size === 10 ? 100 : 0;
    sliderEls[size].value = pct[size];
    numEls[size].value    = pct[size];
  });
  updateTotal(); savePct(); generate();
});

// ── BG color live preview ─────────────────────────────────────────────────────
document.getElementById('bg-color').addEventListener('input', e => {
  document.getElementById('artboard').setAttribute('style', `background:${e.target.value}`);
});

// ── Initial render ────────────────────────────────────────────────────────────
renderCircleList();
generate();
historyInit();
