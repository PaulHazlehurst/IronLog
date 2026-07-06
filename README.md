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
