import { SIZES, pct, savePct, elementShape, setElementShape, maskMode, setMaskMode } from './state.js';
import { generate } from './generate.js';
import { sliderEls, numEls, updateTotal } from './sliders.js';

function setControlsDisabled(disabled) {
  document.getElementById('controls').classList.toggle('controls-disabled', disabled);
  document.getElementById('controls-divider').classList.toggle('controls-disabled', disabled);
}

export function initToolbar() {
  // Mode toggle (Mask / Reverse)
  const isReverse = maskMode === 'reverse';
  setControlsDisabled(isReverse);
  if (isReverse) {
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === 'reverse')
    );
  }
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMaskMode(btn.dataset.mode);
      document.querySelectorAll('.mode-btn').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      setControlsDisabled(btn.dataset.mode === 'reverse');
      generate();
    });
  });
  // Equalise: all sizes 10%
  document.getElementById('btn-equalise').addEventListener('click', () => {
    SIZES.forEach(size => {
      pct[size] = 10;
      sliderEls[size].value = 10;
      numEls[size].value    = 10;
    });
    updateTotal(); savePct(); generate();
  });

  // Dice: random distribution summing to 100%
  document.getElementById('btn-dice').addEventListener('click', () => {
    const weights = SIZES.map(() => Math.random());
    const total   = weights.reduce((a, b) => a + b, 0);
    let assigned  = 0;
    SIZES.forEach((size, idx) => {
      const val = idx < SIZES.length - 1
        ? Math.round(weights[idx] / total * 100)
        : 100 - assigned;
      pct[size] = val; assigned += val;
      sliderEls[size].value = val;
      numEls[size].value    = val;
    });
    updateTotal(); savePct(); generate();
  });

  // Element shape toggle
  document.querySelectorAll('.shape-btn').forEach(btn => {
    if (btn.dataset.shape === elementShape) btn.classList.add('active');
    else btn.classList.remove('active');

    btn.addEventListener('click', () => {
      setElementShape(btn.dataset.shape);
      document.querySelectorAll('.shape-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.shape === btn.dataset.shape)
      );
      generate();
    });
  });
}
