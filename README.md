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

## Shared AI key

The Gemini key in Settings is shared across every profile rather than
per-person. Since this is still a free static site with no backend, "shared"
here means the key travels with your synced data — enter it once on one
device, and once synced, every other profile/device connected to the same
Gist can use AI features too, no separate key needed. The tradeoff: that key
is technically visible to anyone with access to your synced data, so use one
you're comfortable sharing within your household rather than a personal key
tied to a paid account.

## Themes, fonts & motion

Six themes now (profile panel): Iron, Pink, Night, plus **Sunset** (warm
coral/amber), **Neon** (purple/cyan synthwave), and **Forest** (calm green).
Each profile also picks a **font style** — Modern (the default, Space
Grotesk), Playful (rounded Baloo 2), or Classic (elegant Fraunces serif) —
right next to the theme swatches.

Small motion throughout: tabs fade in on switch, buttons give a tactile
press, cards animate in, and hitting a new PR triggers a quick confetti
burst. Respects `prefers-reduced-motion` if your device has that turned on.

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
