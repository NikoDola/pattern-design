import { circles, saveCircles } from './state.js';
import { generate }             from './generate.js';
import { renderCircleList, selectMask, deselectMask } from './masks.js';

const SVG_NS    = 'http://www.w3.org/2000/svg';
const HANDLE_SZ = 9;

let selectedIndex = null;
let dragging      = null;

export function setPanSelectedIndex(i) { selectedIndex = i; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function eff(c) {
  return { w: c.width ?? c.size, h: c.height ?? c.size, rot: c.rotation ?? 0 };
}

function rotPt(px, py, cx, cy, deg) {
  const r = deg * Math.PI / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos,
  };
}

function clientToSvg(artboard, e) {
  const pt = artboard.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(artboard.getScreenCTM().inverse());
}

function updateRefEl(el, c) {
  const w   = c.width    ?? c.size;
  const h   = c.height   ?? c.size;
  const rot = c.rotation ?? 0;
  const cx  = c.x + w / 2;
  const cy  = c.y + h / 2;
  if (c.shape === 'square') {
    el.setAttribute('x',      c.x);
    el.setAttribute('y',      c.y);
    el.setAttribute('width',  w);
    el.setAttribute('height', h);
  } else {
    el.setAttribute('cx', cx);
    el.setAttribute('cy', cy);
    el.setAttribute('rx', w / 2);
    el.setAttribute('ry', h / 2);
  }
  if (rot !== 0) el.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
  else           el.removeAttribute('transform');
}

// ── Gizmo ─────────────────────────────────────────────────────────────────────
function drawGizmo(artboard) {
  artboard.querySelectorAll('[data-gizmo-group]').forEach(el => el.remove());
  if (selectedIndex === null || selectedIndex >= circles.length) return;

  const c         = circles[selectedIndex];
  const { w, h, rot } = eff(c);
  const cx        = c.x + w / 2;
  const cy        = c.y + h / 2;
  const HS        = HANDLE_SZ / 2;

  const group = document.createElementNS(SVG_NS, 'g');
  group.dataset.gizmoGroup = 'true';

  // Thick selection outline
  let outline;
  if (c.shape === 'square') {
    outline = document.createElementNS(SVG_NS, 'rect');
    outline.setAttribute('x',      c.x);
    outline.setAttribute('y',      c.y);
    outline.setAttribute('width',  w);
    outline.setAttribute('height', h);
  } else {
    outline = document.createElementNS(SVG_NS, 'ellipse');
    outline.setAttribute('cx', cx);
    outline.setAttribute('cy', cy);
    outline.setAttribute('rx', w / 2);
    outline.setAttribute('ry', h / 2);
  }
  outline.setAttribute('fill',         'transparent');
  outline.setAttribute('stroke',       '#4f8ef7');
  outline.setAttribute('stroke-width', '10');
  outline.style.pointerEvents = 'none';
  if (rot !== 0) outline.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
  group.appendChild(outline);

  // Handle definitions: [id, local-x, local-y, cursor]
  // Scale handles at edge midpoints, rotate handles at corners
  const defs = [
    ['scale-n',    cx,       cy - h/2, 'ns-resize' ],
    ['scale-s',    cx,       cy + h/2, 'ns-resize' ],
    ['scale-e',    cx + w/2, cy,       'ew-resize' ],
    ['scale-w',    cx - w/2, cy,       'ew-resize' ],
    ['rotate-ne',  cx + w/2, cy - h/2, 'crosshair' ],
    ['rotate-nw',  cx - w/2, cy - h/2, 'crosshair' ],
    ['rotate-se',  cx + w/2, cy + h/2, 'crosshair' ],
    ['rotate-sw',  cx - w/2, cy + h/2, 'crosshair' ],
  ];

  defs.forEach(([id, lx, ly, cursor]) => {
    const p   = rotPt(lx, ly, cx, cy, rot);
    const hEl = document.createElementNS(SVG_NS, 'rect');
    hEl.setAttribute('x',            p.x - HS);
    hEl.setAttribute('y',            p.y - HS);
    hEl.setAttribute('width',        HANDLE_SZ);
    hEl.setAttribute('height',       HANDLE_SZ);
    hEl.setAttribute('fill',         '#4f8ef7');
    hEl.setAttribute('stroke',       '#fff');
    hEl.setAttribute('stroke-width', '1.5');
    hEl.style.cursor          = cursor;
    hEl.dataset.gizmoHandle   = id;
    hEl.dataset.maskIndex     = String(selectedIndex);
    group.appendChild(hEl);
  });

  artboard.appendChild(group);
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initPan() {
  const artboard = document.getElementById('artboard');

  // Re-draw gizmo after every generate()
  artboard.addEventListener('pattern:generated', () => drawGizmo(artboard));

  artboard.addEventListener('mousedown', e => {
    const handle = e.target.closest('[data-gizmo-handle]');
    const ref    = e.target.closest('[data-reference]');

    if (handle) {
      e.preventDefault();
      e.stopPropagation();
      const idx       = +handle.dataset.maskIndex;
      const c         = circles[idx];
      const { w, h, rot } = eff(c);
      const svgP      = clientToSvg(artboard, e);
      dragging = {
        type:     handle.dataset.gizmoHandle,
        index:    idx,
        startX:   svgP.x,
        startY:   svgP.y,
        origX:    c.x,
        origY:    c.y,
        origW:    w,
        origH:    h,
        origRot:  rot,
        cx:       c.x + w / 2,
        cy:       c.y + h / 2,
        hasMoved: false,
      };

    } else if (ref) {
      e.preventDefault();
      const idx       = +ref.dataset.maskIndex;
      selectedIndex   = idx;
      selectMask(idx);
      const c         = circles[idx];
      const { w, h, rot } = eff(c);
      const svgP      = clientToSvg(artboard, e);
      dragging = {
        type:     'move',
        index:    idx,
        startX:   svgP.x,
        startY:   svgP.y,
        origX:    c.x,
        origY:    c.y,
        origW:    w,
        origH:    h,
        origRot:  rot,
        cx: 0, cy: 0,
        hasMoved: false,
      };
      drawGizmo(artboard);

    } else {
      selectedIndex = null;
      deselectMask();
      drawGizmo(artboard);
    }
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const svgP = clientToSvg(artboard, e);
    const dx   = svgP.x - dragging.startX;
    const dy   = svgP.y - dragging.startY;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    dragging.hasMoved = true;
    const c    = circles[dragging.index];

    if (dragging.type === 'move') {
      c.x = dragging.origX + dx;
      c.y = dragging.origY + dy;
      const refEl = artboard.querySelector(`[data-reference][data-mask-index="${dragging.index}"]`);
      if (refEl) updateRefEl(refEl, c);
      drawGizmo(artboard);
      return;
    }

    if (dragging.type.startsWith('rotate')) {
      const startAngle = Math.atan2(dragging.startY - dragging.cy, dragging.startX - dragging.cx);
      const currAngle  = Math.atan2(svgP.y - dragging.cy, svgP.x - dragging.cx);
      c.rotation = dragging.origRot + (currAngle - startAngle) * 180 / Math.PI;
      c.width    = dragging.origW;
      c.height   = dragging.origH;
      c.x        = dragging.cx - dragging.origW / 2;
      c.y        = dragging.cy - dragging.origH / 2;
      const refEl = artboard.querySelector(`[data-reference][data-mask-index="${dragging.index}"]`);
      if (refEl) updateRefEl(refEl, c);
      drawGizmo(artboard);
      return;
    }

    // Scale handles — project mouse delta onto local axes
    const rad  = dragging.origRot * Math.PI / 180;
    const cosR = Math.cos(rad), sinR = Math.sin(rad);
    const localDx =  dx * cosR + dy * sinR;   // along local right
    const localDy = -dx * sinR + dy * cosR;   // along local down

    let newW = dragging.origW;
    let newH = dragging.origH;

    switch (dragging.type) {
      case 'scale-e': newW = Math.max(1, dragging.origW + 2 * localDx);  break;
      case 'scale-w': newW = Math.max(1, dragging.origW - 2 * localDx);  break;
      case 'scale-s': newH = Math.max(1, dragging.origH + 2 * localDy);  break;
      case 'scale-n': newH = Math.max(1, dragging.origH - 2 * localDy);  break;
    }
    if (e.shiftKey) {
      const u = (dragging.type === 'scale-n' || dragging.type === 'scale-s') ? newH : newW;
      newW = u; newH = u;
    }

    c.width    = newW;
    c.height   = newH;
    c.rotation = dragging.origRot;
    c.x        = dragging.cx - newW / 2;
    c.y        = dragging.cy - newH / 2;

    const refEl = artboard.querySelector(`[data-reference][data-mask-index="${dragging.index}"]`);
    if (refEl) updateRefEl(refEl, c);
    drawGizmo(artboard);
  });

  window.addEventListener('mouseup', e => {
    if (!dragging) return;

    if (dragging.hasMoved) {
      if (e.altKey && dragging.type === 'move') {
        // Alt+drag: keep original in place, add duplicate at new position
        const duplicate = JSON.parse(JSON.stringify(circles[dragging.index]));
        circles[dragging.index].x = dragging.origX;
        circles[dragging.index].y = dragging.origY;
        circles.push(duplicate);
        selectedIndex = circles.length - 1;
      }
      saveCircles();
      generate();        // dispatches pattern:generated → drawGizmo
      renderCircleList();
    }

    dragging = null;
  });
}
