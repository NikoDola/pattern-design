const NS = "http://www.w3.org/2000/svg";

// ── Grid constants ──────────────────────────────────────────────────────────
// Checkerboard: 100×100 grid of 10px slots.
// Only cells where (col+row) is even get a rect — 5 000 active slots.
// Background color fills the "white" squares (no extra white rects needed).
const SLOT   = 10;
const COLS   = 100;
const ROWS   = 100;
const TOTAL  = (COLS * ROWS) / 2;   // 5 000 active cells
const SIZES  = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

const LS_KEY = 'pattern-designer-pct';

// ── Load saved state or use defaults ────────────────────────────────────────
function loadPct() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && typeof saved === 'object') return saved;
  } catch (_) {}
  // Default: all rects are 10 px
  const d = {};
  SIZES.forEach(s => d[s] = s === 10 ? 100 : 0);
  return d;
}

function savePct(pct) {
  localStorage.setItem(LS_KEY, JSON.stringify(pct));
}

const pct = loadPct();

// ── Build sidebar controls ───────────────────────────────────────────────────
const controlsEl    = document.getElementById('controls');
const totalDisplay  = document.getElementById('total-display');
const totalFill     = document.getElementById('total-fill');

const sliderEls = {};
const numEls    = {};

SIZES.forEach(size => {
  const row = document.createElement('div');
  row.className = 'size-row';

  const label = document.createElement('span');
  label.className = 'size-label';
  label.textContent = size + 'px';

  const slider = document.createElement('input');
  slider.type  = 'range';
  slider.min   = 0;
  slider.max   = 100;
  slider.step  = 1;
  slider.value = pct[size] ?? 0;
  slider.dataset.size = size;

  const numInput = document.createElement('input');
  numInput.type      = 'number';
  numInput.className = 'pct-input';
  numInput.min  = 0;
  numInput.max  = 100;
  numInput.step = 1;
  numInput.value = pct[size] ?? 0;
  numInput.dataset.size = size;

  slider.addEventListener('input', () => {
    pct[size] = +slider.value;
    numInput.value = slider.value;
    updateTotal();
    savePct(pct);
  });

  numInput.addEventListener('input', () => {
    const v = Math.max(0, Math.min(100, +numInput.value || 0));
    numInput.value = v;
    pct[size] = v;
    slider.value = v;
    updateTotal();
    savePct(pct);
  });

  sliderEls[size] = slider;
  numEls[size]    = numInput;

  row.appendChild(label);
  row.appendChild(slider);
  row.appendChild(numInput);
  controlsEl.appendChild(row);
});

function updateTotal() {
  const sum = SIZES.reduce((a, s) => a + (pct[s] || 0), 0);
  totalDisplay.textContent = sum + '%';
  totalFill.style.width = Math.min(sum, 100) + '%';
  totalDisplay.className = sum > 100 ? 'over' : sum === 100 ? 'exact' : '';
  totalFill.className    = sum > 100 ? 'over' : sum === 100 ? 'exact' : '';
}
updateTotal();

// ── Weighted pool ────────────────────────────────────────────────────────────
function buildPool() {
  const sum = SIZES.reduce((a, s) => a + (pct[s] || 0), 0);
  if (sum === 0) return Array(TOTAL).fill(10);

  const pool = [];
  SIZES.forEach(size => {
    const count = Math.round((pct[size] || 0) / sum * TOTAL);
    for (let i = 0; i < count; i++) pool.push(size);
  });

  // Pad / trim to exact TOTAL
  const fallback = SIZES.find(s => (pct[s] || 0) > 0) || 10;
  while (pool.length < TOTAL) pool.push(fallback);
  pool.length = TOTAL;

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// ── Circle depth helpers ──────────────────────────────────────────────────────
// Build an equal % distribution from min to max.
// 0px always gets half the weight of other sizes.
function makeEqualDist(min, max) {
  if (max < min) max = min;
  const sizes = [];
  for (let s = min; s <= max; s++) sizes.push(s);
  if (sizes.length === 1) return { [String(sizes[0])]: 100 };

  const has0       = min === 0;
  const nonZeroCnt = has0 ? sizes.length - 1 : sizes.length;
  const totalW     = nonZeroCnt + (has0 ? 0.5 : 0);

  const dist = {};
  let assigned = 0;
  sizes.forEach((s, idx) => {
    if (idx === sizes.length - 1) {
      dist[String(s)] = 100 - assigned;
    } else {
      const w   = s === 0 ? 0.5 : 1;
      const pct = Math.round(w / totalW * 100);
      dist[String(s)] = pct;
      assigned += pct;
    }
  });
  return dist;
}

function defaultZones() {
  return [
    { label: '0–30%',   min: 0, max: 0,  dist: makeEqualDist(0, 0)  },
    { label: '30–50%',  min: 0, max: 3,  dist: makeEqualDist(0, 3)  },
    { label: '50–80%',  min: 0, max: 7,  dist: makeEqualDist(0, 7)  },
    { label: '80–100%', min: 0, max: 10, dist: makeEqualDist(0, 10) },
  ];
}

// Returns { depth, circle } for the mask where depth% is highest (most exposed),
// or { depth: -1, circle: null } if outside every mask.
// depth: 0 = core, 100 = edge
function getCircleInfo(px, py) {
  let maxDepth = -1, best = null;
  circles.forEach(c => {
    const r   = c.size / 2;
    const ccx = c.x + r;
    const ccy = c.y + r;
    if (r <= 0) return;

    let depth;
    if (c.shape === 'square') {
      const ndx = Math.abs(px - ccx) / r;  // 0=center, 1=edge
      const ndy = Math.abs(py - ccy) / r;
      const nd  = Math.max(ndx, ndy);       // Chebyshev distance
      if (nd > 1) return;                   // outside square
      depth = nd * 100;
    } else {
      const dist = Math.sqrt((px - ccx) ** 2 + (py - ccy) ** 2);
      if (dist > r) return;
      depth = (dist / r) * 100;
    }

    if (depth > maxDepth) { maxDepth = depth; best = c; }
  });
  return { depth: maxDepth, circle: best };
}

function pickFromDist(dist) {
  const entries = Object.entries(dist).map(([k, v]) => [+k, +v]);
  const total   = entries.reduce((s, [, p]) => s + p, 0);
  if (total === 0) return +(entries[0]?.[0] ?? 0);
  let r = Math.random() * total;
  for (const [size, pct] of entries) { r -= pct; if (r <= 0) return size; }
  return entries[entries.length - 1][0];
}

function getSizeForDepth(depth, zones) {
  const z = depth < 30 ? zones[0]
          : depth < 50 ? zones[1]
          : depth < 80 ? zones[2]
          :              zones[3];
  return pickFromDist(z.dist);
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function generate() {
  const artboard  = document.getElementById('artboard');
  const rectColor = document.getElementById('rect-color').value;
  const bgColor   = document.getElementById('bg-color').value;

  localStorage.setItem('pattern-designer-colors', JSON.stringify({ rectColor, bgColor }));
  artboard.setAttribute('style', `background:${bgColor}`);
  artboard.innerHTML = '';

  const pool = buildPool();
  let idx = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if ((col + row) % 2 !== 0) continue;

      // Pool always advances so distribution stays correct outside circles
      const poolSize = pool[idx++];

      // Center of this rect cell
      const cx = col * SLOT + SLOT / 2;
      const cy = row * SLOT + SLOT / 2;

      const { depth, circle } = getCircleInfo(cx, cy);
      const size = depth >= 0 ? getSizeForDepth(depth, circle.zones) : poolSize;

      if (size === 0) continue;   // invisible — skip drawing

      const offset  = (SLOT - size) / 2;
      const slotX   = col * SLOT;
      const slotY   = row * SLOT;

      let el;
      if (elementShape === 'circle') {
        el = document.createElementNS(NS, 'circle');
        el.setAttribute('cx', slotX + SLOT / 2);
        el.setAttribute('cy', slotY + SLOT / 2);
        el.setAttribute('r',  size / 2);
      } else {
        el = document.createElementNS(NS, 'rect');
        el.setAttribute('x',      slotX + offset);
        el.setAttribute('y',      slotY + offset);
        el.setAttribute('width',  size);
        el.setAttribute('height', size);
      }
      el.setAttribute('fill', rectColor);
      artboard.appendChild(el);
    }
  }

  // ── Reference mask outlines (UI only, stripped on download) ──────────────────
  circles.forEach(c => {
    let el;
    if (c.shape === 'square') {
      el = document.createElementNS(NS, 'rect');
      el.setAttribute('x',      c.x);
      el.setAttribute('y',      c.y);
      el.setAttribute('width',  c.size);
      el.setAttribute('height', c.size);
    } else {
      el = document.createElementNS(NS, 'circle');
      el.setAttribute('cx', c.x + c.size / 2);
      el.setAttribute('cy', c.y + c.size / 2);
      el.setAttribute('r',  c.size / 2);
    }
    el.setAttribute('fill',             'none');
    el.setAttribute('stroke',           '#4f8ef7');
    el.setAttribute('stroke-width',     '1');
    el.setAttribute('stroke-dasharray', '5 4');
    el.dataset.reference = 'true';
    artboard.appendChild(el);
  });
}

// ── Element shape ─────────────────────────────────────────────────────────────
let elementShape = localStorage.getItem('pattern-designer-shape') || 'square';

document.querySelectorAll('.shape-btn').forEach(btn => {
  if (btn.dataset.shape === elementShape) btn.classList.add('active');
  else btn.classList.remove('active');

  btn.addEventListener('click', () => {
    elementShape = btn.dataset.shape;
    localStorage.setItem('pattern-designer-shape', elementShape);
    document.querySelectorAll('.shape-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.shape === elementShape)
    );
    generate();
  });
});

// ── Circles state ─────────────────────────────────────────────────────────────
const LS_CIRCLES = 'pattern-designer-circles';

let circles = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_CIRCLES));
    if (Array.isArray(saved) && saved.length) {
      saved.forEach(c => {
        if (!c.zones) c.zones = defaultZones();
        c.zones = c.zones.map((z, i) => z.dist ? z : defaultZones()[i]);
        if (!c.shape) c.shape = 'circle';
      });
      return saved;
    }
  } catch (_) {}
  return [{ x: 300, y: 300, size: 300, shape: 'circle', zones: defaultZones() }];
})();

function saveCircles() {
  localStorage.setItem(LS_CIRCLES, JSON.stringify(circles));
}


function makeNumInput(value, opts = {}) {
  const el = document.createElement('input');
  el.type = 'number';
  el.value = value;
  if (opts.min !== undefined) el.min = opts.min;
  if (opts.max !== undefined) el.max = opts.max;
  if (opts.cls) el.className = opts.cls;
  return el;
}

function renderCircleList() {
  const list = document.getElementById('circle-list');
  list.innerHTML = '';

  circles.forEach((c, i) => {
    const entry = document.createElement('div');
    entry.className = 'circle-entry' + (c.minimized ? ' minimized' : '');

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'circle-entry-header';
    header.innerHTML = `<span>Mask ${i + 1}</span>`;

    const headerBtns = document.createElement('div');
    headerBtns.className = 'circle-header-btns';

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
      askConfirm(() => {
        circles.splice(i, 1); saveCircles(); renderCircleList(); generate();
      });
    });

    headerBtns.appendChild(minBtn);
    headerBtns.appendChild(delBtn);
    header.appendChild(headerBtns);

    // ── Shape toggle ────────────────────────────────────────────────────────
    const shapeRow = document.createElement('div');
    shapeRow.className = 'mask-shape-row';

    ['circle', 'square'].forEach(shape => {
      const btn = document.createElement('button');
      btn.className = 'mask-shape-btn' + (c.shape === shape ? ' active' : '');
      btn.textContent = shape === 'circle' ? '● Circle' : '■ Square';
      btn.addEventListener('click', () => {
        circles[i].shape = shape;
        saveCircles(); renderCircleList(); generate();
      });
      shapeRow.appendChild(btn);
    });

    // ── X / Y ───────────────────────────────────────────────────────────────
    const xyRow = document.createElement('div');
    xyRow.className = 'xy-row';

    const xLbl = document.createElement('label'); xLbl.textContent = 'X ';
    const xIn  = makeNumInput(c.x);
    xIn.addEventListener('input', () => { circles[i].x = +xIn.value; saveCircles(); generate(); });
    xLbl.appendChild(xIn);

    const yLbl = document.createElement('label'); yLbl.textContent = 'Y ';
    const yIn  = makeNumInput(c.y);
    yIn.addEventListener('input', () => { circles[i].y = +yIn.value; saveCircles(); generate(); });
    yLbl.appendChild(yIn);

    const centerBtn = document.createElement('button');
    centerBtn.className = 'btn-center-mask';
    centerBtn.textContent = '⊕';
    centerBtn.title = 'Center on canvas';
    centerBtn.addEventListener('click', () => {
      circles[i].x = (1000 - circles[i].size) / 2;
      circles[i].y = (1000 - circles[i].size) / 2;
      saveCircles(); renderCircleList(); generate();
    });

    xyRow.appendChild(xLbl); xyRow.appendChild(yLbl); xyRow.appendChild(centerBtn);

    // ── Size ────────────────────────────────────────────────────────────────
    const sizeLbl = document.createElement('label');
    sizeLbl.className = 'full-label'; sizeLbl.textContent = 'Size ';
    const sizeIn = makeNumInput(c.size, { min: 1 });
    sizeIn.addEventListener('input', () => { circles[i].size = +sizeIn.value || 1; saveCircles(); generate(); });
    sizeLbl.appendChild(sizeIn);

    // ── Zone cards ───────────────────────────────────────────────────────────
    const zoneWrap = document.createElement('div');
    zoneWrap.className = 'zone-wrap';

    c.zones.forEach((z, zi) => {
      const card = document.createElement('div');
      card.className = 'zone-card';

      const zlbl = document.createElement('div');
      zlbl.className = 'zone-card-label';
      zlbl.textContent = z.label;
      card.appendChild(zlbl);

      // Min / Max
      const mmRow = document.createElement('div');
      mmRow.className = 'zone-mm-row';

      const minLbl = document.createElement('label'); minLbl.textContent = 'Min ';
      const minIn  = makeNumInput(z.min, { min: 0, max: 10, cls: 'zone-input' });
      minLbl.appendChild(minIn);

      const maxLbl = document.createElement('label'); maxLbl.textContent = 'Max ';
      const maxIn  = makeNumInput(z.max, { min: 0, max: 10, cls: 'zone-input' });
      maxLbl.appendChild(maxIn);

      mmRow.appendChild(minLbl); mmRow.appendChild(maxLbl);
      card.appendChild(mmRow);

      // Per-pixel % rows
      const distWrap = document.createElement('div');
      distWrap.className = 'zone-dist-wrap';

      // Warning label shown below the dist rows
      const zoneWarning = document.createElement('div');
      zoneWarning.className = 'zone-total-warn';

      function updateZoneWarning() {
        const zd  = circles[i].zones[zi];
        const sum = Object.values(zd.dist).reduce((a, b) => a + (+b || 0), 0);
        zoneWarning.textContent = `Total: ${sum}%`;
        zoneWarning.className   = 'zone-total-warn' + (sum > 100 ? ' warn-over' : sum === 100 ? ' warn-exact' : '');
      }

      function renderDistRows() {
        distWrap.innerHTML = '';
        const zd = circles[i].zones[zi];
        for (let s = zd.min; s <= zd.max; s++) {
          const drow  = document.createElement('div');
          drow.className = 'zone-dist-row';
          const plbl  = document.createElement('span');
          plbl.className = 'zone-px-label';
          plbl.textContent = s + 'px';
          const pctIn = makeNumInput(zd.dist[String(s)] ?? 0, { min: 0, max: 100, cls: 'zone-input' });
          pctIn.addEventListener('input', () => {
            circles[i].zones[zi].dist[String(s)] = Math.max(0, Math.min(100, +pctIn.value || 0));
            saveCircles(); generate(); updateZoneWarning();
          });
          drow.appendChild(plbl); drow.appendChild(pctIn);
          distWrap.appendChild(drow);
        }
        updateZoneWarning();
      }
      renderDistRows();

      minIn.addEventListener('change', () => {
        let v = Math.max(0, Math.min(10, +minIn.value || 0));
        if (v > circles[i].zones[zi].max) v = circles[i].zones[zi].max;
        circles[i].zones[zi].min  = v;
        circles[i].zones[zi].dist = makeEqualDist(v, circles[i].zones[zi].max);
        saveCircles(); renderCircleList(); generate();
      });

      maxIn.addEventListener('change', () => {
        let v = Math.max(0, Math.min(10, +maxIn.value || 0));
        if (v < circles[i].zones[zi].min) v = circles[i].zones[zi].min;
        circles[i].zones[zi].max  = v;
        circles[i].zones[zi].dist = makeEqualDist(circles[i].zones[zi].min, v);
        saveCircles(); renderCircleList(); generate();
      });

      card.appendChild(distWrap);
      card.appendChild(zoneWarning);
      zoneWrap.appendChild(card);
    });

    const collapsible = document.createElement('div');
    collapsible.className = 'circle-collapsible';
    collapsible.appendChild(zoneWrap);

    entry.appendChild(header);
    entry.appendChild(shapeRow);
    entry.appendChild(xyRow);
    entry.appendChild(sizeLbl);
    entry.appendChild(collapsible);
    list.appendChild(entry);
  });
}

document.getElementById('btn-add-circle').addEventListener('click', () => {
  circles.push({ x: 300, y: 300, size: 300, shape: 'circle', zones: defaultZones() });
  saveCircles(); renderCircleList(); generate();
});

// ── Restore color picks ───────────────────────────────────────────────────────
try {
  const colors = JSON.parse(localStorage.getItem('pattern-designer-colors'));
  if (colors) {
    document.getElementById('rect-color').value = colors.rectColor;
    document.getElementById('bg-color').value   = colors.bgColor;
  }
} catch (_) {}

// ── Button handlers ───────────────────────────────────────────────────────────
document.getElementById('btn-equalise').addEventListener('click', () => {
  SIZES.forEach(size => {
    pct[size] = 10;
    sliderEls[size].value = 10;
    numEls[size].value    = 10;
  });
  updateTotal(); savePct(pct); generate();
});

document.getElementById('btn-dice').addEventListener('click', () => {
  const weights = SIZES.map(() => Math.random());
  const total   = weights.reduce((a, b) => a + b, 0);
  let assigned  = 0;
  SIZES.forEach((size, idx) => {
    const val = idx < SIZES.length - 1
      ? Math.round(weights[idx] / total * 100)
      : 100 - assigned;
    pct[size] = val;
    assigned += val;
    sliderEls[size].value = val;
    numEls[size].value    = val;
  });
  updateTotal(); savePct(pct); generate();
});

document.getElementById('btn-generate').addEventListener('click', generate);

document.getElementById('btn-reset').addEventListener('click', () => {
  SIZES.forEach(size => {
    pct[size] = size === 10 ? 100 : 0;
    sliderEls[size].value = pct[size];
    numEls[size].value    = pct[size];
  });
  updateTotal();
  savePct(pct);
  generate();
});

// ── Color pickers live-update background ──────────────────────────────────────
document.getElementById('bg-color').addEventListener('input', e => {
  document.getElementById('artboard').setAttribute('style', `background:${e.target.value}`);
  localStorage.setItem('pattern-designer-colors', JSON.stringify({
    rectColor: document.getElementById('rect-color').value,
    bgColor: e.target.value
  }));
});

// ── Export helpers ────────────────────────────────────────────────────────────
function buildExportSVGString({ withBackground = false } = {}) {
  const artboard = document.getElementById('artboard');
  const clone    = artboard.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('style');  // strip CSS background
  clone.querySelectorAll('[data-reference]').forEach(el => el.remove());

  if (withBackground) {
    const bgColor = document.getElementById('bg-color').value;
    const bgRect  = document.createElementNS(NS, 'rect');
    bgRect.setAttribute('x', 0); bgRect.setAttribute('y', 0);
    bgRect.setAttribute('width', 1000); bgRect.setAttribute('height', 1000);
    bgRect.setAttribute('fill', bgColor);
    clone.insertBefore(bgRect, clone.firstChild);
  }

  return '<?xml version="1.0" encoding="utf-8"?>\n' + clone.outerHTML;
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

function exportToCanvas(callback, withBackground = false) {
  const svgStr = buildExportSVGString({ withBackground });
  const blob   = new Blob([svgStr], { type: 'image/svg+xml' });
  const url    = URL.createObjectURL(blob);
  const img    = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1000;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    callback(canvas);
  };
  img.src = url;
}

// ── Settings snapshot ─────────────────────────────────────────────────────────
function buildSettingsSnapshot() {
  return {
    pct,
    circles,
    elementShape,
    rectColor: document.getElementById('rect-color').value,
    bgColor:   document.getElementById('bg-color').value,
  };
}

function applySettingsSnapshot(s) {
  // Colors
  if (s.rectColor) document.getElementById('rect-color').value = s.rectColor;
  if (s.bgColor)   document.getElementById('bg-color').value   = s.bgColor;
  localStorage.setItem('pattern-designer-colors', JSON.stringify({ rectColor: s.rectColor, bgColor: s.bgColor }));

  // Size distribution
  if (s.pct) {
    SIZES.forEach(size => {
      const v = s.pct[size] ?? 0;
      pct[size] = v;
      sliderEls[size].value = v;
      numEls[size].value    = v;
    });
    updateTotal();
    savePct(pct);
  }

  // Element shape
  if (s.elementShape) {
    elementShape = s.elementShape;
    localStorage.setItem('pattern-designer-shape', elementShape);
    document.querySelectorAll('.shape-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.shape === elementShape)
    );
  }

  // Masks
  if (Array.isArray(s.circles)) {
    circles.length = 0;
    s.circles.forEach(c => {
      if (!c.zones) c.zones = defaultZones();
      c.zones = c.zones.map((z, i) => z.dist ? z : defaultZones()[i]);
      if (!c.shape) c.shape = 'circle';
      circles.push(c);
    });
    saveCircles();
    renderCircleList();
  }

  generate();
}

document.getElementById('btn-download-svg').addEventListener('click', () => {
  const stamp  = Date.now();
  const svgStr = buildExportSVGString();
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
  const svgUrl  = URL.createObjectURL(svgBlob);
  triggerDownload(svgUrl, `pattern-${stamp}.svg`);
  URL.revokeObjectURL(svgUrl);

  // Also download matching JSON
  const json     = JSON.stringify(buildSettingsSnapshot(), null, 2);
  const jsonBlob = new Blob([json], { type: 'application/json' });
  const jsonUrl  = URL.createObjectURL(jsonBlob);
  triggerDownload(jsonUrl, `pattern-${stamp}.json`);
  URL.revokeObjectURL(jsonUrl);
});

document.getElementById('btn-download-png').addEventListener('click', () => {
  // No background — transparent PNG
  exportToCanvas(canvas => {
    triggerDownload(canvas.toDataURL('image/png'), `pattern-${Date.now()}.png`);
  }, false);
});

document.getElementById('btn-download-jpg').addEventListener('click', () => {
  // JPG has no transparency — bake in the background color
  exportToCanvas(canvas => {
    triggerDownload(canvas.toDataURL('image/jpeg', 0.95), `pattern-${Date.now()}.jpg`);
  }, true);
});

// ── Confirm dialog ───────────────────────────────────────────────────────────
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmYes     = document.getElementById('confirm-yes');
const confirmNo      = document.getElementById('confirm-no');
let   pendingDelete  = null;

function askConfirm(onYes) {
  pendingDelete = onYes;
  confirmOverlay.classList.add('visible');
}

confirmYes.addEventListener('click', () => {
  if (pendingDelete) { pendingDelete(); pendingDelete = null; }
  confirmOverlay.classList.remove('visible');
});

confirmNo.addEventListener('click', () => {
  pendingDelete = null;
  confirmOverlay.classList.remove('visible');
});

// Close on backdrop click
confirmOverlay.addEventListener('click', e => {
  if (e.target === confirmOverlay) {
    pendingDelete = null;
    confirmOverlay.classList.remove('visible');
  }
});

// ── JSON import ───────────────────────────────────────────────────────────────
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('file-import').click();
});

document.getElementById('file-import').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const s = JSON.parse(ev.target.result);
      applySettingsSnapshot(s);
    } catch (_) {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be re-uploaded if needed
  e.target.value = '';
});

// ── Initial render ────────────────────────────────────────────────────────────
renderCircleList();
generate()
