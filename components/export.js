import { NS, pct, circles, elementShape, saveColors, loadColors } from './state.js';
import { defaultZones } from './state.js';
import { generate } from './generate.js';
import { sliderEls, numEls, updateTotal } from './sliders.js';
import { renderCircleList } from './masks.js';

export function buildExportSVGString({ withBackground = false } = {}) {
  const artboard = document.getElementById('artboard');
  const clone    = artboard.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('style');
  clone.querySelectorAll('[data-reference], [data-gizmo-group]').forEach(el => el.remove());

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

export function buildSettingsSnapshot() {
  return {
    pct,
    circles,
    elementShape,
    rectColor: document.getElementById('rect-color').value,
    bgColor:   document.getElementById('bg-color').value,
  };
}

import { SIZES } from './state.js';
import { saveCircles } from './state.js';
import { setElementShape } from './state.js';
import { savePct } from './state.js';

export function applySettingsSnapshot(s) {
  if (s.rectColor) document.getElementById('rect-color').value = s.rectColor;
  if (s.bgColor)   document.getElementById('bg-color').value   = s.bgColor;
  if (s.rectColor && s.bgColor) saveColors(s.rectColor, s.bgColor);

  if (s.pct) {
    SIZES.forEach(size => {
      const v = s.pct[size] ?? 0;
      pct[size] = v;
      sliderEls[size].value = v;
      numEls[size].value    = v;
    });
    updateTotal(); savePct();
  }

  if (s.elementShape) {
    setElementShape(s.elementShape);
    document.querySelectorAll('.shape-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.shape === s.elementShape)
    );
  }

  if (Array.isArray(s.circles)) {
    circles.length = 0;
    s.circles.forEach(c => {
      if (!c.zones) c.zones = defaultZones();
      c.zones = c.zones.map((z, i) => z.dist ? z : defaultZones()[i]);
      if (!c.shape) c.shape = 'circle';
      circles.push(c);
    });
    saveCircles(); renderCircleList();
  }

  generate();
}

export function initExport() {
  // SVG + JSON
  document.getElementById('btn-download-svg').addEventListener('click', () => {
    const stamp   = Date.now();
    const svgStr  = buildExportSVGString();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
    const svgUrl  = URL.createObjectURL(svgBlob);
    triggerDownload(svgUrl, `pattern-${stamp}.svg`);
    URL.revokeObjectURL(svgUrl);

    const json     = JSON.stringify(buildSettingsSnapshot(), null, 2);
    const jsonBlob = new Blob([json], { type: 'application/json' });
    const jsonUrl  = URL.createObjectURL(jsonBlob);
    triggerDownload(jsonUrl, `pattern-${stamp}.json`);
    URL.revokeObjectURL(jsonUrl);
  });

  // PNG (transparent)
  document.getElementById('btn-download-png').addEventListener('click', () => {
    exportToCanvas(canvas => {
      triggerDownload(canvas.toDataURL('image/png'), `pattern-${Date.now()}.png`);
    }, false);
  });

  // JPG (with background)
  document.getElementById('btn-download-jpg').addEventListener('click', () => {
    exportToCanvas(canvas => {
      triggerDownload(canvas.toDataURL('image/jpeg', 0.95), `pattern-${Date.now()}.jpg`);
    }, true);
  });

  // JSON import
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { applySettingsSnapshot(JSON.parse(ev.target.result)); }
      catch (_) { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}
