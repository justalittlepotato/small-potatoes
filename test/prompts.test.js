import { test } from 'node:test';
import assert from 'node:assert/strict';

import { morningPrompts, eveningPrompts, rotating, POOL, LEAVE } from '../js/prompts.js';
import { morningQuip, eveningQuip, openedQuip, schluffQuip, pick } from '../js/quips.js';

test('the morning is two cards and the evening is five', () => {
  assert.equal(morningPrompts().length, 2);
  assert.equal(eveningPrompts('2031-09-19').length, 5);
});

test('every prompt id on a tab is distinct, because ids are storage keys', () => {
  for (const list of [morningPrompts(), eveningPrompts('2031-09-19')]) {
    const ids = list.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('only the leave-it card is ephemeral, and it comes last', () => {
  const evening = eveningPrompts('2031-09-19');
  assert.deepEqual(evening.filter((p) => p.ephemeral), [LEAVE]);
  assert.equal(evening[evening.length - 1].id, 'leave');
});

test('the rotating prompt holds for a day and comes from the pool', () => {
  const a = rotating('2031-09-19');
  const b = rotating('2031-09-19');
  assert.equal(a.text, b.text);
  assert.ok(POOL.includes(a.text));
});

test('across a month the rotating prompt actually rotates', () => {
  const seen = new Set();
  for (let d = 1; d <= 30; d += 1) {
    seen.add(rotating(`2031-09-${String(d).padStart(2, '0')}`).text);
  }
  assert.ok(seen.size >= 3, `only ${seen.size} distinct prompts in a month`);
});

test('quips are stable for a seed and never shout', () => {
  assert.equal(morningQuip('2031-09-19'), morningQuip('2031-09-19'));
  assert.equal(eveningQuip('2031-09-19'), eveningQuip('2031-09-19'));
  for (const line of [morningQuip('x'), eveningQuip('x'), openedQuip('x'), schluffQuip('x')]) {
    assert.equal(line, line.toLowerCase());
    assert.ok(!line.includes('!'));
  }
});

test('pick is deterministic and stays inside the list', () => {
  const list = ['a', 'b', 'c'];
  for (const seed of ['2031-09-01', 12345, 'anything']) {
    assert.equal(pick(list, seed), pick(list, seed));
    assert.ok(list.includes(pick(list, seed)));
  }
});
