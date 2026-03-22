import { SIZES, pct, savePct, elementShape, setElementShape, maskMode, setMaskMode, customShapes, saveCustomShapes, sizeShapes, saveSizeShapes } from './state.js';
import { generate, updatePatternColors } from './generate.js';
import { sliderEls, numEls, updateTotal, refreshSizeShapeOptions, sizeSelectEls } from './sliders.js';
import { push } from './history.js';
import { extractAndReplaceColors } from './utils.js';

function setControlsDisabled(disabled) {
  document.getElementById('controls').classList.toggle('controls-disabled', disabled);
  document.getElementById('controls-divider').classList.toggle('controls-disabled', disabled);
}

// ── SVG processing ─────────────────────────────────────────────────────────────
function processUploadedSVG(content, filename) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid SVG');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) throw new Error('No SVG element');

  let viewBox = svgEl.getAttribute('viewBox');
  if (!viewBox) {
    const w = parseFloat(svgEl.getAttribute('width')) || 100;
    const h = parseFloat(svgEl.getAttribute('height')) || 100;
    viewBox = `0 0 ${w} ${h}`;
  }

  const svgContent = svgEl.innerHTML;
  const { colors, symbolContent } = extractAndReplaceColors(svgContent);
  const colorMap = Object.fromEntries(colors.map(c => [c, c]));

  return {
    id: 'sh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: filename.replace(/\.svg$/i, '').slice(0, 24),
    svgContent, symbolContent, viewBox,
    multiColor: colors.length > 1,
    colors, colorMap,
  };
}

// ── Migrate old shapes (no colors/colorMap) ───────────────────────────────────
function migrateOldShapes() {
  let changed = false;
  customShapes.forEach(shape => {
    if (!shape.colors) {
      const { colors, symbolContent } = extractAndReplaceColors(shape.svgContent);
      shape.colors      = colors;
      shape.colorMap    = Object.fromEntries(colors.map(c => [c, c]));
      shape.symbolContent = symbolContent;
      shape.multiColor  = colors.length > 1;
      changed = true;
    }
  });
  if (changed) saveCustomShapes();
}

// ── Global shape select refresh ────────────────────────────────────────────────
export function refreshGlobalShapeSelect() {
  const select = document.querySelector('#shape-row .shape-select');
  if (!select) return;
  const current = elementShape;
  select.innerHTML = '';
  [{ value: 'square', label: '■ Square' }, { value: 'circle', label: '● Circle' }].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === current) opt.selected = true;
    select.appendChild(opt);
  });
  customShapes.forEach(shape => {
    const opt = document.createElement('option');
    opt.value = shape.id; opt.textContent = shape.name;
    if (shape.id === current) opt.selected = true;
    select.appendChild(opt);
  });
}

// ── Build global color pickers for a shape ─────────────────────────────────────
function buildGlobalColorPickers(wrap, shape) {
  wrap.innerHTML = '';

  if (!shape.colors || shape.colors.length === 0) {
    const note = document.createElement('p');
    note.style.cssText = 'font-size:10px;color:#555;line-height:1.4;';
    note.textContent = 'No fill colors detected. Use the element color picker or per-size color in each size card.';
    wrap.appendChild(note);
    return;
  }

  shape.colors.forEach((orig, i) => {
    const row = document.createElement('div');
    row.className = 'shape-color-row';

    const lbl = document.createElement('span');
    lbl.className   = 'size-color-lbl';
    lbl.textContent = `C${i + 1}`;

    const picker = document.createElement('input');
    picker.type      = 'color';
    picker.className = 'size-color-pick';
    picker.value     = shape.colorMap?.[orig] || orig;

    const hex = document.createElement('span');
    hex.className   = 'size-color-hex';
    hex.textContent = picker.value;

    picker.addEventListener('input', () => {
      hex.textContent = picker.value;
      if (!shape.colorMap) shape.colorMap = {};
      shape.colorMap[orig] = picker.value;
      saveCustomShapes();
      updatePatternColors();
    });
    picker.addEventListener('change', () => push());

    row.appendChild(lbl);
    row.appendChild(picker);
    row.appendChild(hex);
    wrap.appendChild(row);
  });
}

// ── Shape section builder ──────────────────────────────────────────────────────
function initShapeSection() {
  // Migrate any old shapes that don't have the CSS var system yet
  migrateOldShapes();

  const shapeRow = document.getElementById('shape-row');
  shapeRow.innerHTML = '';

  // Section label
  const label = document.createElement('p');
  label.className   = 'section-label';
  label.textContent = 'Element shape';
  shapeRow.appendChild(label);

  // Global shape dropdown
  const globalSelect = document.createElement('select');
  globalSelect.className = 'shape-select';

  [{ value: 'square', label: '■ Square' }, { value: 'circle', label: '● Circle' }].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === elementShape) opt.selected = true;
    globalSelect.appendChild(opt);
  });
  customShapes.forEach(shape => {
    const opt = document.createElement('option');
    opt.value = shape.id; opt.textContent = shape.name;
    if (shape.id === elementShape) opt.selected = true;
    globalSelect.appendChild(opt);
  });

  globalSelect.addEventListener('change', () => {
    push();
    setElementShape(globalSelect.value);
    generate();
  });

  shapeRow.appendChild(globalSelect);

  // Custom shapes upload section
  const uploadSection = document.createElement('div');
  uploadSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:4px;';

  const uploadLbl = document.createElement('p');
  uploadLbl.className   = 'section-label';
  uploadLbl.textContent = 'Custom shapes';
  uploadSection.appendChild(uploadLbl);

  const fileInput = document.createElement('input');
  fileInput.type    = 'file';
  fileInput.accept  = '.svg,image/svg+xml';
  fileInput.style.display = 'none';
  fileInput.multiple = false;
  uploadSection.appendChild(fileInput);

  const uploadBtn = document.createElement('button');
  uploadBtn.className   = 'upload-shape-btn';
  uploadBtn.textContent = '+ Upload SVG';
  uploadSection.appendChild(uploadBtn);

  uploadBtn.addEventListener('click', () => {
    if (customShapes.length >= 10) { alert('Maximum 10 custom shapes reached.'); return; }
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = '';
    if (file.size > 15 * 1024) { alert('SVG file must be under 15 KB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const shape = processUploadedSVG(e.target.result, file.name);
        customShapes.push(shape);
        saveCustomShapes();
        rebuildShapeList(shapeList, globalSelect, updateCountHint);
        refreshSizeShapeOptions();
        refreshGlobalShapeSelect();
        updateCountHint();
      } catch (err) {
        alert('Could not load SVG: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Shape list
  const shapeList = document.createElement('div');
  shapeList.className = 'custom-shape-list';

  const countHint = document.createElement('p');
  countHint.className = 'shape-count-hint';

  function updateCountHint() {
    countHint.textContent = `${customShapes.length} / 10`;
  }

  rebuildShapeList(shapeList, globalSelect, updateCountHint);
  updateCountHint();

  uploadSection.appendChild(shapeList);
  uploadSection.appendChild(countHint);
  shapeRow.appendChild(uploadSection);

  function rebuildShapeList(listEl, globalSel, onUpdate) {
    listEl.innerHTML = '';
    if (customShapes.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'font-size:10px;color:#3a3a3a;';
      empty.textContent = 'No custom shapes yet.';
      listEl.appendChild(empty);
      return;
    }
    customShapes.forEach(shape => {
      const item = document.createElement('div');
      item.className = 'custom-shape-item';

      // ── Item header ─────────────────────────────────────────────────────────
      const itemHeader = document.createElement('div');
      itemHeader.className = 'custom-shape-item-header';

      const thumb = document.createElement('div');
      thumb.className = 'shape-thumb';
      const thumbSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      thumbSvg.setAttribute('viewBox', shape.viewBox);
      thumbSvg.setAttribute('width', '18');
      thumbSvg.setAttribute('height', '18');
      thumbSvg.innerHTML = shape.svgContent;
      thumb.appendChild(thumbSvg);

      const nameEl = document.createElement('span');
      nameEl.className   = 'shape-item-name';
      nameEl.textContent = shape.name;
      nameEl.title       = shape.name;

      const multiTag = document.createElement('span');
      multiTag.className   = 'shape-multicolor-tag';
      multiTag.textContent = shape.multiColor ? 'multi' : '';

      const expandBtn = document.createElement('button');
      expandBtn.className   = 'shape-expand-btn';
      expandBtn.textContent = '▾';
      expandBtn.title       = 'Edit colors';

      const delBtn = document.createElement('button');
      delBtn.className   = 'shape-del-btn';
      delBtn.textContent = '×';
      delBtn.title       = 'Delete shape';

      itemHeader.appendChild(thumb);
      itemHeader.appendChild(nameEl);
      itemHeader.appendChild(multiTag);
      itemHeader.appendChild(expandBtn);
      itemHeader.appendChild(delBtn);

      // ── Global color pickers (collapsible) ──────────────────────────────────
      const colorsSection = document.createElement('div');
      colorsSection.className = 'shape-color-section';
      buildGlobalColorPickers(colorsSection, shape);

      expandBtn.addEventListener('click', e => {
        e.stopPropagation();
        const open = colorsSection.classList.toggle('expanded');
        expandBtn.textContent = open ? '▴' : '▾';
      });

      delBtn.addEventListener('click', () => {
        const idx = customShapes.findIndex(s => s.id === shape.id);
        if (idx === -1) return;
        customShapes.splice(idx, 1);
        saveCustomShapes();

        // Clean up sizeShapes references
        Object.keys(sizeShapes).forEach(k => {
          if (sizeShapes[k]?.shapeId === shape.id) {
            delete sizeShapes[k].shapeId;
            delete sizeShapes[k].colorOverrides;
          }
        });
        saveSizeShapes();

        if (elementShape === shape.id) setElementShape('square');

        rebuildShapeList(listEl, globalSel, onUpdate);
        refreshSizeShapeOptions();
        refreshGlobalShapeSelect();
        if (onUpdate) onUpdate();
        generate();
      });

      item.appendChild(itemHeader);
      item.appendChild(colorsSection);
      listEl.appendChild(item);
    });
  }
}

export function initToolbar() {
  // Mode toggle
  const isReverse = maskMode === 'reverse';
  setControlsDisabled(isReverse);
  if (isReverse) {
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === 'reverse')
    );
  }
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      push();
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
    push();
    SIZES.forEach(size => {
      pct[size] = 10;
      sliderEls[size].value = 10;
      numEls[size].value    = 10;
    });
    updateTotal(); savePct(); generate();
  });

  // Dice: random distribution summing to 100%
  document.getElementById('btn-dice').addEventListener('click', () => {
    push();
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

  // Shape section
  initShapeSection();
}
