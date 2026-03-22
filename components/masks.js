import { circles, saveCircles, defaultZones, makeEqualDist, SIZES } from './state.js';
import { generate } from './generate.js';
import { push } from './history.js';
import { showMaxTooltip } from './utils.js';

// ── Canvas mask selection ─────────────────────────────────────────────────────
export let selectedMaskIndex = -1;

export function setSelectedMaskIndex(i) {
  selectedMaskIndex = i;
}

function highlightSelected() {
  document.querySelectorAll('#artboard [data-reference]').forEach(el => {
    const isSelected = +el.dataset.maskIndex === selectedMaskIndex;
    el.setAttribute('stroke',       isSelected ? '#ff5555' : '#4f8ef7');
    el.setAttribute('stroke-width', isSelected ? '2'       : '1');
  });
}

export function selectMask(i) {
  selectedMaskIndex = i;
  saveCircles();
  renderCircleList();
  renderPropertiesPanel(i);
  highlightSelected();
}

export function deselectMask() {
  selectedMaskIndex = -1;
  highlightSelected();
  clearPropertiesPanel();
  renderCircleList();
}

export function initCanvasDelete() {
  const artboard = document.getElementById('artboard');

  artboard.addEventListener('click', e => {
    if (!e.target.closest('[data-reference]') && !e.target.closest('[data-gizmo-handle]')) {
      deselectMask();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Delete') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (selectedMaskIndex < 0 || selectedMaskIndex >= circles.length) return;
    push();
    circles.splice(selectedMaskIndex, 1);
    selectedMaskIndex = -1;
    saveCircles(); renderCircleList(); clearPropertiesPanel(); generate();
  });

  artboard.addEventListener('pattern:generated', () => highlightSelected());
}

// ── Layer list (left sidebar) ─────────────────────────────────────────────────
export function renderCircleList() {
  const list = document.getElementById('circle-list');
  list.innerHTML = '';

  circles.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'layer-item' + (i === selectedMaskIndex ? ' selected' : '');

    const icon = document.createElement('div');
    icon.className = 'layer-item-icon' + (c.shape === 'circle' ? ' circle-icon' : '');

    const name = document.createElement('span');
    name.className = 'layer-item-name';
    name.textContent = `Mask ${i + 1}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'layer-item-del';
    delBtn.textContent = '×';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      push();
      circles.splice(i, 1);
      if (selectedMaskIndex === i) {
        selectedMaskIndex = -1;
        clearPropertiesPanel();
      } else if (selectedMaskIndex > i) {
        selectedMaskIndex--;
      }
      saveCircles(); renderCircleList(); generate();
    });

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(delBtn);
    item.addEventListener('click', () => selectMask(i));

    list.appendChild(item);
  });
}

// ── Align icon helper ─────────────────────────────────────────────────────────
function makeAlignIcon(halign, valign) {
  const W = 16, H = 16, pad = 2, dot = 4;
  const cx = halign === 'left'   ? pad           : halign === 'center' ? (W - dot) / 2 : W - pad - dot;
  const cy = valign === 'top'    ? pad           : valign === 'middle' ? (H - dot) / 2 : H - pad - dot;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.pointerEvents = 'none';

  const border = document.createElementNS(ns, 'rect');
  border.setAttribute('x', '0.5'); border.setAttribute('y', '0.5');
  border.setAttribute('width', W - 1); border.setAttribute('height', H - 1);
  border.setAttribute('rx', '2'); border.setAttribute('fill', 'none');
  border.setAttribute('stroke', 'currentColor'); border.setAttribute('stroke-opacity', '0.4');
  svg.appendChild(border);

  const dotEl = document.createElementNS(ns, 'rect');
  dotEl.setAttribute('x', cx); dotEl.setAttribute('y', cy);
  dotEl.setAttribute('width', dot); dotEl.setAttribute('height', dot);
  dotEl.setAttribute('rx', '1'); dotEl.setAttribute('fill', 'currentColor');
  svg.appendChild(dotEl);
  return svg;
}

// ── Zone cards builder ────────────────────────────────────────────────────────
function buildZoneCards(zoneWrap, i, c) {
  zoneWrap.innerHTML = '';

  c.zones.forEach((z, zi) => {
    const isLast  = zi === c.zones.length - 1;
    const fromVal = zi === 0 ? 0 : c.zones[zi - 1].max;

    const card = document.createElement('div');
    card.className = 'zone-card';

    // Header: range + delete
    const cardHeader = document.createElement('div');
    cardHeader.className = 'zone-card-header';

    const rangeWrap = document.createElement('div');
    rangeWrap.className = 'zone-range-wrap';

    const fromSpan = document.createElement('span');
    fromSpan.className = 'zone-range-from';
    fromSpan.textContent = fromVal + ' – ';
    rangeWrap.appendChild(fromSpan);

    if (isLast) {
      const toSpan = document.createElement('span');
      toSpan.className = 'zone-range-to-fixed';
      toSpan.textContent = '100%';
      rangeWrap.appendChild(toSpan);
    } else {
      const maxIn = document.createElement('input');
      maxIn.type = 'number';
      maxIn.className = 'zone-max-input';
      maxIn.value = z.max;
      maxIn.min = fromVal + 1;
      maxIn.max = 99;
      maxIn.addEventListener('change', () => {
        const nextMax = isLast ? 100 : (c.zones[zi + 1]?.max ?? 100);
        const prevMax = zi === 0 ? 0 : c.zones[zi - 1].max;
        let v = Math.max(prevMax + 1, Math.min(nextMax - 1, +maxIn.value || prevMax + 1));
        maxIn.value = v;
        push();
        circles[i].zones[zi].max = v;
        saveCircles(); buildZoneCards(zoneWrap, i, circles[i]); generate();
      });
      const pctSpan = document.createElement('span');
      pctSpan.className = 'zone-range-pct';
      pctSpan.textContent = '%';
      rangeWrap.appendChild(maxIn);
      rangeWrap.appendChild(pctSpan);
    }

    const delZoneBtn = document.createElement('span');
    delZoneBtn.className = 'btn-del-zone' + (c.zones.length <= 1 ? ' disabled' : '');
    delZoneBtn.textContent = '×';
    delZoneBtn.title = 'Delete zone';
    delZoneBtn.addEventListener('click', () => {
      if (circles[i].zones.length <= 1) return;
      push();
      circles[i].zones.splice(zi, 1);
      circles[i].zones[circles[i].zones.length - 1].max = 100;
      saveCircles(); buildZoneCards(zoneWrap, i, circles[i]); generate();
    });

    cardHeader.appendChild(rangeWrap);
    cardHeader.appendChild(delZoneBtn);
    card.appendChild(cardHeader);

    // Sizes input
    const sizesRow = document.createElement('div');
    sizesRow.className = 'zone-sizes-row';
    const sizesLbl = document.createElement('label');
    sizesLbl.textContent = 'Sizes ';
    const sizesIn = document.createElement('input');
    sizesIn.type = 'text';
    sizesIn.className = 'zone-sizes-input';
    sizesIn.value = (z.sizes || SIZES).join(', ');
    sizesIn.placeholder = '0, 2, 4, 6';
    sizesIn.addEventListener('change', () => {
      const vals = sizesIn.value.split(',')
        .map(v => +v.trim())
        .filter(v => SIZES.includes(v));
      const unique = [...new Set(vals)].sort((a, b) => a - b);
      if (!unique.length) { sizesIn.value = circles[i].zones[zi].sizes.join(', '); return; }
      push();
      circles[i].zones[zi].sizes = unique;
      circles[i].zones[zi].dist  = makeEqualDist(unique);
      sizesIn.value = unique.join(', ');
      saveCircles(); buildZoneCards(zoneWrap, i, circles[i]); generate();
    });
    sizesLbl.appendChild(sizesIn);
    sizesRow.appendChild(sizesLbl);
    card.appendChild(sizesRow);

    // Distribution rows
    const distWrap = document.createElement('div');
    distWrap.className = 'zone-dist-wrap';

    const zoneWarning = document.createElement('div');
    zoneWarning.className = 'zone-total-warn';

    function updateZoneWarning() {
      const zd  = circles[i].zones[zi];
      const sum = Object.values(zd.dist).reduce((a, b) => a + (+b || 0), 0);
      zoneWarning.textContent = `Total: ${sum}%`;
      zoneWarning.className   = 'zone-total-warn' + (sum > 100 ? ' warn-over' : sum === 100 ? ' warn-exact' : '');
    }

    const zd = circles[i].zones[zi];
    (zd.sizes || SIZES).forEach(s => {
      const drow = document.createElement('div');
      drow.className = 'zone-dist-row';
      const plbl = document.createElement('span');
      plbl.className = 'zone-px-label';
      plbl.textContent = s + 'px';
      const pctIn = document.createElement('input');
      pctIn.type = 'number';
      pctIn.className = 'zone-input';
      pctIn.value = zd.dist[String(s)] ?? 0;
      pctIn.min = 0; pctIn.max = 100;
      pctIn.addEventListener('input', () => {
        const zd = circles[i].zones[zi];
        const sumOthers = Object.entries(zd.dist)
          .filter(([k]) => k !== String(s))
          .reduce((a, [, val]) => a + (+val || 0), 0);
        const maxVal = Math.max(0, 100 - sumOthers);
        let v = Math.max(0, Math.min(maxVal, +pctIn.value || 0));
        if (+pctIn.value > maxVal) { pctIn.value = v; showMaxTooltip(pctIn); }
        zd.dist[String(s)] = v;
        saveCircles(); generate(); updateZoneWarning();
      });
      pctIn.addEventListener('change', () => { push(); });
      drow.appendChild(plbl); drow.appendChild(pctIn);
      distWrap.appendChild(drow);
    });
    updateZoneWarning();

    card.appendChild(distWrap);
    card.appendChild(zoneWarning);
    zoneWrap.appendChild(card);
  });

  // Add zone button
  const addZoneBtn = document.createElement('button');
  addZoneBtn.className = 'btn-add-zone';
  addZoneBtn.textContent = '+ Add zone';
  addZoneBtn.addEventListener('click', () => {
    push();
    const zones  = circles[i].zones;
    const prevMax = zones.length >= 2 ? zones[zones.length - 2].max : 0;
    const newMax  = Math.round((prevMax + 100) / 2);
    const newZone = {
      max:   newMax,
      sizes: [...(zones[zones.length - 1].sizes || SIZES)],
      dist:  makeEqualDist(zones[zones.length - 1].sizes || SIZES),
    };
    zones.splice(zones.length - 1, 0, newZone);
    saveCircles(); buildZoneCards(zoneWrap, i, circles[i]); generate();
  });
  zoneWrap.appendChild(addZoneBtn);
}

// ── Properties panel (right panel) ───────────────────────────────────────────
export function clearPropertiesPanel() {
  renderPropertiesPanel(-1);
}

// Updates only the numeric inputs after a drag — avoids rebuilding the whole panel
export function syncPropertiesPanelFields() {
  if (selectedMaskIndex < 0 || selectedMaskIndex >= circles.length) return;
  const c = circles[selectedMaskIndex];
  const get = id => document.getElementById(id);
  const xIn   = get('prop-x');
  const yIn   = get('prop-y');
  const wIn   = get('prop-w');
  const hIn   = get('prop-h');
  const rotIn = get('prop-rot');
  if (xIn)   xIn.value   = Math.round(c.x);
  if (yIn)   yIn.value   = Math.round(c.y);
  if (wIn)   wIn.value   = Math.round(c.width  ?? c.size);
  if (hIn)   hIn.value   = Math.round(c.height ?? c.size);
  if (rotIn) rotIn.value = Math.round(c.rotation ?? 0);
}

export function renderPropertiesPanel(i) {
  const panel = document.getElementById('properties-panel');
  if (!panel) return;
  panel.innerHTML = '';

  if (i < 0 || i >= circles.length) {
    const empty = document.createElement('div');
    empty.className = 'prop-empty';
    empty.textContent = 'Select a layer to\nedit properties';
    panel.appendChild(empty);
    return;
  }

  const c = circles[i];

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'prop-header';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'prop-header-name';
  nameSpan.textContent = `Mask ${i + 1}`;

  const headerBtns = document.createElement('div');
  headerBtns.className = 'prop-header-btns';

  const dupBtn = document.createElement('button');
  dupBtn.className = 'prop-icon-btn';
  dupBtn.title = 'Duplicate';
  dupBtn.textContent = 'D';
  dupBtn.addEventListener('click', () => {
    push();
    const copy = JSON.parse(JSON.stringify(circles[i]));
    copy.x += 20; copy.y += 20;
    circles.push(copy);
    saveCircles(); renderCircleList(); generate();
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'prop-icon-btn prop-del-btn';
  delBtn.title = 'Delete';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => {
    push();
    circles.splice(i, 1);
    selectedMaskIndex = -1;
    saveCircles(); renderCircleList(); clearPropertiesPanel(); generate();
  });

  headerBtns.appendChild(dupBtn);
  headerBtns.appendChild(delBtn);
  header.appendChild(nameSpan);
  header.appendChild(headerBtns);
  panel.appendChild(header);

  // ── Alignment ──────────────────────────────────────────────────────────────
  const alignSection = document.createElement('div');
  alignSection.className = 'prop-section';

  const alignLabel = document.createElement('p');
  alignLabel.className = 'section-label';
  alignLabel.textContent = 'Alignment';

  const alignGrid = document.createElement('div');
  alignGrid.className = 'align-grid';

  const ALIGNS = [
    { h: 'left',   v: 'top'    },
    { h: 'center', v: 'top'    },
    { h: 'right',  v: 'top'    },
    { h: 'left',   v: 'middle' },
    { h: 'center', v: 'middle' },
    { h: 'right',  v: 'middle' },
    { h: 'left',   v: 'bottom' },
    { h: 'center', v: 'bottom' },
    { h: 'right',  v: 'bottom' },
  ];

  ALIGNS.forEach(({ h, v }) => {
    const btn = document.createElement('button');
    btn.className = 'align-grid-btn';
    btn.appendChild(makeAlignIcon(h, v));
    btn.addEventListener('click', () => {
      push();
      const c  = circles[i];
      const w  = c.width  ?? c.size;
      const mh = c.height ?? c.size;
      if (h === 'left')   c.x = 0;
      if (h === 'center') c.x = (1000 - w)  / 2;
      if (h === 'right')  c.x = 1000 - w;
      if (v === 'top')    c.y = 0;
      if (v === 'middle') c.y = (1000 - mh) / 2;
      if (v === 'bottom') c.y = 1000 - mh;
      saveCircles(); syncPropertiesPanelFields(); generate();
    });
    alignGrid.appendChild(btn);
  });

  alignSection.appendChild(alignLabel);
  alignSection.appendChild(alignGrid);
  panel.appendChild(alignSection);

  // ── Scale ──────────────────────────────────────────────────────────────────
  const scaleSection = document.createElement('div');
  scaleSection.className = 'prop-section';

  const scaleLabel = document.createElement('p');
  scaleLabel.className = 'section-label';
  scaleLabel.textContent = 'Scale';

  function makeField(labelText, id, value, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'prop-field';
    const lbl = document.createElement('span');
    lbl.className = 'prop-field-label';
    lbl.textContent = labelText;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.id = id;
    inp.value = Math.round(value);
    if (opts.min !== undefined) inp.min = opts.min;
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    return { wrap, inp };
  }

  const xyRow = document.createElement('div');
  xyRow.className = 'prop-row';
  const { wrap: xWrap, inp: xIn } = makeField('X', 'prop-x', c.x);
  const { wrap: yWrap, inp: yIn } = makeField('Y', 'prop-y', c.y);
  xyRow.appendChild(xWrap); xyRow.appendChild(yWrap);

  const whRow = document.createElement('div');
  whRow.className = 'prop-row';
  const { wrap: wWrap, inp: wIn } = makeField('W', 'prop-w', c.width  ?? c.size, { min: 1 });
  const { wrap: hWrap, inp: hIn } = makeField('H', 'prop-h', c.height ?? c.size, { min: 1 });
  whRow.appendChild(wWrap); whRow.appendChild(hWrap);

  const rotRow = document.createElement('div');
  rotRow.className = 'prop-row';
  const { wrap: rotWrap, inp: rotIn } = makeField('Rotate°', 'prop-rot', c.rotation ?? 0);
  rotRow.appendChild(rotWrap);

  xIn.addEventListener('input',  () => { circles[i].x = +xIn.value; saveCircles(); generate(); });
  xIn.addEventListener('change', () => push());
  yIn.addEventListener('input',  () => { circles[i].y = +yIn.value; saveCircles(); generate(); });
  yIn.addEventListener('change', () => push());
  wIn.addEventListener('input',  () => {
    if (circles[i].height == null) circles[i].height = circles[i].size;
    circles[i].width = +wIn.value || 1;
    saveCircles(); generate();
  });
  wIn.addEventListener('change', () => push());
  hIn.addEventListener('input',  () => {
    if (circles[i].width == null) circles[i].width = circles[i].size;
    circles[i].height = +hIn.value || 1;
    saveCircles(); generate();
  });
  hIn.addEventListener('change', () => push());
  rotIn.addEventListener('input',  () => { circles[i].rotation = +rotIn.value; saveCircles(); generate(); });
  rotIn.addEventListener('change', () => push());

  scaleSection.appendChild(scaleLabel);
  scaleSection.appendChild(xyRow);
  scaleSection.appendChild(whRow);
  scaleSection.appendChild(rotRow);
  panel.appendChild(scaleSection);

  // ── Shape ──────────────────────────────────────────────────────────────────
  const shapeSection = document.createElement('div');
  shapeSection.className = 'prop-section';

  const shapeSectionLabel = document.createElement('p');
  shapeSectionLabel.className = 'section-label';
  shapeSectionLabel.textContent = 'Shape';

  const shapeRow = document.createElement('div');
  shapeRow.className = 'mask-shape-row';
  ['circle', 'square'].forEach(shape => {
    const btn = document.createElement('button');
    btn.className = 'mask-shape-btn' + (c.shape === shape ? ' active' : '');
    btn.textContent = shape === 'circle' ? '● Circle' : '■ Square';
    btn.addEventListener('click', () => {
      push();
      circles[i].shape = shape;
      saveCircles(); renderCircleList(); renderPropertiesPanel(i); generate();
    });
    shapeRow.appendChild(btn);
  });

  shapeSection.appendChild(shapeSectionLabel);
  shapeSection.appendChild(shapeRow);
  panel.appendChild(shapeSection);

  // ── Zones ──────────────────────────────────────────────────────────────────
  const zonesSection = document.createElement('div');
  zonesSection.className = 'prop-section prop-section-zones';

  const zonesLabel = document.createElement('p');
  zonesLabel.className = 'section-label';
  zonesLabel.textContent = 'Zones';

  const zoneWrap = document.createElement('div');
  zoneWrap.className = 'zone-wrap';
  buildZoneCards(zoneWrap, i, c);

  zonesSection.appendChild(zonesLabel);
  zonesSection.appendChild(zoneWrap);
  panel.appendChild(zonesSection);
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initMasks() {
  initCanvasDelete();
  clearPropertiesPanel();

  document.getElementById('btn-add-circle').addEventListener('click', () => {
    push();
    const sz = 300;
    circles.push({ x: 350, y: 350, size: sz, width: sz, height: sz, rotation: 0, shape: 'circle', zones: defaultZones() });
    saveCircles(); renderCircleList(); generate();
  });
}
