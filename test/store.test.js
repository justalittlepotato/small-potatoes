// IndexedDB does not exist in node, so what is tested here is the rule the
// purge applies, kept as a pure function for exactly this reason.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isStale, staleKeys } from '../js/store.js';

const page = (day, prompt) => ({ day, prompt, strokes: [], width: 700, lines: 4 });

test('today is kept and every other day goes, older or newer', () => {
  const records = [
    page('2031-09-18', 'good-1'),
    page('2031-09-19', 'good-1'),
    page('2031-09-19', 'morning-body'),
    page('2031-09-20', 'good-2'),     // a clock set forward and back again
    page('2035-01-01', 'rotating'),
  ];
  assert.deepEqual(staleKeys(records, '2031-09-19'), [
    ['2031-09-18', 'good-1'],
    ['2031-09-20', 'good-2'],
    ['2035-01-01', 'rotating'],
  ]);
});

test('an empty store has nothing to purge', () => {
  assert.deepEqual(staleKeys([], '2031-09-19'), []);
});

test('staleness is the day and nothing else', () => {
  assert.equal(isStale(page('2031-09-19', 'leave'), '2031-09-19'), false);
  assert.equal(isStale(page('2031-09-19', 'leave'), '2031-09-20'), true);
});
