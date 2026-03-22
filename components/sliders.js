import { SIZES, pct, savePct } from './state.js';
import { generate } from './generate.js';

export const sliderEls = {};
export const numEls    = {};

export function updateTotal() {
  const totalDisplay = document.getElementById('total-display');
  const totalFill    = document.getElementById('total-fill');
  const sum = SIZES.reduce((a, s) => a + (pct[s] || 0), 0);
  totalDisplay.textContent = sum + '%';
  totalFill.style.width    = Math.min(sum, 100) + '%';
  totalDisplay.className   = sum > 100 ? 'over' : sum === 100 ? 'exact' : '';
  totalFill.className      = sum > 100 ? 'over' : sum === 100 ? 'exact' : '';
}

export function initSliders() {
  const controlsEl = document.getElementById('controls');

  SIZES.forEach(size => {
    const row = document.createElement('div');
    row.className = 'size-row';

    const label = document.createElement('span');
    label.className = 'size-label';
    label.textContent = size + 'px';

    const slider = document.createElement('input');
    slider.type  = 'range';
    slider.min   = 0; slider.max = 100; slider.step = 1;
    slider.value = pct[size] ?? 0;
    slider.dataset.size = size;

    const numInput = document.createElement('input');
    numInput.type      = 'number';
    numInput.className = 'pct-input';
    numInput.min = 0; numInput.max = 100; numInput.step = 1;
    numInput.value = pct[size] ?? 0;
    numInput.dataset.size = size;

    slider.addEventListener('input', () => {
      pct[size] = +slider.value;
      numInput.value = slider.value;
      updateTotal(); savePct();
    });

    numInput.addEventListener('input', () => {
      const v = Math.max(0, Math.min(100, +numInput.value || 0));
      numInput.value = v; pct[size] = v; slider.value = v;
      updateTotal(); savePct();
    });

    sliderEls[size] = slider;
    numEls[size]    = numInput;

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(numInput);
    controlsEl.appendChild(row);
  });

  updateTotal();
}
