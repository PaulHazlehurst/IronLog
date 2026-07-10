# Iron Log — personal workout hub

A static, mobile-friendly workout tracker: set a weekly plan once, it repeats
until you change it, and each week's weight/rep targets are generated from
your last logged session using progressive-overload rules (double
progression + RPE autoregulation + periodized deloads). Also includes a
muscle-recovery view, strength-tier comparison against public bodyweight
standards, and an optional AI assist (your own free Gemini key) for exercise
picks and mind-muscle cues.

## Deploy to GitHub Pages

1. Create a new repo on GitHub (public or private both work with Pages on
   most plans — private repos need GitHub Pro/Team/Enterprise for Pages).
2. Upload every file in this folder to the repo root, keeping the `css/`
   and `js/` folders intact.
3. In the repo: **Settings → Pages → Build and deployment → Source**, choose
   `Deploy from a branch`, pick `main` and `/ (root)`, save.
4. GitHub gives you a URL like `https://yourusername.github.io/reponame/` —
   that's your app.

No build step, no dependencies to install — it's plain HTML/CSS/JS.

## Where your data lives

Everything (plan, logs, settings) is stored in **this browser's
localStorage**, on this device only. There's no server or database behind
it. That means:

- It's private by default — nothing leaves your device except optional AI
  calls (see below).
- It does **not** sync across devices or browsers on its own.
- Clearing your browser's site data/cache will erase it.

Use **Settings → Export backup** regularly (a `.json` file downloads to your
device) and **Import backup** to restore or move it to another
browser/device.

## Home hub, notifications & profile colors

**Home** is now the first tab — a shared comment feed for everyone using the
app. Post a note, and it syncs to every profile/device like everything else.
Completing a workout on the Today tab automatically posts an activity item
("completed Push Day 💪") so your partner sees it without you doing anything.
Tap the emoji under any post to react.

Each profile picks a **tag color** (profile panel, alongside Theme) used to
color their name/avatar on posts, so it's easy to tell at a glance who said
or did what.

**Notifications — read this part.** Tapping "Enable notifications" lets the
app show a notification when it detects new activity from your partner —
this fires reliably whenever the app is opened, reopened, or sitting in the
background with the tab still alive. It will **not** reliably wake up a
fully closed/locked phone the instant something happens — that needs genuine
push notifications, which require a small always-on relay to trigger
delivery (even a free one, e.g. a Cloudflare Worker) since a static site
has no way to push to a phone that isn't asking. If instant-while-locked
notifications matter enough to you, that's a buildable follow-up — just ask.

On iPhone specifically: Notification permission and delivery only works
reliably once the app is **installed to the home screen** (see the PWA
section below) and on iOS 16.4+; it's unreliable from a regular Safari tab.

## Layout fixes

- The header now pads around the iPhone status bar / notch / Dynamic Island
  instead of sitting underneath it.
- The bottom tab bar is bigger, with safe-area padding for phones with a
  home indicator.

## Profiles

Tap the profile button (top right) to create or switch profiles — each
profile has its own plan, logs, and theme. All profiles live inside the same
synced store, so:

- Anyone using the app on their own device creates their own profile there,
  or picks their name if it already exists (once you're synced to the same
  GitHub Gist, both devices see all profiles).
- **Push my plan to…** in the profile panel copies your current weekly plan
  (exercise template only, not your logged history) onto another profile —
  handy for handing someone a starting point.
- Each profile picks its own **theme** (Iron / Pink / Night) from the same
  panel.

## AI key — device-local, not shared

Each device needs its own free Gemini key, entered in Settings on that
device. It's deliberately never synced or written into your Gist — see
"Critical fix" above for why. If you want AI features on both your and
your partner's device, each of you enters your own key (both totally free
from aistudio.google.com/apikey).

## Themes, fonts & motion

Eight themes now (profile panel): Iron, Pink, Night, Sunset (warm
coral/amber), Neon (purple/cyan synthwave), Forest (calm green), Holiday
(Christmas red/green/gold), and Winter (icy blue/silver).
Each profile also picks a **font style** — Modern (the default, Space
Grotesk), Playful (rounded Baloo 2), or Classic (elegant Fraunces serif) —
right next to the theme swatches.

Small motion throughout: tabs fade in on switch, buttons give a tactile
press, cards animate in, and hitting a new PR triggers a quick confetti
burst. Respects `prefers-reduced-motion` if your device has that turned on.

## Three new features

**Live Workout Mode** — "🏋️ Start Workout Mode" on Today (when a session is
scheduled) opens a distraction-free, full-screen, one-exercise-at-a-time
view with large tap targets and a built-in rest timer. Your phone's screen
is kept awake for the whole session using the browser's Wake Lock API, so
it won't lock between sets — this only works once the app is added to your
home screen and on iOS 16.4+. Exiting early keeps whatever you've entered
in memory for that session; finishing saves exactly the same way the
regular Today tab does.

**Trophy Case** — Progress tab. Nine unlockable badges (first session, week
streaks, session counts, PRs, reaching Advanced tier on a lift, trying 3+
themes) computed live from your actual data — no separate tracking to
maintain, they just reflect where you already are.

**Friendly Competition** — Home tab, once there are 2+ profiles. A simple
side-by-side of sessions logged this calendar month, with a 🏆 next to
whoever's ahead. Meant to be lighthearted, not a real leaderboard.

## How fast does sync actually happen?

**Short answer: not instant, but now automatic in more situations than before.**

When you change something (add a shop item, log a workout, etc.), your own
device pushes it to GitHub after a short debounce (~2 seconds) so rapid
changes batch into one upload rather than spamming requests.

The other person's device picks it up:
- Automatically, whenever they bring the app back to the foreground (switch
  back to it, unlock the phone with it already open, etc.) — this was
  actually missing until this update; previously a sync only ran once, on
  a full cold load, which for a PWA that mostly just gets backgrounded
  rather than fully closed meant real delays. Fixed now, throttled to at
  most once every 15 seconds so flipping between apps rapidly doesn't
  hammer GitHub's API.
- Immediately if they force-quit and reopen the app.
- On demand via **Settings → Pull latest**.

So in practice: add something to your shop, and if she has the app open
and glances back at it (or switches away and back), she'll see it within
about 15 seconds without doing anything. If the app's been sitting fully
backgrounded for a while, opening it fresh syncs right away too.

## Themes reworked into Mode + Style (they now combine)

This was a real architecture change, not just a new option. Previously
every theme was one fixed bundle — background, text, *and* accent color
all locked together. Now there are two independent choices:

- **Mode** (Settings → Appearance) — Light, Dark, or Night. Controls only
  the neutrals: background, surface, text color.
- **Style** (same card in Settings, or the profile panel) — Iron, Pink,
  Neon, Sunset, Forest, Holiday, Winter, Sabrina, or Taylor. Controls only
  the accent color and a few decorative touches.

Pick any mode with any style — Light mode + Pink style genuinely gives you
a light background with pink accents, not a fixed "Pink theme" that was
always dark. A few styles (Winter's icy blue, Taylor's gold) get an
automatically-adjusted accent specifically for Light mode, since the
original color was tuned for a dark background and would've been too pale
to read well on white — same style, same identity, just legible either way.

**If you already had a theme picked**, it migrates automatically the first
time you open the updated app — your old single theme splits into the
matching mode + style pair (e.g., Sabrina becomes Light mode + Sabrina
style, Taylor becomes Dark mode + Taylor style, Pink/Neon/Sunset/Forest/
Holiday/Winter all become Dark mode + that style) so nothing resets or
looks different unless you change it yourself.

## Preset questions can now suggest actual changes

The Recovery and Split questions no longer just answer in text — when
something's genuinely worth changing, the AI can now propose real,
one-tap-away edits to your plan, using the same accept/dismiss suggestion
cards already built for the main "Review my week" flow:

- **Remove** or **add** an exercise on a specific day (already existed)
- **Move** — relocate one exercise to a different day (new)
- **Swap days** — swap two entire days' workouts wholesale (new)

Both new action types are also now available from the main "Review my
week" AI summary too, not just the preset questions, since it's the same
underlying suggestion system. The **Alignment** question stays purely
informational (no AI, no suggestions) — it's a naming/data-consistency
check, not something with an obvious one-click fix.

## Fixed: preset question answer disappearing on every sync

Same underlying issue as a couple of earlier fixes, just a spot I missed
when I built the preset-question feature — I gave "Review my week"
results a way to survive a re-render but forgot to do the same for the
new question box, so any background sync (or just navigating away and
back) wiped the answer with nothing to bring it back. Fixed two ways:
the answer now persists and restores itself after any re-render, *and*
a populated result is now treated the same as an open form — a silent
background sync won't even attempt the disruptive re-render while one's
showing, so there's no flash either.

## Critical fix: multi-day exercises weren't sharing progress history

Confirmed exactly what you suspected, and traced it precisely: every
exercise slot gets its own ID when you add it to a day. "Chest Press" on
Monday, Wednesday, and Friday were three separate IDs, and progression was
matched by ID alone — so each day's Chest Press only ever looked at
*previous occurrences of that exact same slot*, completely blind to the
other two sessions that same week. This also quietly miscounted PRs the
same way (a session could get flagged as a "PR" against its own
practically-empty one-day-a-week history).

Fixed at the root: progression, PR detection, the Progress tab chart, and
the Trophy Case PR count all now pool history by **exercise name** across
the whole plan, not by per-day ID. Chest Press on any day now correctly
sees every Chest Press session that week, and progression advances every
time you train it — not once a week regardless of frequency. The Progress
tab's exercise picker also now shows one "Chest Press" entry instead of
three identical, confusing duplicates.

**One thing this makes matter more:** exercise names now need to match
*exactly* (case/whitespace aside) to pool correctly — "Chest Press" and
"Chest press " with a typo would no longer be silently merged. That's
exactly what the new alignment check below is for.

## Plan review: ask a specific question

Small select box under "Review my week" with three preset questions:

- **How does my recovery time look?** — AI-narrated, focused specifically
  on recovery windows between sessions hitting the same muscle.
- **How does my split look?** — AI-narrated take on the overall structure
  (push/pull/legs, upper/lower, etc.) and whether the balance across days
  makes sense.
- **Are all my exercises aligned?** — no AI needed, purely deterministic.
  Checks two things directly tied to the fix above: (1) the same exercise
  name tagged with different muscle groups or types across days — a data
  mistake — and (2) exercise names that are *almost* identical but not
  quite (a likely typo), which matters now since a misspelled duplicate
  silently starts its own separate, empty progress history instead of
  pooling with the real one.

## Roulette — found and fixed a real display bug, plus your new spec

The actual bug: the "🎟️ N spins available" text never updated after a
spin — only the button's disabled state did, so the number stayed stale
while the button quietly became unusable. That mismatch was almost
certainly what felt "screwed up." Fixed — the count now updates in place
every time, same as the balance already did.

Implemented on top of that: **2 free spins a day** (up from 1), respins
confirmed to touch nothing — no coins, doesn't consume a spin — and PRs
still grant +1 bonus spin each, unchanged.

**On the PR coin amount:** the code default is already 2 (set a couple of
rounds ago), but that only applies to brand-new setups — it can't reach
into your browser and overwrite a value you'd already saved. If your app
is still showing a different number, go to **Settings → Token economy →
Bonus tokens per PR** and set it to 2 yourself. That's the one settings
field my code changes genuinely can't touch for you.

## Two small "above and beyond" additions — and why I didn't reach further

You asked specifically whether an external import would be worth it here.
Honest answer: **not really, for this app** — here's the actual tradeoff.
A library like canvas-confetti or a Lottie animation player would add a
real external dependency (extra network request, needs the service worker
cache updated, some risk if the CDN's ever unreachable on first install)
for a visual improvement that's marginal on top of what's already
hand-built (confetti, kiss stamps, hug pulses, hype bursts, the garden
sway). Given you said not to diverge too much, I didn't think that
trade was worth it.

What I did add — both reuse patterns already in the app, so the
incremental cost is close to zero:

- **Sound effects** (Settings, off by default) — small synthesized chimes
  (a few oscillator notes, same technique as the existing rest-timer beep)
  for sending a gift, hitting a PR, and roulette jackpots. Zero audio
  files, nothing to download or cache — it's pure code, so the storage
  cost is effectively nothing.
- **A fourth font style, Handwritten** — same font-picker mechanism as
  Modern/Playful/Classic, just one more Google Fonts option (Caveat, a
  warm script face). Same caching pattern as the fonts already loaded, so
  no new infrastructure, just one more choice.

## Critical fix: the date bug behind three separate symptoms

Traced all three of these back to the same root cause: the app was
computing "today" using UTC time instead of your actual local time, so
"today" was silently rolling over at UTC midnight rather than your real
midnight — meaning depending on the hour and your timezone, "today" could
be wrong for several hours at a stretch. This explains:

- Getting locked out of "today's" workout even though it was genuinely a
  new calendar day for you.
- Being able to redeem water more than once in the same real day.
- (Indirectly) contributing to the sync-interruption bug below, since the
  wrong "today" made the completed-workout check unreliable.

Fixed at the source — one function (`isoDate`), used everywhere "today" is
computed, now uses your local calendar date. Everything downstream
(workout lockout, water limit, streaks) inherits the fix automatically.

## Fixed: logging a second workout kept snapping back to the completed screen

Real bug, and your diagnosis was right — background sync (every ~12s) was
re-rendering the Today tab mid-entry, and since it had no way to know you
were actively in the middle of "log another session," it just redrew the
completed-workout screen over whatever you were filling out. Extended the
same protection already built for open forms/timers to cover this exact
case — an in-progress workout log (either the first session or a
follow-up) is now treated as protected, same as everything else.

## Roulette: 0 is now a respin, plus daily spin limits

Landing on the old "0" segment no longer costs your wager — it's now a
free respin (shown as ↻ on the wheel), no coins won or lost either way.
Spinning itself is now gated to **one free spin a day**, refreshed at your
local midnight, with **+1 bonus spin every time you hit a PR** — check the
spin count shown above the wheel.

## Send tokens to your partner

Shop tab → 💸 Send tokens, next to your balance. Pick who, how much,
confirm — deducts from your balance and credits theirs directly (not a
redemption request this time, an actual transfer), posts a note to Home
so you both see it.

## Our Garden — a shared growth visual (the "wow" for both of you)

New card at the top of Home: a little plant that grows through six stages
(🌱 → 🌿 → 🪴 → 🌳 → 🌸 → 🌺) based on your *combined* activity across the
whole app — both profiles' workouts, every post, every gift sent, every
Reasons Why entry, and your joint streak all feed into it. It's the one
thing on Home that's neither person's individual stat — it only grows when
you're both actually using this together.

## Ghost-text set inputs + rep range in Workout Mode

Weight/reps/RPE fields now show the suggested numbers as grey placeholder
text instead of pre-filled values — the field is visually empty until you
actually type in it. Leaving one blank and saving still records the
suggested number (it doesn't silently save as 0), so you don't have to
retype identical numbers every set; typing an actual different number
(including a genuine 0) always overrides it. Workout Mode's target box (and
the regular Today tab, for consistency) now also shows the exercise's full
rep range, not just the specific number targeted this session.

## Appearance modes

Settings → Appearance mode: four quick-shortcut buttons (Light, Dark,
Neon, Pink) mapped onto the existing theme system rather than a separate
mechanism — Dark is Iron, Neon and Pink are the themes of the same name.
**Light is genuinely new** — a real light-mode palette (white/near-white
background, dark text), distinct from Sabrina's blush-pink glam look which
happens to also be light but is its own aesthetic. The full theme list
(Sunset, Forest, Sabrina, Taylor, Holiday, Winter, and the rest) is still
in the profile panel — this is a faster path to the four most common
picks, not a replacement for it.

## More gifts, plus a few things aimed squarely at her experience

**Two more gift types**, each with a genuinely distinct animation rather
than reusing the same falling effect:
- **🤗 Hug** — expanding warm rings pulsing out from the center of the
  screen, more like an embrace than a shower of petals.
- **🔥 Hype** — a full-circle fire burst plus a quick screen shake, more
  energetic than the romantic gifts, fits post-workout hype-man energy.

**Personalized greeting** — top of Home now reads "Good morning, Sarah ☀️"
(or afternoon/evening/night) based on the actual time of day.

**🎲 Surprise us** — a button on Home that hands back a random low-effort
date/activity idea when you're both out of ideas. Purely relationship
content, nothing fitness or token related — a deliberate counterweight to
how much of this app is gamification.

**📸 Our photos** — every photo ever shared in the feed now also collects
into a permanent scrollable gallery on Home (same "doesn't scroll away"
principle as Reasons Why), tap any thumbnail for a full-screen view.

## Home screen — full redesign

Rebuilt from the ground up with the visual language of the polished social
apps you mentioned:

- **Stats strip** — days together, week streak, token balance, and the
  monthly competition all live in a horizontally-scrollable row of compact
  chips up top now, instead of stacked full-width cards eating vertical
  space before you even reach the feed.
- **Quick actions row** — a circular, gradient-icon row (photo, rose,
  flowers, kiss, love, thanks) styled like a stories bar — tap once to
  send, no digging through button rows.
- **Redesigned composer** — a rounded pill input anchored to your avatar
  with an inline send button, instead of a boxy textarea-plus-buttons card.
- **Redesigned feed cards** — larger avatars, a color-coded accent bar tied
  to each person's tag color, cleaner type hierarchy, pill-shaped reaction
  chips. Reacting no longer re-renders the whole page — it updates in
  place, so you don't lose your scroll position.
- **Double-tap to heart-react** — tap twice on any post's text or photo for
  the classic double-tap heart burst, on top of the existing reaction
  chips.

## Kiss marks 💋

Added as a fourth gift type alongside rose/flowers/love. Sending one gives
it its own distinct animation — rather than reusing the falling-petals
effect from the other gifts, kisses "stamp" onto the screen at random
spots with a pop-and-fade, more like an actual lip print landing than
something drifting down. Shows up for your partner the same way the other
gifts do — immediately if they're on Home, next time they open/check the
app otherwise.

## New tab: Wellness

Four sections, switchable with chips at the top:

- **💧 Water** — confirm you hit your target (Women: 11.5 cups, Men: 15.5
  cups shown in the confirmation) for +10 tokens, once per day per person.
- **📚 Library** — a bookshelf per profile. Add a book (title, author,
  page count), update pages read as you go for a progress bar and **1
  token per page** — only for pages *newly* read since your last update,
  correcting the number down doesn't claw tokens back. Switch to your
  partner's shelf to browse (read-only) and tap a book to see how far
  they've gotten.
- **📖 Study** — log a subject and duration (5 tokens per 10 minutes).
  Right after logging, it asks what you actually learned; if AI is on,
  Gemini scores the accuracy/depth of your recall for up to 50 bonus
  tokens. Skippable if you just want the base reward.
- **🏃 Cardio** — log walking/running/swimming/cycling/rowing/other and a
  duration, 1 token per 2 minutes.

All of this lives in each profile's own data and syncs the same way plan
and logs already do — no special setup needed.

## Workout completion no longer re-shows the log form

Finishing today's session now shows a clean "✅ Workout complete" card
instead of immediately re-displaying the exercise list with fresh input
fields — including one-tap buttons to send your partner a quick nudge
("Your turn! 💪", "Beat my numbers today 😏", etc.) right from that screen.
If you genuinely want to log a second session the same day, "Log another
session today" is right there too.

## Roulette wheel now shows the actual numbers

Each segment displays its multiplier directly on the wheel (0x, 0.5x, 1x,
1.5x, 2x, 5x in gold) instead of relying only on the legend below it.

## Profile panel scrolling, token rebalance, and a full Shop redesign

**Profile panel** — was missing `max-height`/`overflow-y` entirely, so once
theme/font/ambient/color/avatar pickers all stacked up, the bottom got cut
off with no way to reach it. Fixed — it now scrolls within the viewport.

**Token amounts changed** — defaults are now 12 per workout, 2 per PR
(down from 15). This only affects brand-new setups; **your existing
household already has 10/15 saved, so update the two fields yourself in
Settings → Token economy** to actually change it for you two — takes
five seconds, the values aren't retroactively overwritten automatically.

**Shop redesign:**
- **Editable items** — Edit button on any item in your own shop, opens the
  same form pre-filled.
- **Shop switcher** — a button row above the items to flip between "My
  Shop" and each partner's shop, instead of everything stacked on one page.
- **Big swipeable cards** — one item at a time, large icon, swipe left/right
  on mobile, with **Prev/Next buttons doing the same thing** so it's not
  swipe-only (works on desktop, works for anyone who doesn't swipe).
- **Icons** — 20 to choose from (gift, flowers, dining, movie, money,
  shopping bag, sparkles, gem, beach, coffee, wine, game controller, spa,
  car, cake, chocolate, book, music, etc.) when adding or editing an item.
- **Four categories**, exactly as specified — "Have you ever tried this
  one?", "The Dating Game", "Shopping Spree", "Anything For You" — pick
  one per item, filter the shop by category with chips above the card.
- **Existing items still work** — anything added before this update had no
  icon/category saved; it now defaults to a gift icon and "Anything For
  You" until you edit it to set something more specific. Nothing was lost
  or needs re-entering.

## Minor: fewer gist revisions during action bursts

Not an urgent fix (the app's actual performance doesn't depend on gist
revision count), but a free improvement: "immediate" pushes now have an
800ms debounce — imperceptible as a delay, but enough to collapse a quick
burst of actions (post a comment, react, redeem an item, all within a
couple seconds) into one gist revision instead of three.

## Bug audit — what I found and fixed

Went through every file systematically rather than spot-checking:

- **Real bug:** after redeeming a shop item, the code refreshed the Home
  tab instead of the Shop tab you were actually looking at — a leftover
  from when Shop was still embedded in Home and got missed when it moved
  to its own tab. The screen just wouldn't update your new balance until
  you switched tabs away and back. Fixed.
- **Real bug:** the "yank the screen out from under an open form" issue
  from before wasn't fully fixed — it only protected text inputs, not the
  AI Plan Builder's clickable equipment chips, or a rest timer actively
  counting down. Both are now protected the same way.
- **Minor bug:** the ambient background effect (snow/petals/hearts) fully
  reset and flickered on every background sync, even when nothing about it
  had changed. Now only resets when the effect actually changes.
- Bumped the offline cache version and added a missing icon file to the
  service worker's shell list (cosmetic, doesn't affect normal use since
  everything's network-first anyway).

## New: Reasons Why

A permanent shared list on Home, deliberately separate from the
comment/activity feed — the feed is great for the moment, but things
posted there eventually scroll away under new activity. This doesn't:
add one line at a time, big or small, and it just sits there, always
visible, for either of you to read whenever. You can each remove your own
entries; neither of you can remove the other's.

## Fixed: forms getting wiped out mid-typing by background sync

Direct consequence of the "near-instant sync" work — background polling
(every ~12s) would pull fresh data and immediately re-render whichever tab
was open, including any form you were actively typing into (Shop's "Add
item," Home's composer, "Add exercise" in Plan, etc.), since a tab
re-render rebuilds that whole panel's HTML from scratch. Fixed: a silent
background sync now checks whether you're actively focused in an input,
textarea, or select, and skips the disruptive re-render if so — the fresh
data is still saved locally either way, it just won't visually appear
until you're done and the tab naturally re-renders on its own.

## Profile deletion — now actually propagates (real bug, now fixed)

Short answer to "does deleting a profile update across both devices": it
does now — it didn't reliably before. The bug: deleting a profile only
ever removed it from *your* local storage. The next sync would rebuild the
profile list from whatever files still existed on GitHub, and since the
deleted profile's file was never actually removed from the Gist, it would
get **resurrected** — on your own device on a later sync, or on hers.

Fixed with a proper tombstone system: deleting (or renaming) a profile now
records that name in a small shared "deleted" list that travels with every
sync, and the next push explicitly deletes that profile's file from the
Gist. A pull now checks this list and won't let a stale remote copy bring
a deleted profile back, regardless of which device does the deleting.

Also added while I was in there: profiles couldn't actually be renamed —
the underlying function existed but nothing in the UI called it. Fixed;
✏️ next to your own profile in the profile panel.

## Syncing — now much closer to instant

Two changes:

1. **Discrete actions push immediately** instead of waiting on the normal
   debounce — posting, sending a gift/appreciation, reacting, redeeming or
   adding a shop item, finishing a workout, spinning roulette, creating/
   renaming/deleting a profile, setting the special date. These all now
   fire a push right away.
2. **Background polling while the app is open** — previously, sync only
   ever ran once on a cold app load. Now it also runs automatically every
   ~12 seconds while the app is visible, and immediately (throttled to
   once per 6 seconds) whenever you switch back to the app. Combined with
   faster debouncing on everything else (1 second instead of 2), most
   changes now show up for the other person within a few seconds without
   either of you doing anything.

**Also fixed a repeat-notification bug** this surfaced: with background
polling now running, a not-yet-opened notification would previously have
fired again on every single poll instead of once. Notifications now track
what's already been alerted separately from what's been viewed in the
feed, so you get exactly one push per new thing.

**One more real bug caught in this pass:** custom token-economy rates
(tokens per workout/PR) were silently getting dropped on every sync and
reset to the defaults — the sync merge logic just didn't include those two
fields. Fixed.

## Shop is now its own tab, with a coin design and a roulette game

**Coin icon** — tokens now show as a custom gold coin badge (CSS-drawn,
theme-aware) instead of the 🪙 emoji, which renders as a fixed color
regardless of theme. Used consistently in the Shop tab, shop item costs,
and session-save toasts.

**Shop tab** — token balance, the shop itself (browse others' offerings,
manage your own), and the new roulette game all live in their own tab now
instead of being buried in Home.

**Token Roulette** — wager any amount up to your balance, spin, land on a
multiplier: mostly 0x (lose the wager), sometimes 0.5x–2x, rarely a 5x
jackpot (which also posts to Home and sets off confetti). Purely a private,
just-for-fun mini-game using your own token balance — no real money touches
this feature at all, the game itself is just a coin-flip dressed up nicely.

**Avatars** — profile panel → pick an emoji instead of a plain first-letter
circle. Shows up everywhere your profile appears: header, Home posts,
Friendly Competition, the profile switcher.

**Send appreciation** — Home tab, next to the gift buttons. Posts a random
warm, non-fitness-related note to the household ("is really proud of you
today, no reason needed 💛") — meant to give the app an emotional register
beyond workout stats and gym gamification.

## Token economy & shop

Every saved workout earns tokens (10 by default, +15 more per PR — both
adjustable in Settings → Token economy, shared rate for the household).
Home tab shows your balance with a **🛍️ Shop** button.

Each profile maintains their own shop: items *you're* offering, each with a
name, a token cost you set, and an optional description — completely
freeform, since this is your own private text field, same as any note in
the app. Your partner spends tokens *they've* earned to redeem from your
shop; redeeming never touches your data, only their own balance, and posts
a note to Home so you see it and can follow through. Real money, gift
cards, a chore pass, a shopping trip, whatever you two want to put in
there — it's just text and a token cost, the app doesn't know or care what
it says.

## Chirps

When you finish a workout (either from the regular Today tab or Workout
Mode), an optional message field lets you send a note along with your
completion post — type your own or tap a stock quick-pick ("Your turn!
💪", "Beat that 😏", etc.) to needle your partner into their own session.

## Fixed: bottom nav & font size

The bottom tab bar was shrinking text to force everything to fit instead
of scrolling — now it actually scrolls horizontally, so tab labels sit at
a normal, readable size (13px, up from 10.5px) no matter how many tabs
there are.

## Taylor theme + Sabrina revised

Fixed the theme swatches spilling off the screen — they scroll horizontally
now instead of overflowing.

Sabrina got a redesign: same rose/cherry/gold identity, but the dashed
borders, gingham header pattern, and bow emoji are gone in favor of a crisp
gold top-border accent and sharper corners — reads more like a fashion
editorial now than a party invite.

New **Taylor** theme: deep garnet/black background, warm ivory text,
antique gold accent, dusty rose secondary — a "quiet luxury" palette,
restrained corners, minimal ornamentation. Same rule as Sabrina: a name and
a color story I designed, not built from any real photos or specific looks.
Both get their own gold/star celebration animation on a new PR.

## Critical fix: AI key was being auto-revoked by Google (read this first)

**What was happening:** the AI key sync feature stored your raw Gemini key
inside the synced Gist. GitHub Gists don't actually have a private tier —
"secret" only means unlisted, the content is still readable by anyone with
the URL, and GitHub scans all gist content (secret or public) for exposed
API key patterns and reports them straight to the provider. Google then
auto-revokes the key within minutes, every time, permanently — this was
never a one-off glitch, it was guaranteed to keep happening as long as the
key lived in that file.

**The fix:** your Gemini key is no longer synced at all. It now lives only
on the device you enter it on, in the same local-only tier as your GitHub
token. Each person/device needs their own free key going forward — paste
it into Settings on each device separately. The next time you sync, the
app also automatically deletes the old `iron-log-data.json` file from your
Gist if it's still sitting there, since that's the file Google's notice
pointed at.

**One more step for you specifically:** the key that got revoked is dead
and can't be reused regardless — generate a completely fresh one at
aistudio.google.com/apikey, paste it into Settings on your device, and do
the same separately for your girlfriend's device.

## Getting updates without re-adding the app

iPhone home-screen apps are notoriously slow to notice new versions. Fixed
several layers of this: the service worker now bypasses the browser's own
HTTP cache (not just its own), checks for updates every time you bring the
app to the foreground, and auto-reloads once a new version takes over. As a
guaranteed fallback, **Settings → App updates → Check for updates now**
clears everything and forces a fresh load — no delete-and-re-add needed.

## Fixed: gift animation not showing after switching profiles

Real bug — "seen" status for the Home feed was tracked once per *device*,
not per *profile*. So sending a gift, then switching to the other profile
on the same device, immediately looked "already seen" since the device-wide
timestamp had just been updated by your own action. Now tracked separately
per profile, so switching profiles on one device (or two separate devices)
each correctly show unseen gifts/activity independently.

## Two more themes: Holiday & Winter

Holiday (Christmas red/green/gold) and Winter (icy blue/silver) join the
lineup — 8 themes total now. Pair either with the **Snow** background
effect (profile panel → Background effect) for a fully festive look — that
snow option already existed from the last update, alongside Petals and
Hearts.

## Notifications reaching her lock/home screen — how to actually set it up

1. She must open the app **from its home-screen icon**, not a Safari tab.
2. Needs iOS 16.4 or later.
3. In the app: **Home tab → Enable notifications on this device** (grants
   permission inside the app).
4. Then check **iPhone Settings app → Notifications → Iron Log** (it'll
   appear in that list once permission's been granted at least once) —
   make sure Allow Notifications is on, and Banners/Sounds are enabled the
   way she wants.
5. Use **Send myself a test notification** (appears next to the
   notifications toggle once enabled) to confirm it's working without
   needing a real gift or comment from you.

**Important limit, worth repeating clearly:** this fires a notification
whenever the app checks for new activity — on open, on returning from the
background, or after a sync. It does **not** wake a fully closed/locked
phone the instant something happens; that needs real push notifications,
which require a small always-on relay server to trigger delivery (still
free to build, just a separate, bigger piece of work). If instant delivery
while locked matters enough, say so and I'll scope that out properly.

## Critical fix: sync data safety (read this if you use sync)

**What happened:** connecting a brand-new device to GitHub sync for the
first time used to check "does this device have unsynced local changes?" —
and since a device that has *never* synced always looks like it does, first
connections always **pushed** local data over the shared store instead of
**pulling** it. If the connecting device only had a little (or no) local
data, this could overwrite everything already shared.

**The fix:** the whole sync architecture changed. Each profile now lives in
its own file inside the Gist (not one shared blob), and a device only ever
writes the file for the profile it currently has active, plus a merged
shared file for AI settings, the special date, and the Home feed (comments
are merged by ID, not overwritten). A device can never again write over a
profile it isn't using. First-time connections now always try to pull
first, since that's now always safe.

**Recovering lost data:** GitHub Gists keep full revision history.
1. Go to your Gist on github.com (Settings → your GitHub profile → Gists,
   or check your token's associated account).
2. Click the **Revisions** tab.
3. Find the version from just before the overwrite, open the file, copy its
   entire contents.
4. In the app: **Settings → Emergency restore** → paste it in → Restore.
5. Push to GitHub from the sync card above to make the recovery permanent
   on the shared store.

## AI calls failing after the sync incident

If AI stopped working around the same time, it's very likely the same
incident wiped the shared AI key (it lived in the same overwritten blob).
Re-enter your Gemini key in Settings, then use the new **Test connection**
button next to it — it makes one real call and tells you exactly whether it
worked or the precise error if not, rather than guessing.

## Relationship features

**Photos** — the composer on Home now has an "Attach photo" button.
Photos are resized/compressed client-side before posting to keep the synced
data small — this is a shared JSON store, not real file storage, so keep
photos occasional rather than a full photo album.

**Gifts** — 🌹 Send a rose, 💐 Send flowers, ❤️ Send love, right under the
composer. Sending one posts it to Home immediately *and* triggers a
falling-petals/hearts animation on your own screen. When your partner next
opens the app (or Home specifically) and it's unseen, the same animation
plays for them, plus a notification if they've enabled those.

**Ambient background** — profile panel → Background effect: Off, Snow,
Petals, or Hearts — a subtle, continuous particle effect behind the app
while you have it open. Personal per profile, not shared.

**Special date** — Home tab, top card. Set an anniversary or any date once
and it shows a running day count from then on (shared across the
household, syncs like everything else).

## Plan review — now actionable

"Review my week" still runs the same free, rule-based checks (volume,
recovery conflicts, missing muscle groups, rep variety, repeats). On top of
that, the AI layer now returns individual, specific suggestions — "remove
X", "add Y", "change Z's sets to 4×6-10" — each with a one-line reason
grounded in a named training principle (progressive overload, specificity,
volume landmarks, recovery, periodization). Every suggestion gets its own
**Accept** or **Dismiss** button — nothing changes your plan until you
approve it, one suggestion at a time. The prompt explicitly tells the model
to stick to mainstream, well-established resistance-training science and to
suggest fewer (or zero) changes rather than invent issues on an already
reasonable plan.

## AI plan builder

In the Plan tab, "Build my plan" asks what equipment you have, how many days
a week you want to train, and which muscle groups (if any) to emphasize,
then generates a full weekly plan. You get a preview before anything
replaces your current plan — nothing is applied automatically.

## Installing it like an app (PWA)

Iron Log is a Progressive Web App — it can live on your home screen with its
own icon and open full-screen, no browser bar, and it keeps working if you
briefly lose signal.

**On iPhone:**
1. Open your site's URL in **Safari** (this only works from Safari, not Chrome/other browsers on iOS).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

You'll get a real icon on your home screen that launches like any other app.
Do this on both your phone and your girlfriend's phone (each person adds it
once from their own Safari).

**Updating:** since it's network-first, opening the app while online always
pulls the latest version I ship — no reinstalling needed. If a device ever
seems stuck on an old version, force-close the app and reopen it, or bump
`CACHE_VERSION` in `sw.js` if you're troubleshooting yourself.

## Cross-device sync (GitHub Gist)

Settings has a "Cross-device sync" card. Create a GitHub personal access
token with only the **gist** scope (a link in Settings takes you straight
to the right token-creation page), paste it in, and the app will:

- On the first device: create a private Gist named `iron-log-data.json`
  holding your plan/logs/settings (never your API keys or the token itself).
- On any other device where you paste the *same* token: automatically find
  that Gist and pull its contents in.
- After that, any change you make (adding an exercise, logging a session,
  changing settings) automatically pushes to the Gist a few seconds later,
  and the app pulls the latest copy each time you open it.

This is last-write-wins — fine for one person using their own phone and
computer, not designed for two people editing at the exact same moment.
"Pull latest" and "Push now" buttons in Settings let you force a sync
manually if you want to be sure. If your token expires or is revoked, sync
silently stops; just generate a new one and paste it back in.

## AI assist (optional, free)

The "Get form cue" button and future exercise-suggestion features call
Google's Gemini API directly **from your browser** — get a free key at
https://aistudio.google.com/apikey, paste it into Settings, and turn AI on.
The key is only ever stored in your browser's localStorage and only ever
sent to Google, never to me or any third server. If you leave AI off (or
don't set a key), the app falls back to a small built-in library of
technique/mind-muscle cues, so it's fully useful either way.

## How the progressive-overload logic works

For each exercise you pick a rep range (e.g. 8–12). After you log a session:

- Hit the top of the range on every set with reps to spare (RPE ≤ 8.5)?
  → weight goes up next time, reps reset to the bottom of the range.
- Still under the top of the range? → same weight, chase 1–2 more reps.
- Missed the bottom of the range, or everything was max-effort (RPE ≥ 9.5)?
  → weight holds or backs off slightly.
- Every N weeks (set in Settings, default 5) → automatic deload: lighter
  load, fewer sets, explicit RPE cap, so fatigue doesn't pile up.
- Optional peak/test week on a longer cycle → a heavier, low-rep top set to
  gauge your current max.

This is a rules engine built on generally-agreed resistance-training
principles (double progression, RPE-based autoregulation, periodized
deloads) — a solid smart default, not a substitute for coaching judgment.

## "Couldn't make it today"

Hitting this on the Today tab doesn't touch your recurring weekly template —
it only reshuffles the current week, sliding today's missed session into the
next open day and pushing everything after it back by one, so you still get
the same number of sessions in. "Undo reshuffle" reverts that week back to
the normal schedule.

## Strength tiers

Bodyweight-ratio benchmarks (Untrained → Elite) for Squat, Bench, Deadlift,
Overhead Press, and Row, built from the general figures repeated across most
public strength-standard calculators. Tag an exercise in Plan with a
"counts toward tier" lift to have Stats auto-pull your logged best; otherwise
enter a number manually. Treat tiers as a motivating estimate, not a
certified test.

- **Plan review** — a "Review my week" button at the top of Plan that checks your whole week at once: volume outside typical ranges per muscle, muscle groups with no direct work, back-to-back scheduling that doesn't respect typical recovery windows, rep ranges that never vary, a single day overloaded for one muscle, and exercises repeated a lot across the week. The checks always run for free; if AI is on, a short prioritized written summary is layered on top.

## What's new in this version

- **Progress tab** — pick any exercise and see an estimated-1RM trend line over time (Epley formula), plus a consistency panel (current week streak, total sessions, 7-day adherence).
- **PR detection** — saving a session that beats your all-time best estimated 1RM for an exercise flags it right in the save confirmation.
- **Plateau detection** — if an exercise hasn't meaningfully progressed over your last 3 logged sessions despite solid effort, Today flags it and offers an AI-suggested exercise swap.
- **Warm-up ramp** — compound lifts get an auto-generated warm-up ladder (40%/60%/80% of the day's target) before your working sets.
- **Plate calculator** — "Show plates" on any compound lift breaks down exactly what to load per side, based on your bar weight and plate inventory (set in Settings).
- **Rest timer** — one tap starts a countdown seeded from the exercise's rep range (heavier/lower-rep work gets more rest), with a vibration + tone when it's up.
- **"Copy last time's numbers"** — quick-fills today's sets from your last logged session instead of typing from scratch.
- **Actual muscle map** — Recovery now shows a front/back body diagram colored by recovery %, alongside the detailed per-muscle bars.
- **Weekly volume vs. landmarks** — Stats now shows working sets per week per muscle against general MEV/MAV/MRV ranges, so you can spot muscles that are under- or over-trained in your plan.
- **Plan tab QOL** — edit an exercise in place (not just delete-and-redo), reorder exercises within a day, and copy one day's exercises onto another.

## Customizing further

Everything is plain JS in `js/` — `progression.js` for the overload rules,
`recovery.js` for the readiness model, `standards.js` for the tier tables,
`scheduler.js` for the weekly reshuffle logic, `ai.js` for the Gemini calls.
Rename the app, tweak the palette in `css/style.css` (`:root` variables at
the top), or adjust any of the constants — it's all yours to edit.
