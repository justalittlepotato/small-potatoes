import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  thin, farEnough, widthFor, hitStroke, eraseAt, scaleStrokes, bottomOf,
  linesNeeded, WIDTH_MIN, WIDTH_MAX, MIN_GAP,
} from '../js/strokes.js';

test('width follows pressure inside a narrow pen-like range', () => {
  assert.equal(widthFor(0), WIDTH_MIN);
  assert.equal(widthFor(1), WIDTH_MAX);
  assert.ok(widthFor(0.5) > widthFor(0.2));
  // Out of range and rubbish inputs are clamped, never NaN.
  assert.equal(widthFor(7), WIDTH_MAX);
  assert.equal(widthFor(-1), WIDTH_MIN);
  assert.equal(widthFor(undefined), WIDTH_MIN);
  assert.ok(WIDTH_MAX / WIDTH_MIN < 2.5, 'range is too wide to read as a pen');
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
