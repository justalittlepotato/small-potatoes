# small potatoes — invariants

A handwritten page to open the day and one to close it, on an iPad, gone by
morning. Each tab asks one prompt at a time and ends in a button that closes
it for the day. Read `PLAN.md` for why it is shaped this way.

## What this is, and what it deliberately is not

A static progressive web app, like its siblings `hench-potato` and
`baking-potato`: it installs to the home screen from Safari, holds its data
on the device and runs offline. Unlike them it has **no backup, no export and
no history**. The store only ever holds today, and that is the design, not a
gap. Do not add a Dropbox mirror, a journal tab, a calendar, a streak, a
count, or anything that mentions a previous day.

## Hard rules

- **No build step. No framework. No dependencies.** Plain HTML, CSS and ES
  modules served as-is. `package.json` exists only so node reads the `.js`
  files as modules when running tests; it has no dependencies and never
  should.
- **`css/theme.css` is a verbatim copy** of the house style sheet. Never edit
  it. To update it, re-copy it and check both themes still read. App CSS goes
  in `css/app.css`, loaded after.
- **Tokens only.** Every colour and spacing value in `app.css` goes through a
  `var()`. App-specific measurements are declared as tokens at the top of
  `app.css`. Dark is the default; light must work.
- **No emoji anywhere.** Microcopy is lowercase, warm, and has no exclamation
  marks. The potato never counts, compares, or remembers.
- **The mascot's base pixels are never edited, only added to.** See below.
- **Today only.** `store.purgeExcept(today)` runs before anything renders and
  deletes every record from any other day. There is no flag to keep more.
- **The leave-it card is never written to the store.** `prompt.ephemeral` is
  the only thing that decides this; keep it that way. Its ink dissolves when
  *time for a schluff* is tapped, before the tab is marked closed, so a
  reload mid-fade cannot bring it back.
- **One card at a time.** A tab is a walk: `makeWalk` in `app.js` owns the
  cards, the dots, *back*, the primary button (*next*, then the closing
  label on the last card) and the closed state. The other cards stay in the
  DOM with their ink; only `.is-current` is displayed.
- **Closed-for-today lives in `localStorage`** as `closed:<day>:<tab>`, keyed
  by the day so it cannot leak into tomorrow, and swept on start. Ink stays
  in IndexedDB regardless; *look again* reopens the walk at card one.

## Layout

```
index.html          two screens as <section class="screen">: morning, evening
sw.js               service worker, cache-first on a versioned list
manifest.json       standalone display, any orientation, icons, theme colour
css/theme.css       VERBATIM house style — never edit
css/app.css         app chrome, tokens only
js/app.js           tabs, cards, wiring, day roll-over, update banner
js/day.js           pure: the day key (a day ends at 4am), which tab the clock suggests
js/prompts.js       pure: the fixed prompts and the rotating pool, picked by day
js/quips.js         what the potato says, seeded by the day
js/strokes.js       pure: thinning, width from pressure, hit testing, scaling
js/ink.js           the canvas: pointer events, strokes, undo, the rubber
js/store.js         the only module that touches IndexedDB
tools/build-mascot.py   regenerates the mascot svg and the png icons
test/               node --test, no dependencies
```

## Things that will bite you

- **`sw.js` has a hardcoded `ASSETS` list and a `VERSION` string.** Add a
  file to the app and you must add it there too, and bump `VERSION`, or the
  installed app keeps serving the old shell. The install is all-or-nothing on
  purpose; a half-cached app is worse than one that failed to install.
- **The install fetches with `cache: 'reload'`, and must keep doing so.**
  Pages serves files with `max-age=600`, so a plain `addAll` in the ten
  minutes after a deploy fills the new cache with the old shell.
- **The update banner is the only thing that says a new version exists.** The
  worker is cache-first and a suspended home screen app never navigates, so
  `app.js` calls `registration.update()` on every return to the foreground
  and shows the banner when a new worker reaches `installed` while a
  controller already exists. It offers a reload rather than doing one.
- **The canvas has `touch-action: none` and that is not negotiable.** Anything
  looser lets iOS treat a pencil drag as a scroll and cancel the stroke
  mid-word. The cost is that a finger cannot scroll over a card natively, so
  `ink.js` catches a touch that is not allowed to draw and scrolls the window
  by hand. If finger scrolling over cards feels wrong, fix it there; do not
  loosen `touch-action`.
- **Only `pointerType === 'pen'` draws, and there is no switch.** That is
  also the palm rejection. A finger scrolls and a mouse does nothing, so in
  a desktop browser the app is look-only; the walkthrough draws with
  synthetic pen events. A "finger too" toggle existed and was removed at her
  request. Do not bring it back.
- **Strokes are css pixels relative to the card, never bitmap pixels.** The
  bitmap is thrown away and redrawn from strokes on every resize, rotation and
  theme change. A saved page carries the `width` it was written at and
  `ink.load()` scales to the width it is drawn at, so ink keeps its shape
  across portrait and landscape. If you store anything derived from the
  bitmap you have broken this.
- **The pen is curves, not segments.** A stroke is drawn as quadratic curves
  through the midpoints of consecutive samples (`curvePath` in
  `strokes.js`), and pressure is smoothed as points arrive
  (`smoothPressure`). Straight segments with per-segment width looked
  jagged and lumpy at writing speed on the real iPad; that was the
  complaint that led here. The live pen draws `newestPiece` per sample and
  trails the tip by half a sample; on lift the whole stroke is redrawn as
  **one path at one width** (`strokeWidth`, the mean pressure). Stroking
  the pieces separately at their own widths left a bead at every seam,
  which she saw as grain. Pressure therefore varies between strokes, not
  within one. The feel of the pen is `WIDTH_MIN` and `WIDTH_MAX`, nothing
  else. There is no
  native pencil palette: Safari cannot show PencilKit's tool picker to a
  page, so undo and rub out are the controls, and there is one pen.
- **`setPointerCapture` is wrapped in a try.** A synthetic pointer event (the
  walkthrough, a test) has no pointer to capture and throws. Real pens work
  either way; the wrap just stops a test crashing a stroke.
- **Saves are debounced on the pen lifting**, and an emptied card deletes its
  record rather than saving an empty one. Anything that changes a page's
  shape without touching the ink (the *more room* link) has to call `save()`
  itself; that is how the extra room was lost on reload once.
- **A day boundary is 4am, not midnight** (`day.js`). Records are keyed by
  the day string, never by a `Date`. If the app is open across the boundary,
  the next return to the foreground reloads it blank, without comment.
- **A hidden card has a zero-size canvas.** `show(i)` calls `ink.fit()` on
  the card it reveals, and `showTab` refits the current card, or the ink is
  drawn into nothing. Anything else that reveals a card must do the same.
- **The z's only exist while `.screen.is-closed` is on the evening screen.**
  Nothing on the page animates before the tab is closed; that rule comes
  from the pacing potato and holds here. Under reduced motion the z's are
  shown still rather than left at opacity 0 by the house sheet's blanket
  animation rule.
- **`app.js` touches `document` at import and cannot be unit tested.** Logic
  that can live in `day.js`, `prompts.js`, `strokes.js` or `store.js` should,
  and does. Keep it that way.

## The mascot

The potato is the house potato, unchanged: no hat, no arms, nothing tucked
behind the sprout. A pencil and two small potatoes were tried and taken out
again. Do not add to it. The svg is generated so it carries the namespace
an `<img>` needs, and the icons are rendered from the same bytes. Run:

```
python3 tools/build-mascot.py
```

The script asserts every base rect survives byte for byte. The PNGs are
encoded by hand with `zlib` so the repo stays dependency-free.

## Verifying

```
node --test                       # the pure modules
python3 -m http.server 8790       # then open http://127.0.0.1:8790/
```

A mouse is not a pen, so in a desktop browser use the walkthrough script (or
dispatch `PointerEvent`s with `pointerType: 'pen'` from the console) to draw.
Then: draw on the first morning card, *next*, *back*, the ink is still
there; undo, rub out, clear, more room; *off you go, then* closes the morning, *look again*
reopens it; reload, it opens closed; on evening, four *next*s reach the
leave-it card, draw on it, *time for a schluff*, the ink goes and the potato
sleeps; narrow to phone width; add `class="light"` to `<html>`. Go offline in
devtools and hard reload: it must still open.

On the iPad itself, which nothing here can fake: Add to Home Screen; the
pencil draws with a palm resting on the glass; a finger scrolls; rotate and
the ink redraws in place; kill the app, reopen, the ink is still there; after
4am the next day the page is blank and the potato says nothing about it.
