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
