import { circles, saveCircles, defaultZones, makeEqualDist } from './state.js';
import { generate } from './generate.js';

// ── Confirm dialog ────────────────────────────────────────────────────────────
let pendingDelete = null;

export function askConfirm(onYes) {
  pendingDelete = onYes;
  document.getElementById('confirm-overlay').classList.add('visible');
}

export function initConfirm() {
  const overlay = document.getElementById('confirm-overlay');

  document.getElementById('confirm-yes').addEventListener('click', () => {
    if (pendingDelete) { pendingDelete(); pendingDelete = null; }
    overlay.classList.remove('visible');
  });

  document.getElementById('confirm-no').addEventListener('click', () => {
    pendingDelete = null;
    overlay.classList.remove('visible');
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { pendingDelete = null; overlay.classList.remove('visible'); }
  });
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
      askConfirm(() => { circles.splice(i, 1); saveCircles(); renderCircleList(); generate(); });
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
      const mw = circles[i].width  ?? circles[i].size;
      const mh = circles[i].height ?? circles[i].size;
      circles[i].x = (1000 - mw) / 2;
      circles[i].y = (1000 - mh) / 2;
      saveCircles(); renderCircleList(); generate();
    });

    xyRow.appendChild(xLbl); xyRow.appendChild(yLbl); xyRow.appendChild(centerBtn);

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
    wLbl.appendChild(wIn);
    const hLbl = document.createElement('label'); hLbl.textContent = 'H ';
    const hIn  = makeNumInput(c.height ?? c.size, { min: 1 });
    hIn.addEventListener('input', () => {
      if (circles[i].width == null) circles[i].width = circles[i].size;
      circles[i].height = +hIn.value || 1;
      saveCircles(); generate();
    });
    hLbl.appendChild(hIn);
    whRow.appendChild(wLbl); whRow.appendChild(hLbl);

    // Rotation
    const rotLbl = document.createElement('label');
    rotLbl.className = 'full-label'; rotLbl.textContent = 'Rotate° ';
    const rotIn = makeNumInput(c.rotation ?? 0);
    rotIn.addEventListener('input', () => { circles[i].rotation = +rotIn.value; saveCircles(); generate(); });
    rotLbl.appendChild(rotIn);

    // Zone cards
    const zoneWrap = document.createElement('div');
    zoneWrap.className = 'zone-wrap';

    c.zones.forEach((z, zi) => {
      const card = document.createElement('div');
      card.className = 'zone-card';

      const zlbl = document.createElement('div');
      zlbl.className = 'zone-card-label';
      zlbl.textContent = z.label;
      card.appendChild(zlbl);

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

      const distWrap   = document.createElement('div');
      distWrap.className = 'zone-dist-wrap';

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
    entry.appendChild(whRow);
    entry.appendChild(rotLbl);
    entry.appendChild(collapsible);
    list.appendChild(entry);
  });
}

export function initMasks() {
  initConfirm();

  document.getElementById('btn-add-circle').addEventListener('click', () => {
    const sz = 300;
    circles.push({ x: 350, y: 350, size: sz, width: sz, height: sz, rotation: 0, shape: 'circle', zones: defaultZones() });
    saveCircles(); renderCircleList(); generate();
  });
}
