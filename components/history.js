import { circles, pct, saveCircles, savePct } from './state.js';

const MAX = 50;
const stack = [];
let cursor = -1;

function capture() {
  return JSON.stringify({ circles: JSON.parse(JSON.stringify(circles)), pct: { ...pct } });
}

function restore(snap) {
  const s = JSON.parse(snap);
  circles.length = 0;
  s.circles.forEach(c => circles.push(c));
  Object.keys(pct).forEach(k => delete pct[k]);
  Object.assign(pct, s.pct);
  saveCircles();
  savePct();
}

export function push() {
  stack.splice(cursor + 1);
  stack.push(capture());
  if (stack.length > MAX) stack.shift();
  else cursor++;
}

export function undo(onRestore) {
  if (cursor <= 0) return false;
  cursor--;
  restore(stack[cursor]);
  onRestore();
  return true;
}

export function redo(onRestore) {
  if (cursor >= stack.length - 1) return false;
  cursor++;
  restore(stack[cursor]);
  onRestore();
  return true;
}

// Call once at startup to capture the initial state
export function init() {
  stack.length = 0;
  stack.push(capture());
  cursor = 0;
}
