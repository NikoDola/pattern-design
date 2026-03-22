export const NS    = 'http://www.w3.org/2000/svg';
export const SLOT  = 10;
export const COLS  = 100;
export const ROWS  = 100;
export const TOTAL = (COLS * ROWS) / 2;   // 5 000 active cells
export const SIZES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// ── Size distribution ─────────────────────────────────────────────────────────
const LS_PCT = 'pattern-designer-pct';

export const pct = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_PCT));
    if (saved && typeof saved === 'object') return saved;
  } catch (_) {}
  const d = {};
  SIZES.forEach(s => d[s] = s === 10 ? 100 : 0);
  return d;
})();

export function savePct() {
  localStorage.setItem(LS_PCT, JSON.stringify(pct));
}

// ── Mask zone helpers ─────────────────────────────────────────────────────────
export function makeEqualDist(min, max) {
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
      const w = s === 0 ? 0.5 : 1;
      const p = Math.round(w / totalW * 100);
      dist[String(s)] = p;
      assigned += p;
    }
  });
  return dist;
}

export function defaultZones() {
  return [
    { label: '0–30%',   min: 0, max: 0,  dist: makeEqualDist(0, 0)  },
    { label: '30–50%',  min: 0, max: 3,  dist: makeEqualDist(0, 3)  },
    { label: '50–80%',  min: 0, max: 7,  dist: makeEqualDist(0, 7)  },
    { label: '80–100%', min: 0, max: 10, dist: makeEqualDist(0, 10) },
  ];
}

// ── Masks ─────────────────────────────────────────────────────────────────────
const LS_CIRCLES = 'pattern-designer-circles';

export const circles = (() => {
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

export function saveCircles() {
  localStorage.setItem(LS_CIRCLES, JSON.stringify(circles));
}

// ── Element shape ─────────────────────────────────────────────────────────────
export let elementShape = localStorage.getItem('pattern-designer-shape') || 'square';

export function setElementShape(v) {
  elementShape = v;
  localStorage.setItem('pattern-designer-shape', v);
}

// ── Mask mode ─────────────────────────────────────────────────────────────────
export let maskMode = localStorage.getItem('pattern-designer-mode') || 'mask';

export function setMaskMode(v) {
  maskMode = v;
  localStorage.setItem('pattern-designer-mode', v);
}

// ── Colors ────────────────────────────────────────────────────────────────────
export function saveColors(rectColor, bgColor) {
  localStorage.setItem('pattern-designer-colors', JSON.stringify({ rectColor, bgColor }));
}

export function loadColors() {
  try { return JSON.parse(localStorage.getItem('pattern-designer-colors')); }
  catch (_) { return null; }
}
