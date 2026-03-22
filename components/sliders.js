import { SIZES, pct, savePct, setSizes } from './state.js';
import { generate } from './generate.js';
import { push } from './history.js';
import { showMaxTooltip } from './utils.js';

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

  // ── Sizes config input ──────────────────────────────────────────────────────
  const configRow = document.createElement('div');
  configRow.className = 'sizes-config-row';

  const configLbl = document.createElement('label');
  configLbl.className = 'sizes-config-label';
  configLbl.textContent = 'Sizes';

  const configIn = document.createElement('input');
  configIn.type = 'text';
  configIn.className = 'sizes-config-input';
  configIn.value = SIZES.join(', ');
  configIn.title = 'Comma-separated values, e.g. 1, 2, 3, 4, 5 or 2, 4, 6, 8';
  configIn.placeholder = '0, 2, 4, 6, 8, 10';

  configIn.addEventListener('change', () => {
    const vals = configIn.value.split(',')
      .map(v => +v.trim())
      .filter(v => Number.isFinite(v) && v >= 0 && Number.isInteger(v));
    const unique = [...new Set(vals)].sort((a, b) => a - b);
    if (!unique.length) { configIn.value = SIZES.join(', '); return; }
    push();
    setSizes(unique);
    configIn.value = SIZES.join(', ');
    buildSliderRows();
    updateTotal();
    generate();
  });

  configRow.appendChild(configLbl);
  configRow.appendChild(configIn);
  controlsEl.appendChild(configRow);

  // ── Slider rows container ───────────────────────────────────────────────────
  const rowsContainer = document.createElement('div');
  rowsContainer.id = 'slider-rows';
  controlsEl.appendChild(rowsContainer);

  function buildSliderRows() {
    rowsContainer.innerHTML = '';
    Object.keys(sliderEls).forEach(k => delete sliderEls[k]);
    Object.keys(numEls).forEach(k => delete numEls[k]);

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
        const sumOthers = SIZES.reduce((a, s) => s !== size ? a + (pct[s] || 0) : a, 0);
        const maxVal = Math.max(0, 100 - sumOthers);
        let v = +slider.value;
        if (v > maxVal) { v = maxVal; slider.value = v; showMaxTooltip(slider); }
        numInput.value = v; pct[size] = v;
        updateTotal(); savePct(); generate();
      });
      slider.addEventListener('change', () => { push(); });

      numInput.addEventListener('input', () => {
        const sumOthers = SIZES.reduce((a, s) => s !== size ? a + (pct[s] || 0) : a, 0);
        const maxVal = Math.max(0, 100 - sumOthers);
        let v = Math.max(0, Math.min(maxVal, +numInput.value || 0));
        if (+numInput.value > maxVal) { numInput.value = v; showMaxTooltip(numInput); }
        pct[size] = v; slider.value = v;
        updateTotal(); savePct(); generate();
      });
      numInput.addEventListener('change', () => { push(); });

      sliderEls[size] = slider;
      numEls[size]    = numInput;

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(numInput);
      rowsContainer.appendChild(row);
    });
  }

  buildSliderRows();
  updateTotal();
}
