let _tip = null;
let _timer = null;

export function showMaxTooltip(el) {
  if (!_tip) {
    _tip = document.createElement('div');
    _tip.className = 'max-pct-tooltip';
    document.body.appendChild(_tip);
  }
  _tip.textContent = 'Max % used';

  const rect = el.getBoundingClientRect();
  _tip.style.left = (rect.left + rect.width / 2) + 'px';
  _tip.style.top  = rect.top + 'px';
  _tip.classList.add('visible');

  clearTimeout(_timer);
  _timer = setTimeout(() => _tip.classList.remove('visible'), 1400);
}

// Convert any CSS color to #rrggbb hex. Returns null for 'none'/'transparent'/etc.
export function toHex(color) {
  if (!color) return null;
  const lc = color.trim().toLowerCase();
  if (['none', 'transparent', 'currentcolor', 'inherit', ''].includes(lc)) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = lc;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Shape elements that carry SVG fills
const SVG_SHAPES = 'path,circle,ellipse,rect,polygon,polyline,line,text,use';

// Parse SVG inner HTML, extract unique fill colors, replace with CSS custom props.
// If no fills are detected (e.g. all paths inherit default black), injects --c0
// onto fill-less shape elements so color stays controllable.
// Returns { colors: ['#hex', ...], symbolContent: '...with var(--c0,#hex)...' }
export function extractAndReplaceColors(svgContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`,
    'image/svg+xml'
  );

  const hexToIdx = new Map();
  const colors   = [];

  function register(c) {
    const h = toHex(c);
    if (h && !hexToIdx.has(h)) { hexToIdx.set(h, colors.length); colors.push(h); }
  }

  doc.querySelectorAll('*').forEach(el => {
    const f = el.getAttribute('fill');
    if (f) register(f);
    const sf = el.style?.fill;
    if (sf) register(sf);
  });

  if (colors.length === 0) {
    // No explicit fills found — SVG relies on inherited black (SVG default).
    // Inject var(--c0, #000000) onto all fill-less shape elements so color
    // can be driven by CSS custom property without a full re-render.
    colors.push('#000000');
    hexToIdx.set('#000000', 0);
    doc.querySelectorAll(SVG_SHAPES).forEach(el => {
      if (!el.getAttribute('fill') && !el.style?.fill) {
        el.setAttribute('fill', 'var(--c0, #000000)');
      }
    });
  } else {
    // Replace explicit fills with CSS vars
    doc.querySelectorAll('*').forEach(el => {
      const f = el.getAttribute('fill');
      if (f) {
        const h = toHex(f);
        if (h && hexToIdx.has(h)) el.setAttribute('fill', `var(--c${hexToIdx.get(h)}, ${h})`);
      }
      if (el.style?.fill) {
        const h = toHex(el.style.fill);
        if (h && hexToIdx.has(h)) el.style.fill = `var(--c${hexToIdx.get(h)}, ${h})`;
      }
    });
  }

  return { colors, symbolContent: doc.querySelector('svg').innerHTML };
}
