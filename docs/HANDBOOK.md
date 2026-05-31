# Greywater Falls — Handbook

*Everything about what this is, how it runs, what it costs, and where it could go.*

This is the complete reference. For the short version, read [`../README.md`](../README.md).
For the original design rationale, read [`design.md`](design.md).

---

## 1. What it is

Greywater Falls is a **living artifact**: a small fictional town, by a lake, that
advances one day at a time and publishes each day as the front page of *The
Greywater Gazette*. Cozy on the surface (bake sales, a missing cat, the weather),
strange underneath (the lake has gone quiet; the welcome sign keeps changing its
count; a cat comes home wet and humming and a little too cold).

Nobody writes the paper by hand. A "director" reads the whole town, decides what
happened today, and sets it in type. You read it.

It is not a game and not a feed. The pleasure is opening a URL and finding out
what your town did today.

- **Live:** https://greywater-falls.vercel.app
- **Repo:** https://github.com/boyzwhocried/greywater-falls (private)
- **Local:** `C:\Users\Verrel\Development\Others\greywater-falls`

---

## 2. The two questions, answered fully

### Is it totally free? Yes (as it stands). Here is exactly why.

| Piece | Provider | Tier | Cost |
|------|----------|------|------|
| Website hosting | Vercel | Hobby | **$0** |
| Source code storage | GitHub | Free (private repo) | **$0** |
| Daily automation runner | GitHub Actions | Free (2000 min/mo) | **$0** |
| Fonts | Google Fonts (self-hosted by Next) | - | **$0** |
| **Generating brand-new days** | Anthropic API | pay-per-use | **~$0.01-0.03/day, only if turned on** |

Why hosting is free: the site is **25 pre-built static HTML pages** (~282 KB
total). There is no server doing work when someone visits, just files served from
a CDN. Vercel gives that away free for personal projects. The whole town's
history is plain JSON files in the repo, so there is **no database** to pay for or
maintain.

The 10 opening days are already written and committed, so what is live right now
cost **nothing** to serve and will stay free forever, even if you never touch it
again.

The *only* thing that ever costs money is asking Claude to write a **new** day.
That is one API call per day, roughly one to three US cents. Run every single
day, that is **under $1/month**. It is currently **off**.

### Is it fully automatic? Does the story grow on its own?

**Right now: no. It is frozen at Day 10 on purpose.**

All the machinery for autonomous growth is built and in place:

- a daily schedule (GitHub Actions cron, 06:00 WIB)
- the tick engine that writes the next day
- Vercel connected to the repo, so any new commit redeploys the site

But the chain is **dormant** because the one secret it needs (your Anthropic API
key) is not set. This was deliberate: it should not spend your money without you
saying so.

While dormant, the daily job runs and **skips cleanly** (a green no-op, no error
emails). The moment you add the key, it wakes up and the town starts growing by
itself, hands-off, forever:

```
06:00 WIB cron fires
  -> GitHub Action runs the tick
  -> Claude writes tomorrow's edition + updates the town
  -> commits the new day to the repo
  -> Vercel sees the commit and rebuilds
  -> the new day is live, no input from you
```

**To turn it on:** see [Section 6](#6-waking-the-town-turning-on-auto-growth).

---

## 3. How it works (architecture)

```
                     data/ (the town's whole state + history, as JSON in git)
                       |
        +--------------+--------------+
        |                             |
   THE READER (web)            THE ENGINE (scripts)
   Next.js, static              run on demand or by cron
        |                             |
   you open the site            tick.ts writes the next day,
   and read today               conjure.ts queues a nudge
```

Two halves share one source of truth: the `data/` folder. The reader only ever
*reads* it; the engine *writes* it. Neither needs the other to be running.

### Data flow for one published day (the tick)

```
load world.json + residents.json + the last 3 editions + seeds.json
   |
   v
build a prompt: here is the town, here is what just happened, here is the
watcher's nudge (if any). Advance exactly one day.
   |
   v
Claude (claude-sonnet-4-6) returns a structured "publish_day" payload:
   - the new edition (lead story, briefs, classifieds, letters, etc.)
   - world updates (weather, season, the hidden "undercurrent")
   - per-resident updates (mood, status, arc, one new memory line)
   |
   v
write data/days/NNN.json (the new edition, immutable from here)
update world.json + residents.json
clear seeds.json
   |
   v
(in CI) commit + push -> Vercel rebuilds -> the day is live
```

### Three properties that keep it healthy over months

- **Idempotent.** The tick refuses to write a day that already exists. Running it
  twice in one day does nothing the second time.
- **Atomic.** Nothing is written unless the whole day generates cleanly. If the
  API call fails, the town is left exactly as it was and simply tries again next
  run. There is no half-written day.
- **Bounded memory.** Each resident keeps only their last 6 days verbatim plus a
  rolling "backstory" summary. So the prompt size, and therefore the cost, stays
  flat whether the town is on Day 11 or Day 1,100.

### The undercurrent engine

The strangeness has a *shape*, not random noise. A hidden `undercurrent` block in
`world.json` tracks:

- `level` (0-100): hidden pressure
- `phenomenon`: what the wrongness centres on (currently "the lake")
- `stage` (0-3): how openly the town reckons with it
  - **0** ordinary -> **1** something is off -> **2** it compounds -> **3** the town looks back
- `note`: a private instruction steering tomorrow

The director nudges `level` each day and lets the town *rationalize* the strange
until thresholds break it into the open. The reader even reflects the stage: the
paper's colour cools and fogs as the dread rises (see `app/globals.css`,
`.paper[data-stage]`).

The arc is written to **breathe**, not just escalate: after a peak, the town gets
ordinary days, small joys, the turning season. The lake is allowed to be quiet
for a week.

---

## 4. File map

```
greywater-falls/
  data/
    world.json          the town: day number, season, weather, the undercurrent
    residents.json      9 souls: personality, voice, relationships, secret, memory, arc
    days/
      001.json ...      one published edition per day (immutable history)
    seeds.json          pending watcher nudges, consumed by the next tick

  lib/
    data.ts             types + loaders (the contract shared by reader and engine)
    director.ts         the system prompt + tool schema that advance one day
    format.ts           small presentation helpers (roman numerals, stage labels)

  app/                  the reader (Next.js App Router)
    layout.tsx          fonts + metadata
    globals.css         the entire newspaper look (bespoke, no framework)
    page.tsx            "/"  today's front page
    archive/
      page.tsx          "/archive" the list of every edition
      [day]/page.tsx    "/archive/3" one past edition, with prev/next
    residents/
      page.tsx          "/residents" the townsfolk grid
      [slug]/page.tsx   "/residents/agnes-crewe" one resident
    about/page.tsx      "/about" what this is

  components/
    Gazette.tsx         renders one edition as a front page
    Chrome.tsx          top nav + footer

  scripts/
    tick.ts             advance the town one day (the engine)
    conjure.ts          queue an event seed (the watcher's one lever)

  .github/workflows/
    tick.yml            the daily cron (dormant until the API key is set)

  docs/
    design.md           why it is built this way
    HANDBOOK.md         this file
```

---

## 5. Operating it by hand

You never *have* to touch it. But if you want to:

```bash
# read the town locally
npm install
npm run dev            # http://localhost:3000

# advance one day yourself (needs the key in your shell, see below)
npm run tick
npm run tick -- --dry  # generate and PRINT the next day, write nothing

# the one lever: queue a nudge for the next tick to weave in
npm run conjure -- "a stranger steps off the noon bus with a dripping suitcase"
```

To run the tick locally you need the key in your shell for that session only:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run tick
```

Whatever the tick writes locally, commit and push it; Vercel will redeploy.

---

## 6. Waking the town (turning on auto-growth)

One step. After this, the story grows daily with zero further input.

1. Get an Anthropic API key: https://console.anthropic.com -> API Keys.
2. Add it to the repo as a secret:
   - GitHub repo -> **Settings** -> **Secrets and variables** -> **Actions**
   - **New repository secret**
   - Name: `ANTHROPIC_API_KEY`  Value: `sk-ant-...`
3. Done. Tomorrow at 06:00 WIB the town writes its own Day 11 and publishes it.
   To see it work immediately, go to the **Actions** tab -> **Daily tick** ->
   **Run workflow**.

To pause it again later: delete the secret (it goes back to a clean daily no-op),
or disable the workflow in the Actions tab.

**Spend control:** at one call/day this is well under $1/month. If you want a hard
ceiling, set a monthly budget limit in the Anthropic console. The atomic design
means a key problem or a budget cap just leaves the town unchanged that day; it
never corrupts anything.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|--------|-------|-----|
| Daily Action does nothing | No `ANTHROPIC_API_KEY` secret | Expected while dormant. Add the secret to wake it. |
| Action runs but no new day | Today already published, or the town was "quiet" | Normal. The tick is idempotent. |
| Action fails at "Advance the town" | Bad/empty key, or API/billing issue | Check the key value; check Anthropic billing. Town is untouched. |
| New day committed but site not updated | Vercel git integration disconnected | Vercel -> project -> Settings -> Git, reconnect the repo. |
| Want to undo a bad day | It is just a file | Delete `data/days/NNN.json`, restore `world.json`/`residents.json` from the prior commit, push. |

Everything is plain JSON in git, so any mistake is recoverable with normal version
control. There is nothing that can break that a `git revert` cannot fix.

---

## 8. Potential future enhancements

Roughly ordered by bang-for-effort. None are needed; the thing is complete as is.
These are where it *could* grow.

### 8.1 The Narrator: auto-post each day as a short video (high synergy)

Turn every morning's edition into a 30-60s narrated video and auto-post it to
YouTube Shorts / TikTok. Cozy-horror short-form is a strong fit, and there is
already a working `yt-shorts-bot` (the VaultOfFrights horror channel) to borrow
the publishing pipeline from.

Sketch:

```
new day committed
  -> pull the lead story + one eerie detail
  -> script a short voiceover (the lake's calm dread reads beautifully aloud)
  -> TTS (ElevenLabs or similar) + a slow drifting still / fog loop / the masthead
  -> render (the existing yt-shorts-bot already does ffmpeg assembly)
  -> auto-upload with the day's headline as the title
```

This makes the town grow an *audience* on its own, not just a back-catalogue. It
is the most interesting next step and the one with the most leverage, because the
hard parts (a daily story engine, a video bot) already exist separately. The work
is the glue.

### 8.2 Reader-submitted seeds (the lever, opened to visitors)

Add a small form on `/about`: visitors propose an event ("a circus comes to
town"). Submissions queue as moderated seeds; you approve one, the next tick
weaves it in. Turns watchers into quiet co-authors. Low effort (the seed system
already exists), high charm. Needs light moderation to stay on-tone.

### 8.3 The long cycle (multi-month emergent payoff)

Agnes's law: *"It takes in the autumn and gives back in the spring, and what comes
back you love anyway."* Right now the director honours this loosely. Make it a
real seasonal clock: have the lake genuinely *take* a resident in some future
autumn and *give back* a changed version in spring. A slow-burn arc that only
pays off if you let the town run for months. This is the soul of the concept at
full strength.

### 8.4 Per-resident point of view

Today one director writes everything. Add an optional mode where each featured
resident also writes a short first-person diary entry in their own voice, stored
per-resident. The town's truth then comes from *overlapping, contradictory*
accounts, which is richer and more literary. More API cost per day (one call per
featured resident), so make it a toggle.

### 8.5 A town that you can see

A simple visual map page: the lake, the bakery, the diner, the green house on Pell
Road, the welcome sign. Elements change with state (the sign's count, the green
house's light, the chairs left out at the shore). Static SVG driven by the same
JSON. Pure atmosphere, no new backend.

### 8.6 Daily art

Generate a single woodcut / engraving-style illustration per edition (the
masthead vignette, or the lead-story art) with an image model, cached into the
day's JSON. Big visual upgrade; adds image-gen cost per day, so gate it.

### 8.7 Subscribe to the town

An RSS feed (trivial: the editions are already structured) and/or a weekly email
digest. Lets people follow without remembering to check. RSS is nearly free to
add.

### 8.8 Deeper memory (callbacks across months)

Swap the rolling-summary memory for retrieval over the full archive (embed each
past edition, recall the relevant ones when writing today). Lets the town make
callbacks to events from fifty days ago. Only worth it once the archive is long.

### 8.9 More towns

The engine is town-agnostic; only `data/` is specific. The same code could run an
eerie outpost, a comedic apartment block, a different lake. A second town is
mostly a second `data/` seed plus a second deploy.

---

## 9. Design philosophy (so future-you keeps it honest)

- **The dread lives in the ordinary.** No gore, no jump-scares. The horror is a
  cheque the council is afraid to cash, a count that does not add up. If an
  enhancement makes it lurid, it is wrong for this town.
- **The town accommodates the strange; it does not flee it.** A vigil becomes a
  bake sale. A standing terror becomes a standing column. Warmth and fear are not
  contradictions here. Keep that.
- **It should not need you.** Every feature should preserve the core magic: a
  world that keeps happening whether or not anyone is looking.
- **Plain files, in git.** The lack of a database is a feature: the whole history
  is versioned, diffable, recoverable, and free. Resist adding infrastructure the
  story does not actually need.

*Serving Greywater Falls since 1887, and the lake somewhat longer.*
