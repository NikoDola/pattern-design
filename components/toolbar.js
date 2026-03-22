import { SIZES, pct, savePct, elementShape, setElementShape, maskMode, setMaskMode, customShapes, saveCustomShapes, sizeShapes, saveSizeShapes } from './state.js';
import { generate, updatePatternColors } from './generate.js';
import { sliderEls, numEls, updateTotal, refreshSizeShapeOptions, sizeSelectEls } from './sliders.js';
import { push } from './history.js';

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

  const SKIP = ['none', 'transparent', 'currentcolor', 'inherit'];

  // Collect explicit attribute fills
  const fills = new Set();
  doc.querySelectorAll('*').forEach(el => {
    const f = el.getAttribute('fill');
    if (f && !SKIP.includes(f.toLowerCase())) fills.add(f.toLowerCase());
    const sf = el.style?.fill;
    if (sf && sf !== '' && !SKIP.includes(sf.toLowerCase())) fills.add(sf.toLowerCase());
  });

  // If SVG uses embedded <style> CSS for fills (e.g. Adobe Illustrator exports),
  // treat as multiColor so we preserve original appearance without trying to override.
  let hasCssFills = false;
  doc.querySelectorAll('style').forEach(s => {
    if (/\bfill\s*:/i.test(s.textContent || '')) hasCssFills = true;
  });

  const multiColor = fills.size > 1 || hasCssFills;
  const svgContent = svgEl.innerHTML;

  let symbolContent = svgContent;
  if (!multiColor) {
    // Strip explicit fills so <use fill="color"> cascades as inherited fill
    doc.querySelectorAll('[fill]').forEach(el => {
      const f = el.getAttribute('fill');
      if (f && f !== 'none') el.removeAttribute('fill');
    });
    doc.querySelectorAll('*').forEach(el => {
      if (el.style?.fill && el.style.fill !== 'none') el.style.fill = '';
    });
    symbolContent = svgEl.innerHTML;
  }

  return {
    id: 'sh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: filename.replace(/\.svg$/i, '').slice(0, 24),
    svgContent, symbolContent, viewBox, multiColor,
  };
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

// ── Shape section builder ──────────────────────────────────────────────────────
function initShapeSection() {
  const shapeRow = document.getElementById('shape-row');
  shapeRow.innerHTML = '';

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

  // Custom shapes section
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

      const delBtn = document.createElement('button');
      delBtn.className   = 'shape-del-btn';
      delBtn.textContent = '×';
      delBtn.title       = 'Delete shape';

      delBtn.addEventListener('click', () => {
        const idx = customShapes.findIndex(s => s.id === shape.id);
        if (idx === -1) return;
        customShapes.splice(idx, 1);
        saveCustomShapes();

        Object.keys(sizeShapes).forEach(k => {
          if (sizeShapes[k]?.shapeId === shape.id) delete sizeShapes[k].shapeId;
        });
        saveSizeShapes();

        if (elementShape === shape.id) setElementShape('square');

        rebuildShapeList(listEl, globalSel, onUpdate);
        refreshSizeShapeOptions();
        refreshGlobalShapeSelect();
        if (onUpdate) onUpdate();
        generate();
      });

      item.appendChild(thumb);
      item.appendChild(nameEl);
      item.appendChild(multiTag);
      item.appendChild(delBtn);
      listEl.appendChild(item);
    });
  }
}

export function initToolbar() {
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

  document.getElementById('btn-equalise').addEventListener('click', () => {
    push();
    SIZES.forEach(size => {
      pct[size] = 10;
      sliderEls[size].value = 10;
      numEls[size].value    = 10;
    });
    updateTotal(); savePct(); generate();
  });

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

  initShapeSection();
}
