// One handwriting canvas. Owns the pointer events, the stroke list, undo and
// the rubber; knows nothing about prompts, days or storage.
//
// The pencil draws. A finger scrolls, by hand: the canvas has
// `touch-action: none`, because anything looser lets iOS treat a pencil drag
// as a scroll and cancel the stroke mid-word. So a finger on the canvas is
// caught and turned into a scroll here, unless `canDraw` says it may draw.
//
// Strokes are kept in css pixels relative to the canvas, so the bitmap can
// be thrown away and rebuilt at any size or pixel ratio.

import {
  thin, farEnough, widthFor, eraseAt, scaleStrokes, bottomOf, FLAT_PRESSURE,
  smoothPressure, curvePath, newestPiece, pieceAt,
} from './strokes.js';

const HISTORY_MAX = 40;

export function createInk(canvas, options = {}) {
  const {
    onChange = () => {},
    canDraw = (event) => event.pointerType === 'pen',
    readOnly = false,
  } = options;

  const ctx = canvas.getContext('2d');

  let strokes = [];        // committed
  let live = null;         // the stroke under the pen right now
  let history = [];        // previous stroke lists, for undo
  let mode = 'draw';       // or 'erase'
  let width = 0;           // css pixels the strokes are currently laid out for
  let height = 0;
  let dpr = 1;
  let ink = '#000';
  let active = null;       // { id, kind: 'draw' | 'erase' | 'scroll', lastY }
  let erased = false;      // whether the current erase gesture took anything

  function readInk() {
    ink = getComputedStyle(canvas).color;
  }

  // ---------- drawing ----------

  // One piece of a stroke: a quadratic curve, stroked on its own so the
  // width can change along the stroke. Round caps hide the seams.
  function drawPiece(p) {
    if (!p) return;
    const [from, control, to, width] = p;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.quadraticCurveTo(control[0], control[1], to[0], to[1]);
    ctx.stroke();
  }

  function dot(p) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p[0], p[1], widthFor(p[2]) / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStroke(stroke) {
    if (stroke.length === 1) { dot(stroke[0]); return; }
    for (const p of curvePath(stroke)) drawPiece(p);
  }

  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const s of strokes) drawStroke(s);
    if (live) drawStroke(live);
  }

  // Size the bitmap to the element. If the element's width changed since the
  // strokes were laid out, the ink is scaled to keep its shape.
  function fit() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w === 0 || h === 0) return;
    if (width > 0 && w !== width && strokes.length) {
      strokes = scaleStrokes(strokes, w / width);
    }
    width = w;
    height = h;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    readInk();
    redraw();
  }

  // ---------- pointer handling ----------

  // A point from an event. `previous` is the last kept pressure, so the width
  // follows the pen smoothly rather than jumping with every sample.
  function pointOf(event, previous = null) {
    const rect = canvas.getBoundingClientRect();
    const raw = event.pointerType === 'pen'
      ? Math.max(0.05, Math.min(1, event.pressure || 0))
      : FLAT_PRESSURE;
    return [event.clientX - rect.left, event.clientY - rect.top, smoothPressure(previous, raw)];
  }

  function remember() {
    history.push(strokes);
    if (history.length > HISTORY_MAX) history.shift();
  }

  function samples(event) {
    // Safari batches fast pen movement between frames; the coalesced list has
    // the points in between, when it is there and not empty.
    if (typeof event.getCoalescedEvents === 'function') {
      const list = event.getCoalescedEvents();
      if (list && list.length) return list;
    }
    return [event];
  }

  function capture(event) {
    // Keeps the stroke coming even when the pen wanders off the card. A
    // synthetic event has no real pointer to capture and throws; that is
    // fine, the stroke still works, it just stops at the edge.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // nothing to do
    }
  }

  function onDown(event) {
    if (readOnly || active) return;
    if (!event.isPrimary) return;

    if (!canDraw(event)) {
      // A finger, and fingers scroll. Only a touch is caught; a mouse is
      // left alone so a desktop page still scrolls with the wheel.
      if (event.pointerType !== 'touch') return;
      active = { id: event.pointerId, kind: 'scroll', lastY: event.clientY };
      capture(event);
      return;
    }

    event.preventDefault();
    capture(event);
    const p = pointOf(event);

    if (mode === 'erase') {
      active = { id: event.pointerId, kind: 'erase' };
      erased = false;
      rubAt(p);
      return;
    }

    active = { id: event.pointerId, kind: 'draw' };
    live = [p];
    dot(p);
  }

  function rubAt(p) {
    const before = strokes.length;
    const after = eraseAt(strokes, p[0], p[1]);
    if (after.length === before) return;
    if (!erased) { remember(); erased = true; }
    strokes = after;
    redraw();
  }

  function onMove(event) {
    if (!active || event.pointerId !== active.id) return;

    if (active.kind === 'scroll') {
      const dy = active.lastY - event.clientY;
      active.lastY = event.clientY;
      if (dy !== 0) window.scrollBy(0, dy);
      return;
    }

    event.preventDefault();
    for (const sample of samples(event)) {
      if (active.kind === 'erase') { rubAt(pointOf(sample)); continue; }
      const last = live[live.length - 1];
      const p = pointOf(sample, last[2]);
      if (!farEnough(last, p)) continue;
      live.push(p);
      // The curve through the previous point is now known; draw it. The
      // stub to the pen's current position waits until the pen lifts, so
      // the visible line trails the tip by half a sample. Nobody notices.
      drawPiece(newestPiece(live));
    }
  }

  function onUp(event) {
    if (!active || event.pointerId !== active.id) return;
    const { kind } = active;
    active = null;

    if (kind === 'scroll') return;

    if (kind === 'erase') {
      if (erased) onChange();
      return;
    }

    if (live) {
      // The last sample may have been skipped as too close; the lift point
      // is where the stroke really ends.
      const last = live[live.length - 1];
      const end = pointOf(event, last[2]);
      if (farEnough(last, end)) live.push(end);
      remember();
      strokes = [...strokes, thin(live)];
      live = null;
      // A full redraw rather than just the closing stub: the thinned stroke
      // is what will be drawn from now on, so show exactly that.
      redraw();
      onChange();
    }
  }

  if (!readOnly) {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    // Nothing on the page should try to select or copy a canvas.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Re-read the ink colour when the theme flips under us.
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => { readInk(); redraw(); };
  scheme.addEventListener('change', onScheme);

  const observer = new ResizeObserver(() => fit());
  observer.observe(canvas);

  // ---------- the api ----------

  return {
    // Replace the ink with a saved page. `width` is what the strokes were
    // laid out for; the next fit scales them to the canvas as it is now.
    load(page) {
      strokes = page && page.strokes ? page.strokes : [];
      width = page && page.width ? page.width : width;
      history = [];
      live = null;
      fit();
    },
    snapshot() {
      return { strokes, width };
    },
    isBlank() {
      return strokes.length === 0;
    },
    bottom() {
      return bottomOf(strokes);
    },
    undo() {
      if (history.length === 0) return;
      strokes = history.pop();
      redraw();
      onChange();
    },
    canUndo() {
      return history.length > 0;
    },
    clear() {
      if (strokes.length === 0) return;
      remember();
      strokes = [];
      redraw();
      onChange();
    },
    // Wipe without telling anyone and without a way back. For the card
    // whose ink is meant to go.
    forget() {
      strokes = [];
      history = [];
      live = null;
      redraw();
    },
    setMode(next) {
      mode = next === 'erase' ? 'erase' : 'draw';
    },
    mode() {
      return mode;
    },
    fit,
    destroy() {
      observer.disconnect();
      scheme.removeEventListener('change', onScheme);
    },
  };
}
