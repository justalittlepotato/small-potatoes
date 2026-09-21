// What the potato says. Lowercase, dry, kind. No exclamation marks, no emoji,
// and nothing that counts, compares or remembers: the potato does not know
// yesterday happened.
//
// Nothing here reads the clock. The caller passes the day key in, so a line
// holds for the whole day rather than reshuffling on every re-render.

const MORNING = [
  'no one is marking this.',
  'a small thing will do. a small thing is the whole idea.',
  'your mutual friend has put the kettle on, figuratively.',
  'the day has not started yet. this is the bit before.',
  'two lines and you are done. the potato is not fussy.',
  'nothing below is a task. it is a page.',
  'write badly. the ink does not mind.',
];

const EVENING = [
  'nothing here is kept. write it anyway.',
  'three things. they can all be small. they usually are.',
  'the potato has seen the day and thought it was fine.',
  'small potatoes, mostly. that is the point.',
  'this page is gone by morning. so is the day.',
  'no need to be grateful for anything large.',
  'you got to the evening. that counts, but nobody is counting.',
];

// After "off you go, then". The morning is closed and the day is hers.
const OPENED = [
  'off you go. the page will keep.',
  'that is the morning done. the rest is just the day.',
  'the potato has nothing further. go and have it.',
  'right then. nothing here needs you until tonight.',
  'good. now go and be mildly pleased about something.',
];

// After "time for a schluff". The potato is asleep and so should she be.
const SCHLUFF = [
  'schluff well. the page has it from here.',
  'the potato is already asleep. no need to be polite about it.',
  'left here, where it cannot follow you.',
  'gone. as intended. night.',
  'that is the page’s problem now. schluff.',
];

// A stable pick from a list, given something that changes slowly. Same seed,
// same line, so a re-render does not swap the greeting mid-sentence.
export function pick(list, seed) {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) % 100_000;
  return list[hash % list.length];
}

export function morningQuip(seed) {
  return pick(MORNING, seed);
}

export function eveningQuip(seed) {
  return pick(EVENING, seed);
}

export function openedQuip(seed) {
  return pick(OPENED, seed);
}

export function schluffQuip(seed) {
  return pick(SCHLUFF, seed);
}
