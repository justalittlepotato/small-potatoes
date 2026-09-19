// The maths of ink, with no canvas and no DOM, so it can be tested in node.
//
// A stroke is an array of points, each `[x, y, pressure]` in css pixels
// relative to the top-left of its card. Pressure is 0..1.

// Points closer than this to the previous kept point are dropped. A pencil
// reports at up to 240Hz; without thinning a paragraph is a megabyte.
export const MIN_GAP = 1.5;

// Line width, css pixels. A narrow range: a gel pen, with a little pressure
// in it but never fat. These two numbers are the whole feel of the pen.
export const WIDTH_MIN = 1.3;
export const WIDTH_MAX = 2.8;

// A finger or a mouse has no real pressure, so it writes at a steady middle.
export const FLAT_PRESSURE = 0.5;

// How fast the width follows the pressure. Raw pencil pressure jitters from
// one sample to the next; run through this it glides.
export const PRESSURE_ALPHA = 0.3;

// How close, in css pixels, the rubber has to pass to a stroke to take it.
export const ERASE_RADIUS = 12;

export function widthFor(pressure) {
  const p = Math.min(1, Math.max(0, Number(pressure) || 0));
  return WIDTH_MIN + (WIDTH_MAX - WIDTH_MIN) * p;
}

// Exponential moving average of pressure. The first point of a stroke has no
// previous value and is taken as it comes.
export function smoothPressure(previous, raw, alpha = PRESSURE_ALPHA) {
  const r = Math.min(1, Math.max(0, Number(raw) || 0));
  if (previous === null || previous === undefined) return r;
  return previous + alpha * (r - previous);
}

// ---------- curves ----------
//
// A stroke is drawn as quadratic curves through the midpoints of consecutive
// samples, each sample being the control point of the curve that passes it.
// Straight segments between samples show every corner at writing speed;
// this does not. A piece is [from, control, to, width], and a stroke of n
// points (n >= 2) is n pieces: a straight stub from the first point to the
// first midpoint, a curve for each interior point, and a stub from the last
// midpoint to the last point.

function mid(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function piece(from, control, to, pressure) {
  return [[from[0], from[1]], [control[0], control[1]], [to[0], to[1]], widthFor(pressure)];
}

// The piece at index i of the path for a stroke, computed on its own so the
// live pen can draw one piece per sample without rebuilding the path.
export function pieceAt(stroke, i) {
  const n = stroke.length;
  if (n < 2 || i < 0 || i >= n) return null;
  if (i === 0) return piece(stroke[0], stroke[0], mid(stroke[0], stroke[1]), stroke[0][2]);
  if (i === n - 1) return piece(mid(stroke[n - 2], stroke[n - 1]), stroke[n - 1], stroke[n - 1], stroke[n - 1][2]);
  return piece(mid(stroke[i - 1], stroke[i]), stroke[i], mid(stroke[i], stroke[i + 1]), stroke[i][2]);
}

export function curvePath(stroke) {
  const out = [];
  for (let i = 0; i < stroke.length; i += 1) {
    const p = pieceAt(stroke, i);
    if (p) out.push(p);
  }
  return out;
}

// The piece that became final when the last point was appended: with n
// points, piece n-2 (the curve through the point before the new one; for
// n = 2, the opening stub). The closing stub, piece n-1, is only final once
// the pen lifts.
export function newestPiece(stroke) {
  return pieceAt(stroke, stroke.length - 2);
}

// Whether a new point is far enough from the last kept one to be worth keeping.
export function farEnough(last, next) {
  if (!last) return true;
  const dx = next[0] - last[0];
  const dy = next[1] - last[1];
  return dx * dx + dy * dy >= MIN_GAP * MIN_GAP;
}

// Thin a whole stroke. The first and last points always survive, so a stroke
// ends where the pen lifted rather than where the last kept point happened
// to fall.
export function thin(stroke) {
  if (stroke.length < 3) return stroke.slice();
  const out = [stroke[0]];
  for (let i = 1; i < stroke.length - 1; i += 1) {
    if (farEnough(out[out.length - 1], stroke[i])) out.push(stroke[i]);
  }
  out.push(stroke[stroke.length - 1]);
  return out;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Whether a point is within `radius` of any segment of a stroke. A single
// point stroke (a dot) is tested as a segment of zero length.
export function hitStroke(stroke, x, y, radius = ERASE_RADIUS) {
  if (stroke.length === 0) return false;
  if (stroke.length === 1) return Math.hypot(x - stroke[0][0], y - stroke[0][1]) <= radius;
  for (let i = 1; i < stroke.length; i += 1) {
    const [ax, ay] = stroke[i - 1];
    const [bx, by] = stroke[i];
    if (distanceToSegment(x, y, ax, ay, bx, by) <= radius) return true;
  }
  return false;
}

// Every stroke not within reach of the point. What the rubber leaves behind.
export function eraseAt(strokes, x, y, radius = ERASE_RADIUS) {
  return strokes.filter((s) => !hitStroke(s, x, y, radius));
}

// Scale x and y by a factor, leaving pressure alone. Used when a card is
// loaded at a different width from the one it was written at, so the ink
// keeps its shape rather than its pixel positions.
export function scaleStrokes(strokes, factor) {
  if (factor === 1) return strokes;
  return strokes.map((s) => s.map(([x, y, p]) => [x * factor, y * factor, p]));
}

// The lowest point of the ink, in css pixels. Zero for a blank card.
export function bottomOf(strokes) {
  let bottom = 0;
  for (const s of strokes) for (const [, y] of s) if (y > bottom) bottom = y;
  return bottom;
}

// How many ruled lines a card needs to show all of its ink with a line to
// spare beneath, never fewer than it has.
export function linesNeeded(strokes, lineHeight, current) {
  const needed = Math.ceil(bottomOf(strokes) / lineHeight) + 1;
  return Math.max(current, needed);
}
