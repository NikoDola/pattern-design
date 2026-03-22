export const NS    = 'http://www.w3.org/2000/svg';
export const SLOT  = 10;
export const COLS  = 100;
export const ROWS  = 100;
export const TOTAL = (COLS * ROWS) / 2;   // 5 000 active cells

const LS_SIZES = 'pattern-designer-sizes';
export const SIZES = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SIZES));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (_) {}
  return [0, 2, 4, 6, 8, 10];
})();

// ── Size distribution ─────────────────────────────────────────────────────────
const LS_PCT = 'pattern-designer-pct';

export const pct = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_PCT));
    if (saved && typeof saved === 'object') {
      // Keep only valid SIZES keys, reset others
      const d = {};
      SIZES.forEach(s => d[s] = saved[s] ?? 0);
      return d;
    }
  } catch (_) {}
  const d = {};
  SIZES.forEach(s => d[s] = s === 10 ? 100 : 0);
  return d;
})();

export function savePct() {
  localStorage.setItem(LS_PCT, JSON.stringify(pct));
}

export function setSizes(newVals) {
  SIZES.length = 0;
  newVals.forEach(v => SIZES.push(v));
  localStorage.setItem(LS_SIZES, JSON.stringify(SIZES));
  // Sync pct: drop stale keys, initialise new ones to 0
  Object.keys(pct).forEach(k => { if (!SIZES.includes(+k)) delete pct[k]; });
  SIZES.forEach(s => { if (pct[s] == null) pct[s] = 0; });
  savePct();
}

// ── Mask zone helpers ─────────────────────────────────────────────────────────
// sizes: array of pixel values, e.g. [0, 2, 4]
export function makeEqualDist(sizes) {
  if (!sizes || !sizes.length) return {};
  if (sizes.length === 1) return { [String(sizes[0])]: 100 };

  const has0    = sizes.includes(0);
  const totalW  = sizes.reduce((a, s) => a + (s === 0 ? 0.5 : 1), 0);

  const dist = {};
  let assigned = 0;
  sizes.forEach((s, idx) => {
    if (idx === sizes.length - 1) {
      dist[String(s)] = 100 - assigned;
    } else {
      const p = Math.round((s === 0 ? 0.5 : 1) / totalW * 100);
      dist[String(s)] = p;
      assigned += p;
    }
  });
  return dist;
}

export function defaultZones() {
  return [{ max: 100, sizes: [...SIZES], dist: makeEqualDist(SIZES) }];
}

// ── Masks ─────────────────────────────────────────────────────────────────────
const LS_CIRCLES = 'pattern-designer-circles';

export const circles = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_CIRCLES));
    if (Array.isArray(saved) && saved.length) {
      saved.forEach(c => {
        if (!c.zones) c.zones = defaultZones();
        // Migrate old label-based zones or broken zones
        c.zones = c.zones.map((z, i, arr) => {
          if (!z.dist || !z.sizes) return { max: Math.round((i + 1) / arr.length * 100), sizes: [...SIZES], dist: makeEqualDist(SIZES) };
          if (z.max == null) {
            const m = z.label && z.label.match(/(\d+)%\s*$/);
            z.max = m ? +m[1] : Math.round((i + 1) / arr.length * 100);
            delete z.label;
          }
          return z;
        });
        if (c.zones.length) c.zones[c.zones.length - 1].max = 100;
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
