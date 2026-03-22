import { NS, SLOT, COLS, ROWS, TOTAL, SIZES, pct, circles, elementShape, maskMode, saveColors } from './state.js';

export function buildPool() {
  const sum = SIZES.reduce((a, s) => a + (pct[s] || 0), 0);
  if (sum === 0) return Array(TOTAL).fill(SIZES[SIZES.length - 1] ?? 0);

  const pool = [];
  SIZES.forEach(size => {
    const count = Math.round((pct[size] || 0) / sum * TOTAL);
    for (let i = 0; i < count; i++) pool.push(size);
  });

  const fallback = SIZES.find(s => (pct[s] || 0) > 0) ?? SIZES[SIZES.length - 1] ?? 0;
  while (pool.length < TOTAL) pool.push(fallback);
  pool.length = TOTAL;

  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function getCircleInfo(px, py) {
  let maxDepth = -1, best = null;
  circles.forEach(c => {
    const w   = c.width  ?? c.size;
    const h   = c.height ?? c.size;
    const rx  = w / 2;
    const ry  = h / 2;
    const ccx = c.x + rx;
    const ccy = c.y + ry;
    const rot = (c.rotation ?? 0) * Math.PI / 180;
    if (rx <= 0 || ry <= 0) return;

    // Rotate test point into local (unrotated) mask space
    let ldx = px - ccx;
    let ldy = py - ccy;
    if (rot !== 0) {
      const cosR = Math.cos(-rot), sinR = Math.sin(-rot);
      const tx = ldx * cosR - ldy * sinR;
      const ty = ldx * sinR + ldy * cosR;
      ldx = tx; ldy = ty;
    }

    let depth;
    if (c.shape === 'square') {
      const nd = Math.max(Math.abs(ldx) / rx, Math.abs(ldy) / ry);
      if (nd > 1) return;
      depth = nd * 100;
    } else {
      const nd = Math.sqrt((ldx / rx) ** 2 + (ldy / ry) ** 2);
      if (nd > 1) return;
      depth = nd * 100;
    }
    if (depth > maxDepth) { maxDepth = depth; best = c; }
  });
  return { depth: maxDepth, circle: best };
}

export function pickFromDist(dist) {
  const entries = Object.entries(dist).map(([k, v]) => [+k, +v]);
  const total   = entries.reduce((s, [, p]) => s + p, 0);
  if (total === 0) return +(entries[0]?.[0] ?? 0);
  let r = Math.random() * total;
  for (const [size, p] of entries) { r -= p; if (r <= 0) return size; }
  return entries[entries.length - 1][0];
}

export function getSizeForDepth(depth, zones) {
  for (const z of zones) {
    if (depth <= z.max) return pickFromDist(z.dist);
  }
  return pickFromDist(zones[zones.length - 1].dist);
}

export function generate() {
  const artboard  = document.getElementById('artboard');
  const rectColor = document.getElementById('rect-color').value;
  const bgColor   = document.getElementById('bg-color').value;

  saveColors(rectColor, bgColor);
  artboard.setAttribute('style', `background:${bgColor}`);
  artboard.innerHTML = '';

  const pool = buildPool();
  let idx = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if ((col + row) % 2 !== 0) continue;

      const poolSize = pool[idx++];
      const cx = col * SLOT + SLOT / 2;
      const cy = row * SLOT + SLOT / 2;

      const { depth, circle } = getCircleInfo(cx, cy);

      let size;
      if (maskMode === 'reverse') {
        if (depth < 0) continue;                          // outside all masks → nothing
        size = getSizeForDepth(100 - depth, circle.zones); // inverted: center = full, edge = zero
      } else {
        size = depth >= 0 ? getSizeForDepth(depth, circle.zones) : poolSize;
      }

      if (size === 0) continue;

      const offset = (SLOT - size) / 2;
      const slotX  = col * SLOT;
      const slotY  = row * SLOT;

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

  // Reference mask outlines — rendered bottom-up so circles[0] sits on top
  for (let i = circles.length - 1; i >= 0; i--) {
  const c = circles[i];
    const w   = c.width  ?? c.size;
    const h   = c.height ?? c.size;
    const rot = c.rotation ?? 0;
    const cx  = c.x + w / 2;
    const cy  = c.y + h / 2;

    let el;
    if (c.shape === 'square') {
      el = document.createElementNS(NS, 'rect');
      el.setAttribute('x',      c.x);
      el.setAttribute('y',      c.y);
      el.setAttribute('width',  w);
      el.setAttribute('height', h);
    } else {
      el = document.createElementNS(NS, 'ellipse');
      el.setAttribute('cx', cx);
      el.setAttribute('cy', cy);
      el.setAttribute('rx', w / 2);
      el.setAttribute('ry', h / 2);
    }
    el.setAttribute('fill',             'transparent');
    el.setAttribute('stroke',           '#4f8ef7');
    el.setAttribute('stroke-width',     '1');
    el.setAttribute('stroke-dasharray', '5 4');
    if (rot !== 0) el.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
    el.dataset.reference = 'true';
    el.dataset.maskIndex = String(i);
    artboard.appendChild(el);
  }

  artboard.dispatchEvent(new CustomEvent('pattern:generated'));
}
