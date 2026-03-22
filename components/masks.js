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

// Selects a mask, minimizes all others in the sidebar
export function selectMask(i) {
  selectedMaskIndex = i;
  circles.forEach((c, idx) => { c.minimized = idx !== i; });
  saveCircles();
  renderCircleList();
  highlightSelected();
  document.getElementById('align-bar').style.display = 'flex';
}

// Clears selection without changing minimized state
export function deselectMask() {
  selectedMaskIndex = -1;
  highlightSelected();
  document.getElementById('align-bar').style.display = 'none';
}

export function initCanvasDelete() {
  const artboard = document.getElementById('artboard');

  // Deselect when clicking empty canvas (ref clicks handled by pan.js)
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
    saveCircles(); renderCircleList(); generate();
  });

  // Re-apply highlight after each generate (outlines are redrawn)
  artboard.addEventListener('pattern:generated', () => highlightSelected());
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeNumInput(value, opts = {}) {
  const el = document.createElement('input');
  el.type = 'number'; el.value = value;
  if (opts.min !== undefined) el.min = opts.min;
  if (opts.max !== undefined) el.max = opts.max;
  if (opts.cls) el.className = opts.cls;
  return el;
}

// ── Render ────────────────────────────────────────────────────────────────────
export function renderCircleList() {
  const list = document.getElementById('circle-list');
  list.innerHTML = '';

  circles.forEach((c, i) => {
    const entry = document.createElement('div');
    entry.className = 'circle-entry' + (c.minimized ? ' minimized' : '');

    // Header
    const header = document.createElement('div');
    header.className = 'circle-entry-header';
    header.innerHTML = `<span>Mask ${i + 1}</span>`;

    const headerBtns = document.createElement('div');
    headerBtns.className = 'circle-header-btns';

    const dupBtn = document.createElement('button');
    dupBtn.className = 'btn-minimize-circle';
    dupBtn.textContent = 'D';
    dupBtn.title = 'Duplicate';
    dupBtn.addEventListener('click', () => {
      push();
      const copy = JSON.parse(JSON.stringify(circles[i]));
      copy.x += 20; copy.y += 20;
      circles.push(copy);
      saveCircles(); renderCircleList(); generate();
    });

    const minBtn = document.createElement('button');
    minBtn.className = 'btn-minimize-circle';
    minBtn.textContent = c.minimized ? '▸' : '▾';
    minBtn.title = c.minimized ? 'Expand' : 'Minimize';
    minBtn.addEventListener('click', () => {
      circles[i].minimized = !circles[i].minimized;
      saveCircles(); renderCircleList();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-circle';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
      push();
      circles.splice(i, 1); saveCircles(); renderCircleList(); generate();
    });

    headerBtns.appendChild(dupBtn); headerBtns.appendChild(minBtn); headerBtns.appendChild(delBtn);
    header.appendChild(headerBtns);

    // Shape toggle
    const shapeRow = document.createElement('div');
    shapeRow.className = 'mask-shape-row';
    ['circle', 'square'].forEach(shape => {
      const btn = document.createElement('button');
      btn.className = 'mask-shape-btn' + (c.shape === shape ? ' active' : '');
      btn.textContent = shape === 'circle' ? '● Circle' : '■ Square';
      btn.addEventListener('click', () => {
        push();
        circles[i].shape = shape; saveCircles(); renderCircleList(); generate();
      });
      shapeRow.appendChild(btn);
    });

    // X / Y
    const xyRow = document.createElement('div');
    xyRow.className = 'xy-row';

    const xLbl = document.createElement('label'); xLbl.textContent = 'X ';
    const xIn  = makeNumInput(c.x);
    xIn.addEventListener('input', () => { circles[i].x = +xIn.value; saveCircles(); generate(); });
    xIn.addEventListener('change', () => { push(); });
    xLbl.appendChild(xIn);

    const yLbl = document.createElement('label'); yLbl.textContent = 'Y ';
    const yIn  = makeNumInput(c.y);
    yIn.addEventListener('input', () => { circles[i].y = +yIn.value; saveCircles(); generate(); });
    yIn.addEventListener('change', () => { push(); });
    yLbl.appendChild(yIn);

    xyRow.appendChild(xLbl); xyRow.appendChild(yLbl);

    // W / H
    const whRow = document.createElement('div');
    whRow.className = 'xy-row';
    const wLbl = document.createElement('label'); wLbl.textContent = 'W ';
    const wIn  = makeNumInput(c.width ?? c.size, { min: 1 });
    wIn.addEventListener('input', () => {
      if (circles[i].height == null) circles[i].height = circles[i].size;
      circles[i].width = +wIn.value || 1;
      saveCircles(); generate();
    });
    wIn.addEventListener('change', () => { push(); });
    wLbl.appendChild(wIn);
    const hLbl = document.createElement('label'); hLbl.textContent = 'H ';
    const hIn  = makeNumInput(c.height ?? c.size, { min: 1 });
    hIn.addEventListener('input', () => {
      if (circles[i].width == null) circles[i].width = circles[i].size;
      circles[i].height = +hIn.value || 1;
      saveCircles(); generate();
    });
    hIn.addEventListener('change', () => { push(); });
    hLbl.appendChild(hIn);
    whRow.appendChild(wLbl); whRow.appendChild(hLbl);

    // Rotation
    const rotLbl = document.createElement('label');
    rotLbl.className = 'full-label'; rotLbl.textContent = 'Rotate° ';
    const rotIn = makeNumInput(c.rotation ?? 0);
    rotIn.addEventListener('input', () => { circles[i].rotation = +rotIn.value; saveCircles(); generate(); });
    rotIn.addEventListener('change', () => { push(); });
    rotLbl.appendChild(rotIn);

    // Zone cards
    const zoneWrap = document.createElement('div');
    zoneWrap.className = 'zone-wrap';

    function buildZoneCards() {
      zoneWrap.innerHTML = '';

      c.zones.forEach((z, zi) => {
        const isLast = zi === c.zones.length - 1;
        const fromVal = zi === 0 ? 0 : c.zones[zi - 1].max;

        const card = document.createElement('div');
        card.className = 'zone-card';

        // ── Card header: range + delete ───────────────────────────────────────
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
            saveCircles(); buildZoneCards(); generate();
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
          saveCircles(); buildZoneCards(); generate();
        });

        cardHeader.appendChild(rangeWrap);
        cardHeader.appendChild(delZoneBtn);
        card.appendChild(cardHeader);

        // ── Sizes input ───────────────────────────────────────────────────────
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
          saveCircles(); buildZoneCards(); generate();
        });
        sizesLbl.appendChild(sizesIn);
        sizesRow.appendChild(sizesLbl);
        card.appendChild(sizesRow);

        // ── Distribution rows ─────────────────────────────────────────────────
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
          const pctIn = makeNumInput(zd.dist[String(s)] ?? 0, { min: 0, max: 100, cls: 'zone-input' });
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

      // ── Add zone button ───────────────────────────────────────────────────
      const addZoneBtn = document.createElement('button');
      addZoneBtn.className = 'btn-add-zone';
      addZoneBtn.textContent = '+ Add zone';
      addZoneBtn.addEventListener('click', () => {
        push();
        const zones = circles[i].zones;
        const prevMax = zones.length >= 2 ? zones[zones.length - 2].max : 0;
        const newMax  = Math.round((prevMax + 100) / 2);
        const newZone = { max: newMax, sizes: [...(zones[zones.length - 1].sizes || SIZES)], dist: makeEqualDist(zones[zones.length - 1].sizes || SIZES) };
        zones.splice(zones.length - 1, 0, newZone);
        saveCircles(); buildZoneCards(); generate();
      });
      zoneWrap.appendChild(addZoneBtn);
    }

    buildZoneCards();

    const collapsible = document.createElement('div');
    collapsible.className = 'circle-collapsible';
    collapsible.appendChild(zoneWrap);

    entry.appendChild(header);
    entry.appendChild(shapeRow);
    entry.appendChild(xyRow);
    entry.appendChild(whRow);
    entry.appendChild(rotLbl);
    entry.appendChild(collapsible);
    list.appendChild(entry);
  });
}

function makeAlignIcon(halign, valign) {
  const W = 18, H = 18, pad = 2, dot = 5;
  const cx = halign === 'left' ? pad : halign === 'center' ? (W - dot) / 2 : W - pad - dot;
  const cy = valign === 'top'  ? pad : valign === 'middle' ? (H - dot) / 2 : H - pad - dot;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  const border = document.createElementNS(ns, 'rect');
  border.setAttribute('x', '0.5'); border.setAttribute('y', '0.5');
  border.setAttribute('width', W - 1); border.setAttribute('height', H - 1);
  border.setAttribute('rx', '2'); border.setAttribute('fill', 'none');
  border.setAttribute('stroke', 'currentColor'); border.setAttribute('stroke-opacity', '0.35');
  svg.appendChild(border);
  const dotEl = document.createElementNS(ns, 'rect');
  dotEl.setAttribute('x', cx); dotEl.setAttribute('y', cy);
  dotEl.setAttribute('width', dot); dotEl.setAttribute('height', dot);
  dotEl.setAttribute('rx', '1'); dotEl.setAttribute('fill', 'currentColor');
  svg.appendChild(dotEl);
  return svg;
}

function initAlignBar() {
  const bar = document.getElementById('align-bar');
  const ALIGNS = [
    { h: 'left',   v: 'top',    label: 'Align top-left'     },
    { h: 'center', v: 'top',    label: 'Align top-center'   },
    { h: 'right',  v: 'top',    label: 'Align top-right'    },
    { h: 'left',   v: 'middle', label: 'Align left center'  },
    { h: 'center', v: 'middle', label: 'Center'             },
    { h: 'right',  v: 'middle', label: 'Align right center' },
    { h: 'left',   v: 'bottom', label: 'Align bottom-left'  },
    { h: 'center', v: 'bottom', label: 'Align bottom-center'},
    { h: 'right',  v: 'bottom', label: 'Align bottom-right' },
  ];
  ALIGNS.forEach(({ h, v, label }) => {
    const btn = document.createElement('button');
    btn.className = 'align-btn';
    btn.appendChild(makeAlignIcon(h, v));
    const tooltip = document.createElement('div');
    tooltip.className = 'align-tooltip';
    tooltip.textContent = label;
    btn.appendChild(tooltip);
    btn.addEventListener('click', () => {
      if (selectedMaskIndex < 0 || selectedMaskIndex >= circles.length) return;
      push();
      const c = circles[selectedMaskIndex];
      const w = c.width ?? c.size;
      const mh = c.height ?? c.size;
      if (h === 'left')   c.x = 0;
      if (h === 'center') c.x = (1000 - w) / 2;
      if (h === 'right')  c.x = 1000 - w;
      if (v === 'top')    c.y = 0;
      if (v === 'middle') c.y = (1000 - mh) / 2;
      if (v === 'bottom') c.y = 1000 - mh;
      saveCircles(); renderCircleList(); generate();
    });
    bar.appendChild(btn);
  });
}

export function initMasks() {
  initCanvasDelete();
  initAlignBar();

  document.getElementById('btn-add-circle').addEventListener('click', () => {
    push();
    const sz = 300;
    circles.push({ x: 350, y: 350, size: sz, width: sz, height: sz, rotation: 0, shape: 'circle', zones: defaultZones() });
    saveCircles(); renderCircleList(); generate();
  });
}
