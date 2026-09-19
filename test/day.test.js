// The day boundary and the tab the clock suggests. Fixed instants, never
// relative to now, so this does not start failing on its own one day.
// Fixture dates are in 2031, which is nobody's real calendar.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayKey, suggestedTab, dayLabel } from '../js/day.js';

const at = (h, m) => new Date(2031, 8, 19, h, m);   // 19 september 2031, local

test('a day ends at 4am, not midnight', () => {
  assert.equal(dayKey(at(3, 59)), '2031-09-18');
  assert.equal(dayKey(at(4, 0)), '2031-09-19');
  assert.equal(dayKey(at(4, 1)), '2031-09-19');
  assert.equal(dayKey(at(23, 59)), '2031-09-19');
  assert.equal(dayKey(at(0, 30)), '2031-09-18');
});

test('the boundary crosses months and years correctly', () => {
  assert.equal(dayKey(new Date(2032, 0, 1, 2, 0)), '2031-12-31');
  assert.equal(dayKey(new Date(2031, 2, 1, 1, 0)), '2031-02-28');
});

test('morning until 2pm, evening after, and the small hours are evening', () => {
  assert.equal(suggestedTab(at(4, 0)), 'morning');
  assert.equal(suggestedTab(at(9, 30)), 'morning');
  assert.equal(suggestedTab(at(13, 59)), 'morning');
  assert.equal(suggestedTab(at(14, 0)), 'evening');
  assert.equal(suggestedTab(at(22, 0)), 'evening');
  assert.equal(suggestedTab(at(1, 0)), 'evening');
  assert.equal(suggestedTab(at(3, 59)), 'evening');
});

test('the label is the weekday, day and month, lowercase, no year', () => {
  assert.equal(dayLabel('2031-09-19'), 'friday 19 september');
  assert.equal(dayLabel('2031-01-01'), 'wednesday 1 january');
});
