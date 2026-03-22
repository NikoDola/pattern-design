import { SIZES, SLOT, pct, savePct, setSizes, setSlot, isValidSlot, sizeShapes, saveSizeShapes, customShapes, elementShape } from './state.js';
import { generate, updateSubtitle, updatePatternColors } from './generate.js';
import { push } from './history.js';
import { showMaxTooltip } from './utils.js';

export const sliderEls     = {};
export const numEls        = {};
export const sizeSelectEls = {};

// Track which cards are expanded
const expandedSizes = new Set();

// ── Shape option helpers ──────────────────────────────────────────────────────
function rebuildSizeShapeOptions(select, selectedId) {
  select.innerHTML = '';
  [{ value: 'square', label: '■ Square' }, { value: 'circle', label: '● Circle' }].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
  customShapes.forEach(shape => {
    const opt = document.createElement('option');
    opt.value = shape.id; opt.textContent = shape.name;
    if (shape.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

export function refreshSizeShapeOptions() {
  Object.entries(sizeSelectEls).forEach(([size, select]) => {
    const savedId = sizeShapes[String(size)]?.shapeId || 'square';
    rebuildSizeShapeOptions(select, savedId);
  });
}

// ── Total bar ─────────────────────────────────────────────────────────────────
export function updateTotal() {
  const totalDisplay = document.getElementById('total-display');
  const totalFill    = document.getElementById('total-fill');
  const sum = SIZES.reduce((a, s) => a + (pct[s] || 0), 0);
  totalDisplay.textContent = sum + '%';
  totalFill.style.width    = Math.min(sum, 100) + '%';
  totalDisplay.className   = sum > 100 ? 'over' : sum === 100 ? 'exact' : '';
  totalFill.className      = sum > 100 ? 'over' : sum === 100 ? 'exact' : '';
}

// ── Per-size color picker (single, always shown) ──────────────────────────────
function buildColorPicker(wrap, size) {
  wrap.innerHTML = '';

  const assign      = sizeShapes[String(size)] || {};
  const isOverridden = !!assign.color;

  const row = document.createElement('div');
  row.className = 'size-color-row';

  const lbl = document.createElement('span');
  lbl.className   = 'size-color-lbl';
  lbl.textContent = 'Color';

  const picker = document.createElement('input');
  picker.type      = 'color';
  picker.className = 'size-color-pick';
  picker.value     = assign.color || document.getElementById('rect-color')?.value || '#000000';

  const hex = document.createElement('span');
  hex.className   = 'size-color-hex';
  hex.textContent = picker.value;

  const reset = document.createElement('button');
  reset.className   = 'size-color-reset' + (isOverridden ? ' overridden' : '');
  reset.textContent = 'Reset';
  reset.title       = 'Reset to global element color';

  picker.addEventListener('input', () => {
    hex.textContent = picker.value;
    if (!sizeShapes[String(size)]) sizeShapes[String(size)] = {};
    sizeShapes[String(size)].color = picker.value;
    reset.classList.add('overridden');
    saveSizeShapes();
    updatePatternColors();
  });
  picker.addEventListener('change', () => push());

  reset.addEventListener('click', () => {
    if (sizeShapes[String(size)]) delete sizeShapes[String(size)].color;
    saveSizeShapes();
    picker.value    = document.getElementById('rect-color').value;
    hex.textContent = picker.value;
    reset.classList.remove('overridden');
    updatePatternColors();
  });

  row.appendChild(lbl);
  row.appendChild(picker);
  row.appendChild(hex);
  row.appendChild(reset);
  wrap.appendChild(row);
}

// ── Slider / card builder ─────────────────────────────────────────────────────
export function initSliders() {
  const controlsEl = document.getElementById('controls');

  // Slot size input
  const slotRow = document.createElement('div');
  slotRow.className = 'sizes-config-row';

  const slotLbl = document.createElement('label');
  slotLbl.className   = 'sizes-config-label';
  slotLbl.textContent = 'Slot px';

  const slotIn = document.createElement('input');
  slotIn.type      = 'number';
  slotIn.className = 'sizes-config-input slot-input';
  slotIn.value     = SLOT;
  slotIn.min       = 2;
  slotIn.step      = 2;
  slotIn.title     = 'Even number that divides 1000 (e.g. 2, 4, 8, 10, 20, 40, 50, 100…)';

  slotIn.addEventListener('change', () => {
    const v = +slotIn.value;
    if (!isValidSlot(v)) { slotIn.value = SLOT; return; }
    push();
    setSlot(v);
    slotIn.value = SLOT;
    updateSubtitle();
    generate();
  });

  slotRow.appendChild(slotLbl);
  slotRow.appendChild(slotIn);
  controlsEl.appendChild(slotRow);

  // Sizes config input
  const configRow = document.createElement('div');
  configRow.className = 'sizes-config-row';

  const configLbl = document.createElement('label');
  configLbl.className   = 'sizes-config-label';
  configLbl.textContent = 'Sizes';

  const configIn = document.createElement('input');
  configIn.type        = 'text';
  configIn.className   = 'sizes-config-input';
  configIn.value       = SIZES.join(', ');
  configIn.title       = 'Comma-separated values, e.g. 1, 2, 3, 4, 5';
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

  // Cards container
  const rowsContainer = document.createElement('div');
  rowsContainer.id = 'slider-rows';
  controlsEl.appendChild(rowsContainer);

  function buildSliderRows() {
    rowsContainer.innerHTML = '';
    Object.keys(sliderEls).forEach(k => delete sliderEls[k]);
    Object.keys(numEls).forEach(k => delete numEls[k]);
    Object.keys(sizeSelectEls).forEach(k => delete sizeSelectEls[k]);

    SIZES.forEach(size => {
      const card = document.createElement('div');
      card.className = 'size-card';

      // Header (always visible)
      const header = document.createElement('div');
      header.className = 'size-card-header';

      const label = document.createElement('span');
      label.className   = 'size-label';
      label.textContent = size + 'px';

      const slider = document.createElement('input');
      slider.type  = 'range';
      slider.min   = 0; slider.max = 100; slider.step = 1;
      slider.value = pct[size] ?? 0;

      const numInput = document.createElement('input');
      numInput.type      = 'number';
      numInput.className = 'pct-input';
      numInput.min       = 0; numInput.max = 100; numInput.step = 1;
      numInput.value     = pct[size] ?? 0;

      slider.addEventListener('input', () => {
        const sumOthers = SIZES.reduce((a, s) => s !== size ? a + (pct[s] || 0) : a, 0);
        const maxVal = Math.max(0, 100 - sumOthers);
        let v = +slider.value;
        if (v > maxVal) { v = maxVal; slider.value = v; showMaxTooltip(slider); }
        numInput.value = v; pct[size] = v;
        updateTotal(); savePct(); generate();
      });
      slider.addEventListener('change', () => push());

      numInput.addEventListener('input', () => {
        const sumOthers = SIZES.reduce((a, s) => s !== size ? a + (pct[s] || 0) : a, 0);
        const maxVal = Math.max(0, 100 - sumOthers);
        let v = Math.max(0, Math.min(maxVal, +numInput.value || 0));
        if (+numInput.value > maxVal) { numInput.value = v; showMaxTooltip(numInput); }
        pct[size] = v; slider.value = v;
        updateTotal(); savePct(); generate();
      });
      numInput.addEventListener('change', () => push());

      sliderEls[size] = slider;
      numEls[size]    = numInput;

      header.appendChild(label);
      header.appendChild(slider);
      header.appendChild(numInput);
      card.appendChild(header);

      // Expand body (only for size > 0)
      if (size !== 0) {
        const expandBtn = document.createElement('button');
        expandBtn.className   = 'size-expand-btn';
        expandBtn.textContent = expandedSizes.has(size) ? '▴' : '▾';
        header.appendChild(expandBtn);

        const body = document.createElement('div');
        body.className = 'size-card-body' + (expandedSizes.has(size) ? ' expanded' : '');

        // Shape select
        const shapeRow = document.createElement('div');
        shapeRow.className = 'size-card-shape-row';
        const shapeSelect = document.createElement('select');
        shapeSelect.className = 'size-shape-select';
        rebuildSizeShapeOptions(shapeSelect, sizeShapes[String(size)]?.shapeId || 'square');
        shapeRow.appendChild(shapeSelect);
        body.appendChild(shapeRow);

        // Color picker
        const colorsWrap = document.createElement('div');
        colorsWrap.className = 'size-card-colors';
        buildColorPicker(colorsWrap, size);
        body.appendChild(colorsWrap);

        sizeSelectEls[size] = shapeSelect;

        shapeSelect.addEventListener('change', () => {
          if (!sizeShapes[String(size)]) sizeShapes[String(size)] = {};
          sizeShapes[String(size)].shapeId = shapeSelect.value;
          saveSizeShapes();
          generate();
        });

        expandBtn.addEventListener('click', e => {
          e.stopPropagation();
          const open = body.classList.toggle('expanded');
          expandBtn.textContent = open ? '▴' : '▾';
          if (open) expandedSizes.add(size); else expandedSizes.delete(size);
        });

        card.appendChild(body);
      }

      rowsContainer.appendChild(card);
    });
  }

  buildSliderRows();
  updateTotal();
  updateSubtitle();
}
