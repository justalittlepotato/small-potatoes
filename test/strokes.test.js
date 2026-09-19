import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  thin, farEnough, widthFor, hitStroke, eraseAt, scaleStrokes, bottomOf,
  linesNeeded, smoothPressure, smoothPoint, curvePath, pieceAt, newestPiece, strokeWidth,
  WIDTH_MIN, WIDTH_MAX, MIN_GAP,
} from '../js/strokes.js';

test('position smoothing takes the wobble out of grid-snapped samples', () => {
  // A straight diagonal, as safari reports it: whole pixels, so it steps.
  const raw = [];
  for (let i = 0; i < 40; i += 1) raw.push([Math.round(i * 0.7), Math.round(i * 0.3), 0.5]);
  let prev = null;
  const smoothed = raw.map((p) => (prev = smoothPoint(prev, p)));
  // Distance of each point from the ideal line y = 3x/7: the smoothed
  // points wander less than the snapped ones do.
  const wobble = (pts) => pts.slice(5).reduce((s, [x, y]) => s + Math.abs(y - x * 3 / 7), 0) / (pts.length - 5);
  assert.ok(wobble(smoothed) < wobble(raw) * 0.75, `raw ${wobble(raw).toFixed(3)} smoothed ${wobble(smoothed).toFixed(3)}`);
  // It follows: the last smoothed point is within a sample of the last raw one.
  const [lx, ly] = smoothed[smoothed.length - 1];
  const [rx, ry] = raw[raw.length - 1];
  assert.ok(Math.hypot(lx - rx, ly - ry) < 1.5);
  // Pressure passes straight through, and the first point is taken as is.
  assert.deepEqual(smoothPoint(null, [3, 4, 0.9]), [3, 4, 0.9]);
  assert.equal(smoothPoint([0, 0, 0.1], [10, 10, 0.7])[2], 0.7);
});

test('a whole stroke has one width, from its mean pressure', () => {
  assert.equal(strokeWidth([[0, 0, 0], [1, 1, 1]]), widthFor(0.5));
  assert.equal(strokeWidth([[0, 0, 1]]), WIDTH_MAX);
  assert.equal(strokeWidth([]), WIDTH_MIN);
  assert.ok(!Number.isNaN(strokeWidth([[0, 0, undefined]])));
});

test('the pen is fine: nothing wider than a gel pen', () => {
  assert.ok(WIDTH_MAX <= 3, `${WIDTH_MAX}px is a marker`);
  assert.ok(WIDTH_MIN >= 1, `${WIDTH_MIN}px would vanish on the ipad`);
});

test('pressure smoothing glides toward the raw value and stays in range', () => {
  assert.equal(smoothPressure(null, 0.8), 0.8);          // first point, as it comes
  const step = smoothPressure(0.2, 1);
  assert.ok(step > 0.2 && step < 1, `${step}`);
  let p = 0.2;
  for (let i = 0; i < 40; i += 1) p = smoothPressure(p, 1);
  assert.ok(p > 0.99, `did not converge: ${p}`);
  assert.ok(smoothPressure(0.5, 7) <= 1 && smoothPressure(0.5, -3) >= 0);
  assert.equal(smoothPressure(0.4, undefined) <= 0.4, true);   // rubbish reads as zero, never NaN
});

test('a curve path has one piece per point, joined end to end, first to last', () => {
  const s = [[0, 0, 0.5], [10, 5, 0.6], [20, 0, 0.7], [30, 5, 0.8]];
  const path = curvePath(s);
  assert.equal(path.length, s.length);
  assert.deepEqual(path[0][0], [0, 0]);                 // starts at the first point
  assert.deepEqual(path[path.length - 1][2], [30, 5]);  // ends at the last
  for (let i = 1; i < path.length; i += 1) {
    assert.deepEqual(path[i][0], path[i - 1][2]);        // each piece starts where the last ended
  }
  assert.deepEqual(path[1][1], [10, 5]);                 // the sample is the control point
  for (const [, , , w] of path) assert.ok(w >= WIDTH_MIN && w <= WIDTH_MAX);
});

test('a dot has no path and two points make two straight stubs', () => {
  assert.deepEqual(curvePath([[1, 1, 0.5]]), []);
  assert.deepEqual(curvePath([]), []);
  const two = curvePath([[0, 0, 0.5], [10, 0, 0.5]]);
  assert.equal(two.length, 2);
  assert.deepEqual(two[0][2], [5, 0]);
  assert.deepEqual(two[1][0], [5, 0]);
});

test('the live pen can draw the path one piece at a time', () => {
  const s = [[0, 0, 0.5], [10, 5, 0.6], [20, 0, 0.7], [30, 5, 0.8], [40, 0, 0.9]];
  const drawn = [];
  for (let n = 2; n <= s.length; n += 1) drawn.push(newestPiece(s.slice(0, n)));
  drawn.push(pieceAt(s, s.length - 1));                  // the closing stub, on lift
  assert.deepEqual(drawn, curvePath(s));
  assert.equal(newestPiece([[0, 0, 0.5]]), null);
});

test('width follows pressure inside a narrow pen-like range', () => {
  assert.equal(widthFor(0), WIDTH_MIN);
  assert.equal(widthFor(1), WIDTH_MAX);
  assert.ok(widthFor(0.5) > widthFor(0.2));
  // Out of range and rubbish inputs are clamped, never NaN.
  assert.equal(widthFor(7), WIDTH_MAX);
  assert.equal(widthFor(-1), WIDTH_MIN);
  assert.equal(widthFor(undefined), WIDTH_MIN);
  assert.ok(WIDTH_MAX / WIDTH_MIN < 2.5, 'range is too wide to read as a pen');
  assert.ok(WIDTH_MAX / WIDTH_MIN > 1.5, 'range is too narrow to feel the pressure');
});

test('thinning drops points closer than the gap but keeps both ends', () => {
  const dense = [];
  for (let i = 0; i <= 100; i += 1) dense.push([i * 0.5, 0, 0.5]);   // 101 points, 0.5px apart
  const out = thin(dense);
  assert.deepEqual(out[0], [0, 0, 0.5]);
  assert.deepEqual(out[out.length - 1], [50, 0, 0.5]);
  assert.ok(out.length < dense.length / 2, `kept ${out.length} of ${dense.length}`);
  for (let i = 1; i < out.length - 1; i += 1) {
    assert.ok(farEnough(out[i - 1], out[i]));
  }
});

test('thinning leaves a dot and a two-point stroke alone', () => {
  assert.deepEqual(thin([[1, 1, 0.5]]), [[1, 1, 0.5]]);
  assert.deepEqual(thin([[1, 1, 0.5], [1.2, 1, 0.5]]), [[1, 1, 0.5], [1.2, 1, 0.5]]);
});

test('farEnough is exactly the gap, and anything counts against nothing', () => {
  assert.equal(farEnough(null, [0, 0, 1]), true);
  assert.equal(farEnough([0, 0, 1], [MIN_GAP, 0, 1]), true);
  assert.equal(farEnough([0, 0, 1], [MIN_GAP - 0.01, 0, 1]), false);
});

test('a hit is measured to the segment, not to the sampled points', () => {
  const stroke = [[0, 0, 0.5], [100, 0, 0.5]];
  assert.equal(hitStroke(stroke, 50, 5, 12), true);     // mid-segment, no point nearby
  assert.equal(hitStroke(stroke, 50, 20, 12), false);
  assert.equal(hitStroke(stroke, 130, 0, 12), false);   // past the end, not on the line's extension
  assert.equal(hitStroke([[10, 10, 0.5]], 15, 10, 12), true);   // a dot
  assert.equal(hitStroke([], 0, 0, 12), false);
});

test('the rubber takes whole strokes and leaves the rest', () => {
  const a = [[0, 0, 0.5], [100, 0, 0.5]];
  const b = [[0, 50, 0.5], [100, 50, 0.5]];
  const left = eraseAt([a, b], 50, 48, 12);
  assert.deepEqual(left, [a]);
});

test('scaling moves x and y and leaves pressure alone', () => {
  const s = [[[10, 20, 0.3], [30, 40, 0.9]]];
  assert.deepEqual(scaleStrokes(s, 2), [[[20, 40, 0.3], [60, 80, 0.9]]]);
  assert.equal(scaleStrokes(s, 1), s);
});

test('lines needed grows with the ink and never shrinks a card', () => {
  assert.equal(bottomOf([]), 0);
  assert.equal(linesNeeded([], 40, 4), 4);
  const low = [[[0, 150, 0.5]]];   // just inside the fourth 40px line
  assert.equal(linesNeeded(low, 40, 4), 5);   // one line to spare beneath
  const deep = [[[0, 330, 0.5]]];
  assert.equal(linesNeeded(deep, 40, 4), 10);
  assert.equal(linesNeeded(low, 40, 8), 8);
});
