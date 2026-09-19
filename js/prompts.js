// What the pages ask. Pure, and picked by the day key so the rotating prompt
// is the same all evening rather than changing under the pen.
//
// Ids are what a page is stored under. They stay stable across versions, so
// renaming a prompt's words never loses the ink written under it that day.

import { pick } from './quips.js';

export const MORNING = [
  { id: 'morning-forward', text: 'one thing to look forward to today, however small' },
  { id: 'morning-body', text: 'one kind thing for the body today' },
];

// The three good things. One is plenty, and the headings say so.
const GOOD = [
  { id: 'good-1', text: 'a good thing' },
  { id: 'good-2', text: 'another, if there was one' },
  { id: 'good-3', text: 'a third, no pressure' },
];

// The pool the fourth card draws from, one a day.
export const POOL = [
  'someone who was kind',
  'something the body managed',
  'something that tasted good',
  'something seen out of a window',
  'a small thing that went right',
  'something worth telling someone',
];

// The one card whose ink is never saved. `ephemeral` is how the app knows.
export const LEAVE = {
  id: 'leave',
  text: 'something to leave here, and not carry to bed',
  ephemeral: true,
};

export function rotating(dayKey) {
  return { id: 'rotating', text: pick(POOL, dayKey) };
}

export function eveningPrompts(dayKey) {
  return [...GOOD, rotating(dayKey), LEAVE];
}

export function morningPrompts() {
  return MORNING;
}
