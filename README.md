# small potatoes

A handwritten page to open the day and one to close it, on the iPad, with the
Apple Pencil. Gone by morning.

There is a **morning** tab with two prompts and an **evening** tab with five:
three good things, one that changes each day, and one thing to leave on the
page rather than carry to bed. It asks one at a time. You write in your own
hand, tap *next*, and at the end tap *off you go, then* in the morning or
*time for a schluff* at night. The page keeps for the day and is blank the
next morning. Nothing is stored past that, nothing is counted, and nothing is
sent anywhere.

## Putting it on the iPad

The app lives at **<https://justalittlepotato.github.io/small-potatoes/>**.

1. Open that address in **Safari** (it has to be Safari; only Safari can
   install apps to the home screen).
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open it from the home screen icon. It runs like a normal app, with no
   browser bar, and works with no signal at all.

## Using it

- **The pencil writes.** A finger scrolls, and only scrolls, so a hand
  resting on the glass leaves no marks.
- Under each card: *undo* takes back the last stroke, *rub out* turns the
  pencil into a rubber that takes whole strokes, *clear* wipes the card, and
  *more room* adds lines. A card also grows on its own when the ink reaches
  the bottom.
- *next* works on a blank card. Nothing is required. *back* goes to the
  previous card with its ink intact.
- The last evening card is for the thing to leave behind. Its ink is never
  saved; *time for a schluff* makes it go, and the potato goes to sleep.
- Once a tab is closed for the day it shows a line from the potato and a
  small *look again*, which reopens it at the first card.
- A day ends at 4am, so a late evening still counts as that evening.
- When a new version is published, a line appears above the bar offering a
  reload. Nothing reloads by itself.

## What it deliberately does not do

No history, no calendar, no streak, no backup, no export, no account. If you
want to keep something from a page, take a screenshot before morning.

## For anyone changing it

Plain HTML, CSS and JavaScript, no build step, no dependencies. `CLAUDE.md`
has the invariants and `PLAN.md` the reasoning. Tests run with `node --test`.
