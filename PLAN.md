# small potatoes — a handwritten potato journal for the iPad

> Written before anything was built, and kept as the record of why the app is
> shaped the way it is.

## Context

A gratitude journal that takes two minutes: a couple of prompts to open the
day and a couple to close it, answered by hand on an iPad with the pencil.
Short on purpose. Two lines, not a page.

Three decisions were made up front and everything else follows from them:

- **Ink, not typing.** The whole entry is handwritten with the pencil.
- **Today only.** Nothing is kept past the day.
- **On the iPad only.** No backup, no export, no sync.

Put together, that makes this a **ritual, not a record**. The page is
written, kept for the day, and gone by morning. The act is the point. It is
also what makes it guilt-free by construction: there is no history to have
gaps in, so the app cannot nag, count, or notice an absence.

House rules apply: the potato's voice is lowercase, dry and kind; nothing is
scored; there are no streaks, counts or calendars.

## Shape

Same species as `hench-potato` and `baking-potato`, cut down: a static
progressive web app with no build step, no framework and no dependencies,
installed from Safari to the home screen, running offline, portrait and
landscape both. No Dropbox module, no export, no journal tab. Simpler than
either sibling.

## The two tabs

Which tab opens is by the clock: before 2pm, morning; after, evening. The
other is one tap away. Each tab asks one prompt at a time on a ruled
handwriting card, with *next* and a small *back*, a row of dots for where you
are, and a closing button on the last card: *off you go, then* in the
morning, *time for a schluff* at night. The first version showed every card
stacked; one at a time was asked for on first sight of it, and is better.

**morning**: one thing to look forward to today, however small; one kind
thing for the body today.

**evening**: three good things (three is assumed; the headings do not hedge); one
rotating prompt from a pool, picked by the date so it holds all evening; and
*leave it here*, a card for the thing not to carry to bed. Its ink is never
saved; *time for a schluff* dissolves it and the potato goes to sleep with a
few slow z's. It is the one place the app does something with an entry, and
what it does is let it go.

Closing a tab shows one line from the potato and a small *look again*. There
is no "done" state beyond that, and nothing about it survives 4am.

## Ink

- Pointer events with `touch-action: none` on the canvas. Pressure maps to
  line width across a narrow range so it reads as a pen, not a brush.
- The pencil draws; a finger scrolls. Only `pointerType === 'pen'` draws,
  which is also the palm rejection. A *finger too* switch was built for the
  day the pencil is flat, and removed on sight: pencil only.
- Strokes, not pixels: each stroke is a list of `[x, y, pressure]` in css
  pixels, thinned so points closer than about 1.5px are dropped. The bitmap
  is redrawn from strokes on load, rotation, resize and theme change.
- Tools under each card, small: undo, a rubber that takes whole strokes so
  nothing is half-erased, clear, more room. No colours, no widths.

## Today only

A day runs 4am to 4am, so an evening written at half past midnight belongs to
the day it closes. On open the store deletes every record from any other day
before anything renders. There is no setting to keep more; if that is ever
wanted it is a new decision, not a flag.

Storage is IndexedDB rather than `localStorage` because handwriting is
points, and a full evening at pencil rate can run to a few megabytes.

## What was considered and not built

- **Tap-to-pick chips and dictation.** Kept out so the page is one thing.
  If ink turns out to cost too much, chips are a small addition later.
- **A "random past entry" surfaced gently.** Rejected with today-only: the
  potato does not know yesterday happened, and that is the feature.
- **Echoing the morning's ink on the evening tab.** Built, then dropped when
  the tabs became one card at a time. The evening stands on its own.
- **A mascot with a pencil and small potatoes at its feet.** Built, judged
  peculiar, removed. The potato is just the potato.
- **A markdown export through the share sheet.** Rejected with on-iPad-only.
  A screenshot before morning is the whole export story.
