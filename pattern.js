import { loadColors } from './components/state.js';
import { generate }   from './components/generate.js';
import { initSliders, sliderEls, numEls, updateTotal } from './components/sliders.js';
import { initMasks, renderCircleList } from './components/masks.js';
import { initToolbar } from './components/toolbar.js';
import { initExport }  from './components/export.js';
import { initPan }    from './components/pan.js';
import { SIZES, pct, savePct } from './components/state.js';

// ── Init all components ───────────────────────────────────────────────────────
initSliders();
initMasks();
initToolbar();
initExport();
initPan();

// ── Restore colors ────────────────────────────────────────────────────────────
const colors = loadColors();
if (colors) {
  document.getElementById('rect-color').value = colors.rectColor ?? '#000000';
  document.getElementById('bg-color').value   = colors.bgColor   ?? '#ffffff';
}

// ── Generate + Reset buttons ──────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', generate);

document.getElementById('btn-reset').addEventListener('click', () => {
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
