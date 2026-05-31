# Greywater Falls — design

*A living town that publishes a newspaper. Nobody writes it. It just keeps happening.*

> **Note (v1 historical doc).** This captures the original build. Since then the
> engine gained the anti-slop safeguards and the seasons/arc director. For the
> current architecture, costs, and how to run it, see [`HANDBOOK.md`](HANDBOOK.md).

## What it is

A small fictional town that advances one day at a time, on its own. Each day the town
"ticks": residents act on their drives, threads progress, an undercurrent of quiet
wrongness compounds, and the day is published as a front page of **The Greywater
Gazette**. You read the paper. You do not write it.

It is a *living artifact*, not a game and not a feed. The pleasure is opening a URL and
finding out what your town did today.

## The three pillars

1. **Cozy surface.** Bake sales, a missing cat, HOA grievances, the weather. Small-town
   mundanity, warmly written.
2. **Strange undercurrent.** Something is quietly off and it compounds over weeks. The
   lake goes silent. Counts don't add up. The town mostly *rationalizes* it (denial is
   the cozy part) until it can't.
3. **It runs without you.** A daily tick. You are a watcher with one lever: you can
   *conjure* an event seed (a stranger arrives, a storm, a buried secret surfaces) and
   watch it ripple over the following days.

## Decisions (locked)

- **World:** Greywater Falls — cozy town, strange undercurrent.
- **Role:** watcher + occasional nudge (seed lever).
- **Output:** daily newspaper, *The Greywater Gazette*.
- **Sim engine:** director-driven tick (one orchestrator call advances the day + writes
  the edition), not agent-per-resident. Cheap, coherent, ships fast. Per-resident POV is
  a future upgrade.
- **Storage:** the world lives as versioned JSON in the repo. The town's whole history is
  in git. No database to provision.
- **Stack:** Next.js (App Router) + bespoke print CSS, deployed on Vercel.
- **Aliveness now:** the opening arc (~10 days, ~9 residents) is pre-generated so the
  site is full and alive the moment it's opened. Ongoing daily breathing is a GitHub
  Action cron that runs the tick and commits; it needs a Claude API key (documented
  one-step handoff).

## Data model

```
data/
  world.json      singleton: town meta, dayNumber, season, weather, undercurrent {level, phenomenon, stage}, editor persona
  residents.json  array of residents (name, role, voice, relationships, secret, mood, status, arc, memory)
  days/NNN.json   one published Gazette edition per day (immutable once written)
  seeds.json      pending user nudges; consumed by the next tick
```

A **day / edition** has: dateline, weather, undercurrent stage, a lead story, briefs,
classifieds, obituaries & births, letters to the editor, and an occasional editor's note.
The uncanny leaks in through the cracks of the mundane format.

## The tick (one day)

```
load world + residents + recent days + seeds
  -> director prompt: advance one day; maybe escalate undercurrent per stage rules;
     consume seeds; output JSON = new edition + state deltas
  -> Claude (structured output)
  -> write days/NNN.json, update world.json + residents.json, clear consumed seeds
  -> (CI) commit + push  ->  Vercel rebuilds the static site
```

The tick is **idempotent per day** (skip if today already published) and **atomic**
(state is only committed if generation succeeds; a failed LLM call leaves the town
untouched and it tries again next run). Memory is bounded: each resident keeps the last
N days verbatim plus a rolling summarized "life so far", so context and cost stay flat as
the town runs for months.

## The undercurrent engine

A hidden `undercurrent` state: `level` (0-100), an active `phenomenon`, and a `stage`
(0 normal -> 3 the town can no longer fully ignore). Each tick may escalate based on
level. Residents rationalize it until thresholds break it into the open. This gives the
strangeness a *shape* instead of random noise.

## The reader (web)

- `/` — today's Gazette, rendered as a real front page.
- `/archive` — scroll back through every edition; the masthead weathers as the arc darkens.
- `/residents/[slug]` — meet a resident: who they are, who they know, their current thread.
- `/about` — what this is, and how to let it keep breathing.

## The lever

`npm run conjure "a stranger arrives on the noon bus"` appends a seed to `seeds.json`.
The next tick weaves it in. Cheap, charming, optional.

## Out of scope (v1)

Player-as-resident, multiple towns, AI illustrations, accounts, social infra. The town
runs and publishes and is beautiful to read. That is v1.
