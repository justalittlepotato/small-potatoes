// The app: two tabs, each a walk through its prompts one card at a time,
// ending in a button that closes the tab for the day.
//
// Everything is built once for today. If the day changes while the app is
// open (it was left on the stand overnight), the page reloads on the next
// return to the foreground and comes up blank, on the morning, without
// comment. Within a day the tabs hand over on their own: a morning closed a
// few hours ago with nothing since opens on the evening (`landingTab`).

import { dayKey, dayLabel, landingTab } from './day.js';
import { morningPrompts, eveningPrompts } from './prompts.js';
import { morningQuip, eveningQuip, openedQuip, schluffQuip } from './quips.js';
import { linesNeeded } from './strokes.js';
import { createInk } from './ink.js';
import * as store from './store.js';

const TABS = ['morning', 'evening'];
const LINES_START = 4;
const LINES_MORE = 3;
const SAVE_DELAY = 400;       // ms after the pen lifts
const CLOSED_PREFIX = 'closed:';
const LEAVE_MS = 1600;        // a touch over the css fade, in case transitionend never comes

const $ = (id) => document.getElementById(id);

const today = dayKey(new Date());
const walks = new Map();      // tab -> walk
let lineHeight = 40;          // read from css once the page is up

// ---------- the closed flags, in localStorage ----------

function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode, or storage blocked. The app still works for the session.
  }
}

// Pencil only. A finger scrolls, a mouse does nothing: that is what keeps a
// resting palm off the page, and there is no switch to loosen it.
function canDraw(event) {
  return event.pointerType === 'pen';
}

// A tab closed for the day. Keyed by the day so it cannot leak into
// tomorrow, and swept on start so it does not pile up either. The value is
// the time it was closed, which is what the handover to the evening reads.
function closedKey(tab) {
  return `${CLOSED_PREFIX}${today}:${tab}`;
}

function isClosed(tab) {
  return readSetting(closedKey(tab)) !== null;
}

// ms since the epoch, null if not closed, 0 if the flag has no readable time
// (an older version wrote 'yes'): long ago, so it hands over.
function closedAt(tab) {
  const value = readSetting(closedKey(tab));
  if (value === null) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function setClosed(tab, on) {
  writeSetting(closedKey(tab), on ? new Date().toISOString() : null);
}

function sweepClosedFlags() {
  try {
    const stale = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CLOSED_PREFIX) && !key.startsWith(`${CLOSED_PREFIX}${today}:`)) {
        stale.push(key);
      }
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    // nothing to sweep
  }
}

// ---------- cards ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toolButton(label, onClick) {
  const b = el('button', 'link-btn tool', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function setLines(paper, n) {
  paper.style.setProperty('--lines', String(n));
  paper.dataset.lines = String(n);
}

function linesOf(paper) {
  return Number(paper.dataset.lines) || LINES_START;
}

function makeCard(prompt) {
  const card = el('article', 'page');
  card.dataset.prompt = prompt.id;

  card.appendChild(el('h2', 'page-prompt', prompt.text));

  const paper = el('div', 'paper');
  setLines(paper, LINES_START);
  const canvas = el('canvas', 'ink');
  canvas.setAttribute('aria-label', prompt.text);
  paper.appendChild(canvas);
  card.appendChild(paper);

  const tools = el('div', 'tools');
  card.appendChild(tools);

  let saveTimer = null;

  const ink = createInk(canvas, {
    canDraw,
    onChange: () => {
      // Let the ink run on: if a stroke reached the last line, add one.
      const needed = linesNeeded(ink.snapshot().strokes, lineHeight, linesOf(paper));
      if (needed !== linesOf(paper)) setLines(paper, needed);
      refreshTools();
      if (prompt.ephemeral) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, SAVE_DELAY);
    },
  });

  async function save() {
    const { strokes, width } = ink.snapshot();
    if (strokes.length === 0) {
      await store.deletePage(today, prompt.id).catch(() => {});
      return;
    }
    await store.savePage({
      day: today, prompt: prompt.id, strokes, width, lines: linesOf(paper),
    }).catch((err) => console.warn('could not save the page', err));
  }

  const undo = toolButton('undo', () => ink.undo());
  const rub = toolButton('rub out', () => {
    ink.setMode(ink.mode() === 'erase' ? 'draw' : 'erase');
    refreshTools();
  });
  const clear = toolButton('clear', () => { ink.clear(); ink.setMode('draw'); refreshTools(); });
  const more = toolButton('more room', () => {
    setLines(paper, linesOf(paper) + LINES_MORE);
    // The room is part of the page: an inked card keeps it across a reload.
    if (!prompt.ephemeral && !ink.isBlank()) save();
  });

  tools.append(undo, rub, clear, more);

  function refreshTools() {
    undo.disabled = !ink.canUndo();
    clear.disabled = ink.isBlank();
    rub.classList.toggle('is-on', ink.mode() === 'erase');
    paper.classList.toggle('is-rubbing', ink.mode() === 'erase');
  }
  refreshTools();

  return { prompt, card, paper, ink, refreshTools };
}

async function restore(entry) {
  const { prompt, paper, ink } = entry;
  if (prompt.ephemeral) return;
  const page = await store.getPage(today, prompt.id).catch(() => null);
  if (!page) return;
  setLines(paper, Math.max(page.lines || LINES_START, LINES_START));
  ink.load(page);
  const needed = linesNeeded(ink.snapshot().strokes, lineHeight, linesOf(paper));
  if (needed !== linesOf(paper)) setLines(paper, needed);
}

// The ink goes: a fade, then the strokes are forgotten. Never saved, and
// no way back. Resolves once the card is blank.
function dissolve(entry) {
  const { paper, ink } = entry;
  if (ink.isBlank()) return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      paper.removeEventListener('transitionend', done);
      ink.forget();
      ink.setMode('draw');
      paper.classList.remove('is-leaving');
      entry.refreshTools();
      resolve();
    };
    paper.addEventListener('transitionend', done);
    paper.classList.add('is-leaving');
    // If the transition never fires (reduced motion), do it anyway.
    setTimeout(done, LEAVE_MS);
  });
}

// ---------- a walk: one card at a time ----------

function makeWalk(tab, prompts, closing) {
  const pages = $(`${tab}-pages`);
  const dots = $(`${tab}-dots`);
  const back = $(`${tab}-back`);
  const primary = $(`${tab}-primary`);
  const walkEl = $(`${tab}-walk`);
  const closedEl = $(`${tab}-closed`);
  const closedLine = $(`${tab}-closed-line`);
  const again = $(`${tab}-again`);
  const screen = $(`screen-${tab}`);

  const entries = prompts.map(makeCard);
  for (const e of entries) pages.appendChild(e.card);
  for (const _ of entries) dots.appendChild(el('span', 'dot'));

  let index = 0;
  let closing_ = false;

  function show(i) {
    index = Math.max(0, Math.min(entries.length - 1, i));
    const last = index === entries.length - 1;
    entries.forEach((e, n) => e.card.classList.toggle('is-current', n === index));
    [...dots.children].forEach((d, n) => d.classList.toggle('is-on', n <= index));
    back.hidden = index === 0;
    primary.textContent = last ? closing.label : 'next';
    primary.classList.toggle('btn-close', last);
    primary.disabled = false;
    walkEl.hidden = false;
    closedEl.hidden = true;
    screen.classList.remove('is-closed');
    // A card that was hidden has a zero-size canvas; size it now it can be seen.
    entries[index].ink.fit();
    window.scrollTo(0, 0);
  }

  function showClosed() {
    walkEl.hidden = true;
    closedLine.textContent = closing.quip(today);
    closedEl.hidden = false;
    screen.classList.add('is-closed');
    window.scrollTo(0, 0);
  }

  async function close() {
    if (closing_) return;
    closing_ = true;
    primary.disabled = true;
    // Anything ephemeral goes now, before the tab is marked closed, so a
    // reload mid-fade cannot bring it back.
    await Promise.all(entries.filter((e) => e.prompt.ephemeral).map(dissolve));
    setClosed(tab, true);
    closing_ = false;
    showClosed();
  }

  function next() {
    if (index === entries.length - 1) close();
    else show(index + 1);
  }

  function reopen() {
    setClosed(tab, false);
    show(0);
  }

  // Where to land on open: closed shows closed; otherwise the first blank
  // card, or the last one if every card has ink.
  function start() {
    if (isClosed(tab)) { showClosed(); return; }
    const blank = entries.findIndex((e) => e.ink.isBlank());
    show(blank === -1 ? entries.length - 1 : blank);
  }

  primary.addEventListener('click', next);
  back.addEventListener('click', () => show(index - 1));
  again.addEventListener('click', reopen);

  return { entries, start, show, fitCurrent: () => entries[index].ink.fit() };
}

// ---------- tabs ----------

function currentTab() {
  const hash = location.hash.replace('#', '');
  return TABS.includes(hash) ? hash : null;
}

function showTab(tab) {
  for (const t of TABS) {
    $(`screen-${t}`).classList.toggle('is-active', t === tab);
  }
  document.querySelectorAll('.tab[data-tab]').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.tab === tab);
  });
  document.title = `small potatoes · ${tab}`;
  const walk = walks.get(tab);
  if (walk) walk.fitCurrent();
  window.scrollTo(0, 0);
}

// The tab the rule wants right now, given the one showing (or none).
function wantedTab() {
  return landingTab({
    now: Date.now(),
    current: currentTab(),
    morningClosedAt: closedAt('morning'),
    eveningClosedAt: closedAt('evening'),
  });
}

function route() {
  const tab = currentTab();
  if (!tab) {
    history.replaceState(null, '', `#${wantedTab()}`);
    route();
    return;
  }
  showTab(tab);
}

// ---------- the day ----------

// Called on every return to the foreground, and once a minute in case the
// app never leaves it (an ipad on a stand with the screen kept awake).
function settle() {
  if (dayKey(new Date()) !== today) {
    // A new day. The page it belonged to is over; start clean. The hash
    // goes first: a reload keeps it, and yesterday's `#evening` would open
    // this morning on the wrong tab.
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
    return;
  }
  const tab = wantedTab();
  if (tab !== currentTab()) location.hash = tab;
}

// ---------- start ----------

async function start() {
  lineHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--line-h')) || 40;

  sweepClosedFlags();
  try {
    await store.purgeExcept(today);
  } catch (err) {
    console.warn('could not tidy the store', err);
  }

  $('morning-quip').textContent = morningQuip(today);
  $('evening-quip').textContent = eveningQuip(today);
  for (const node of document.querySelectorAll('.day-label')) node.textContent = dayLabel(today);

  walks.set('morning', makeWalk('morning', morningPrompts(), {
    label: 'off you go, then', quip: openedQuip,
  }));
  walks.set('evening', makeWalk('evening', eveningPrompts(today), {
    label: 'time for a schluff', quip: schluffQuip,
  }));

  // Ink first, so each walk can land on the first blank card.
  const all = [...walks.values()].flatMap((w) => w.entries);
  await Promise.all(all.map(restore));
  for (const walk of walks.values()) walk.start();

  window.addEventListener('hashchange', route);
  route();
  // A relaunch keeps the hash it was suspended with; the rule still applies.
  settle();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') settle();
  });
  setInterval(settle, 60_000);

  // Ask the browser not to evict the store under us. Home screen apps are
  // exempt from Safari's seven-day rule anyway; this is belt and braces.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

start();

// ---------- the service worker, and telling her about updates ----------
//
// The worker is cache-first, so an installed app never asks the network
// about its own files. The browser only re-checks `sw.js` on a navigation,
// and a home screen app that is suspended rather than closed does not
// navigate. So: ask on every return to the foreground, and when a new
// worker has arrived, offer a reload rather than doing one, which would
// throw away a half-written line.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register('sw.js');
    } catch (err) {
      console.warn('service worker did not register', err);
      return;
    }

    $('update-banner').addEventListener('click', () => location.reload());

    registration.addEventListener('updatefound', () => {
      const arriving = registration.installing;
      if (!arriving) return;
      arriving.addEventListener('statechange', () => {
        if (arriving.state !== 'installed') return;
        // No controller means this is the first ever install, not an update.
        if (!navigator.serviceWorker.controller) return;
        $('update-banner').hidden = false;
      });
    });

    const check = () => registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    check();
  });
}
