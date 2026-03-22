import { NS, SLOT, COLS, ROWS, TOTAL, SIZES, pct, circles, elementShape, maskMode, saveColors, customShapes, sizeShapes } from './state.js';

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

export function updateSubtitle() {
  const el = document.querySelector('.subtitle');
  if (el) el.textContent = `1000×1000 · ${TOTAL.toLocaleString()} slots · ${SLOT}px grid`;
}

// ── CSS-based color update (no re-render) ─────────────────────────────────────
// Builds a <style> block inside the artboard that drives all element colors.
// Call this instead of generate() when only colors change.
export function updatePatternColors() {
  const artboard  = document.getElementById('artboard');
  if (!artboard) return;

  const rectColor = document.getElementById('rect-color')?.value || '#000000';
  const bgColor   = document.getElementById('bg-color')?.value   || '#ffffff';
  saveColors(rectColor, bgColor);

  let styleEl = artboard.querySelector('style[data-co]');
  if (!styleEl) {
    styleEl = document.createElementNS(NS, 'style');
    styleEl.setAttribute('data-co', '1');
    artboard.insertBefore(styleEl, artboard.firstChild);
  }

  let css = '';

  // Default fill for all pattern rects and circles (not the mask reference outlines)
  css += `#artboard rect:not([data-reference]),#artboard circle{fill:${rectColor}}\n`;

  // Global CSS vars for each custom shape
  customShapes.forEach(shape => {
    if (!shape.colors?.length) return;
    const vars = shape.colors.map((c, i) => `--c${i}:${shape.colorMap?.[c] || c}`).join(';');
    css += `#artboard .cs-${shape.id}{${vars}}\n`;
  });

  // Per-size element-color override (for rect / circle / no-fill use)
  // and per-size CSS-var overrides for custom shapes
  SIZES.forEach(size => {
    if (size === 0) return;
    const assign  = sizeShapes[String(size)] || {};
    const shapeId = assign.shapeId || elementShape;
    const shape   = customShapes.find(s => s.id === shapeId);

    // Element color override
    const elColor = assign.color;
    if (elColor) {
      if (!shape || !shape.colors?.length) {
        // Built-in or no-fill custom shape: override fill
        css += `#artboard rect.sz${size},#artboard circle.sz${size},#artboard use.nf.sz${size}{fill:${elColor}}\n`;
      }
    }

    // Per-size CSS-var overrides for custom shapes
    if (shape?.colors?.length && assign.colorOverrides) {
      const parts = shape.colors
        .map((orig, i) => assign.colorOverrides[orig] ? `--c${i}:${assign.colorOverrides[orig]}` : '')
        .filter(Boolean);
      if (parts.length) {
        css += `#artboard .cs-${shapeId}.sz${size}{${parts.join(';')}}\n`;
      }
    }
  });

  styleEl.textContent = css;
}

// ── Full pattern render ───────────────────────────────────────────────────────
export function generate() {
  const artboard = document.getElementById('artboard');
  const bgColor  = document.getElementById('bg-color').value;

  artboard.setAttribute('style', `background:${bgColor}`);
  artboard.innerHTML = '';

  // Inject <defs> for used custom shapes
  const usedCustomIds = new Set();
  SIZES.forEach(s => {
    if (s === 0) return;
    const sid = sizeShapes[String(s)]?.shapeId || elementShape;
    if (sid !== 'square' && sid !== 'circle') usedCustomIds.add(sid);
  });
  if (elementShape !== 'square' && elementShape !== 'circle') usedCustomIds.add(elementShape);

  if (usedCustomIds.size > 0) {
    const defs = document.createElementNS(NS, 'defs');
    for (const sid of usedCustomIds) {
      const shape = customShapes.find(s => s.id === sid);
      if (!shape) continue;
      const sym = document.createElementNS(NS, 'symbol');
      sym.setAttribute('id', `cs_${sid}`);
      sym.setAttribute('viewBox', shape.viewBox);
      sym.innerHTML = shape.symbolContent;
      defs.appendChild(sym);
    }
    artboard.appendChild(defs);
  }

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
        if (depth < 0) continue;
        size = getSizeForDepth(100 - depth, circle.zones);
      } else {
        size = depth >= 0 ? getSizeForDepth(depth, circle.zones) : poolSize;
      }

      if (size === 0) continue;

      const offset = (SLOT - size) / 2;
      const slotX  = col * SLOT;
      const slotY  = row * SLOT;

      const assign  = sizeShapes[String(size)] || {};
      const shapeId = assign.shapeId || elementShape;

      let el;
      if (shapeId === 'circle') {
        el = document.createElementNS(NS, 'circle');
        el.setAttribute('cx', slotX + SLOT / 2);
        el.setAttribute('cy', slotY + SLOT / 2);
        el.setAttribute('r',  size / 2);
        el.setAttribute('class', `sz${size}`);
      } else if (shapeId === 'square') {
        el = document.createElementNS(NS, 'rect');
        el.setAttribute('x',      slotX + offset);
        el.setAttribute('y',      slotY + offset);
        el.setAttribute('width',  size);
        el.setAttribute('height', size);
        el.setAttribute('class', `sz${size}`);
      } else {
        const shape = customShapes.find(s => s.id === shapeId);
        if (shape) {
          el = document.createElementNS(NS, 'use');
          el.setAttribute('href',   `#cs_${shapeId}`);
          el.setAttribute('x',      slotX + offset);
          el.setAttribute('y',      slotY + offset);
          el.setAttribute('width',  size);
          el.setAttribute('height', size);
          // Class: cs-{id} for CSS-var targeting, sz{size} for per-size override,
          // nf (no-fill) if this shape has no detected colors (uses element fill)
          const cls = `cs-${shapeId} sz${size}` + (shape.colors?.length ? '' : ' nf');
          el.setAttribute('class', cls);
        } else {
          // Deleted shape fallback → rect
          el = document.createElementNS(NS, 'rect');
          el.setAttribute('x',      slotX + offset);
          el.setAttribute('y',      slotY + offset);
          el.setAttribute('width',  size);
          el.setAttribute('height', size);
          el.setAttribute('class', `sz${size}`);
        }
      }
      if (el) artboard.appendChild(el);
    }
  }

  // Reference mask outlines — explicit fill/stroke inline (not driven by CSS)
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

  // Apply colors via CSS style block (no inline fill/style on pattern elements)
  updatePatternColors();

  artboard.dispatchEvent(new CustomEvent('pattern:generated'));
  updateSubtitle();
}
