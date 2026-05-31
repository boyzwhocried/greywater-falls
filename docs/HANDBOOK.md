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
| **Generating brand-new days** | Anthropic API | pay-per-use | **~$0.02-0.06/day, only if turned on** |

Why hosting is free: the site is a set of **pre-built static HTML pages**. There is
no server doing work when someone visits, just files served from a CDN. Vercel
gives that away free for personal projects. The whole town's history is plain JSON
files in the repo, so there is **no database** to pay for or maintain.

The opening days are already written and committed, so what is live right now cost
**nothing** to serve and will stay free forever, even if you never touch it again.

The *only* thing that ever costs money is asking Claude to write a **new** day.
With the safeguards on (a writer call plus a cheap critic check), that is roughly
two to six US cents per day. Run every single day, that is **about $1-2/month**.
It is currently **off**.

### Is it fully automatic? Does the story grow on its own?

**Right now: no. It is frozen on purpose, at the end of Season 1's opening arc.**

All the machinery for autonomous growth is built and in place:

- a daily schedule (GitHub Actions cron, 06:00 WIB)
- the tick engine that writes the next day (with anti-slop safeguards, see §3)
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
  -> the arc director decides what kind of day this is (which season, which phase)
  -> Claude writes tomorrow's edition + updates the town
  -> the critic audits it; one rewrite if it is off
  -> commit the new day to the repo
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
the arc director (lib/arc.ts) decides today's SEASON + PHASE, with no LLM
   |
   v
load world.json + residents.json + canon.json + last 3 editions + recent
headlines + seeds.json, and build the prompt around the arc directive
   |
   v
Claude (claude-sonnet-4-6) returns a structured "publish_day" payload:
   - the new edition (lead story, briefs, classifieds, letters, etc.)
   - world updates (weather, season label, the hidden "undercurrent")
   - season update (carry the premise; on a coda, seed the next season)
   - per-resident updates (mood, status, arc, one new memory line)
   |
   v
the critic (claude-haiku-4-5) audits the draft against canon + recent headlines
   + the arc phase. If it flags a problem, regenerate once.
   |
   v
the tick clamps stage + undercurrent into the phase's band, folds anyone the
lake "took" into canon.gone, trims each resident's memory to the last 6 days
   |
   v
write data/days/NNN.json + world.json + residents.json (+ canon.json if someone
was taken), clear seeds.json
   |
   v
(in CI) commit + push -> Vercel rebuilds -> the day is live
```

### Three properties that keep it healthy over months

- **Idempotent.** The tick refuses to write a day that already exists. Running it
  twice in one day does nothing the second time.
- **Atomic.** Nothing is written unless the whole day generates cleanly. If a call
  fails, the town is left exactly as it was and tries again next run. There is no
  half-written day.
- **Bounded memory.** Each resident keeps only their last 6 days verbatim plus a
  rolling "backstory" summary. So the prompt size, and therefore the cost, stays
  flat whether the town is on Day 11 or Day 1,100.

### The four anti-slop safeguards (this is what makes it safe to leave running)

A daily generator with no structure becomes slop in a few weeks: it repeats
beats, contradicts itself, drifts in tone, and never ends an arc. These four
guards prevent that. They are the reason the town can run unattended.

1. **Canon** (`data/canon.json`). A short list of immutable facts (the tone law,
   the lake's law, who Agnes is, the sign reads 7, the green house occupant) that
   is injected into *every* prompt and never summarized away. It also holds
   `gone`: anyone the lake has taken, so they are never revived wrong. This kills
   contradictions.

2. **Repetition guard.** The last ~15 headlines are fed in with an explicit "do
   not re-run these beats." Stops the model re-using a good idea until it goes
   stale.

3. **Critic pass.** After the day is written, a *second, cheap* model
   (`claude-haiku-4-5`) audits it against canon, recent headlines, and the arc
   phase, looking for contradiction / repetition / tone drift / dateline errors.
   If it flags the draft, the day is regenerated once with the notes. This is what
   makes the output trustable without you watching.

4. **Arc director** (`lib/arc.ts`). The ending engine. See §3a.

### 3a. The arc director (seasons, so it never becomes endless slop)

The town runs as a **serialized anthology**. It does not run one infinite arc;
it runs **seasons**, each a complete story with a real ending, then **reseeds**
into a fresh one.

```
SEASON (about 30-44 days):
  setup      (~first 18%)   ordinary life, the faintest new thread
  rising     (~18-55%)      the strangeness compounds day by day
  cresting   (~55-78%)      the peak; it can no longer be ignored
  resolving  (~78-100%)     the town accommodates; threads tie off
  coda       (final day)    a quiet close; plant the NEXT season's seed
  -> RESEED: new season, new strangeness, residents carry their scars forward
```

The arc director is **pure code, no LLM**: it counts the days and decides today's
phase, so the model never has to. Each day it injects a directive ("you are
CRESTING, this is the peak" / "you are RESOLVING, wind it down" / "NEW SEASON,
open gently"). It also clamps the hidden undercurrent into a phase-appropriate
band, so the pressure always tracks the story shape even if the model drifts.

On a **coda** day the director asks for a `next_premise` (a *different*
strangeness), and the next day reseeds into a brand-new season built on it. The
town persists and accumulates history; no single arc ever overstays.

This is verifiable without spending anything: `npm run arc-sim` simulates ~80 days
of pure arc logic and prints the phases progressing and the seasons reseeding.
(Verified: all phases, correct order, 3 reseeds over 80 days.)

---

## 4. File map

```
greywater-falls/
  data/
    world.json          the town: day number, season label, weather, undercurrent,
                        and season_arc (the live arc state)
    residents.json      9 souls: personality, voice, relationships, secret, memory, arc
    canon.json          immutable facts + who the lake has taken + known phenomena
    days/
      001.json ...      one published edition per day (immutable history)
    seeds.json          pending watcher nudges, consumed by the next tick

  lib/
    data.ts             types + loaders (the contract shared by reader and engine)
    arc.ts              the arc director: phases, bands, reseed logic (pure, no LLM)
    director.ts         the writer prompt + the critic prompt + their tool schemas
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
    arc-sim.ts          prove the season/reseed logic with no API calls

  .github/workflows/
    tick.yml            the daily cron (dormant until the API key is set)

  docs/
    design.md           why it is built this way (v1 historical)
    HANDBOOK.md         this file
```

---

## 5. Operating it by hand

You never *have* to touch it. But if you want to:

```bash
# read the town locally
npm install
npm run dev            # http://localhost:3000

# prove the ending engine works, no API key, no cost
npm run arc-sim

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
# optional: $env:GREYWATER_NO_CRITIC = "1" skips the critic pass for a cheap test
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
3. Done. Tomorrow at 06:00 WIB the town writes its own next day and publishes it.
   To see it work immediately, go to the **Actions** tab -> **Daily tick** ->
   **Run workflow**.

To pause it again later: delete the secret (it goes back to a clean daily no-op),
or disable the workflow in the Actions tab.

**Spend control:** at one run/day this is about $1-2/month. If you want a hard
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
| A day repeats itself or drifts in tone | Critic missed it (rare) | The critic catches most; for the rest, see "undo a bad day" below. |
| Want to undo a bad day | It is just a file | Delete `data/days/NNN.json`, restore `world.json`/`residents.json`/`canon.json` from the prior commit, push. |

Everything is plain JSON in git, so any mistake is recoverable with normal version
control. There is nothing that can break that a `git revert` cannot fix.

---

## 8. Potential future enhancements

Roughly ordered by bang-for-effort. None are needed; the thing is complete and
safe to run as is. These are where it *could* grow.

### 8.1 The Narrator: auto-post each day as a short video (highest leverage)

Turn every morning's edition into a 30-60s narrated video and auto-post it to
YouTube Shorts / TikTok. Cozy-horror short-form is a strong fit, and there is
already a working `yt-shorts-bot` (the VaultOfFrights horror channel) to borrow
the publishing pipeline from.

```
new day committed
  -> pull the lead story + one eerie detail
  -> script a short voiceover (the lake's calm dread reads beautifully aloud)
  -> TTS + a slow drifting still / fog loop / the masthead
  -> render (the existing yt-shorts-bot already does ffmpeg assembly)
  -> auto-upload with the day's headline as the title
```

This makes the town grow an *audience* on its own, not just a back-catalogue. The
hard parts (a daily story engine, a video bot) already exist separately; the work
is the glue. This is the engine that makes monetization possible.

### 8.2 Reader-submitted seeds (the lever, opened to visitors)

Add a small form on `/about`: visitors propose an event ("a circus comes to
town"). Submissions queue as moderated seeds; you approve one, the next tick
weaves it in. Turns watchers into quiet co-authors. The seed system already
exists; this is mostly a form plus light moderation.

### 8.3 Surface it from bwc (subdomain, not a merge)

Put a tile on the bwc site (like the FinOS /hub link-out) pointing to a subdomain,
e.g. `greywater.boyzwhocried.xyz`, via Cloudflare DNS. Keep Greywater on its own
newspaper skin and its own deploy; do NOT merge the code into bwc (bwc has its own
DNA token system and a no-em-dash rule; Greywater is deliberately a different
universe). Surface it from bwc, let it live on its own.

### 8.4 The long cycle (multi-season emergent payoff)

The arc director already reseeds seasons. Lean into Agnes's law across them: have
the lake genuinely *take* a resident in some autumn season and *give back* a
changed version in a later spring season. The canon `gone` list already tracks the
taken, so the machinery is half there. This is the soul of the concept at full
strength.

### 8.5 Per-resident point of view

Add an optional mode where each featured resident also writes a short first-person
diary entry in their own voice. The town's truth then comes from overlapping,
contradictory accounts. More API cost per day (one call per featured resident), so
make it a toggle.

### 8.6 A town you can see

A simple visual map page: the lake, the bakery, the diner, the green house, the
welcome sign. Elements change with state (the sign's count, the green house's
light, the chairs at the shore). Static SVG driven by the same JSON. Pure
atmosphere, no new backend.

### 8.7 Daily art

Generate one woodcut/engraving-style illustration per edition with an image model,
cached into the day's JSON. Big visual upgrade; adds image-gen cost per day, so
gate it.

### 8.8 Subscribe to the town

RSS (trivial: editions are already structured) and/or a weekly email digest. Lets
people follow without remembering to check.

### 8.9 More towns

The engine is town-agnostic; only `data/` is specific. The same code could run an
eerie outpost, a comedic apartment block, a different lake. A second town is
mostly a second `data/` seed plus a second deploy. (This is also the seed of a
sellable template product.)

---

## 9. Monetization notes

This is a niche artifact; it will not be big money soon. But there is a real path,
gated on building an audience first. Ordered by realism:

1. **The Narrator (8.1) is the keystone.** No audience, no money. Daily auto-posted
   Shorts/TikToks are the only realistic path to volume, and then to platform ad
   revenue once thresholds are hit.
2. **"Conjure an event" micro-payments.** A supporter pays a few dollars (Ko-fi /
   Stripe) to inject a seed into the town. On-brand; it is literally the lever
   that already exists, opened to fans.
3. **Membership.** Patreon/Ko-fi tiers: vote on seeds, read Wren's "second set of
   notes" (the unprinted ones, already canon), get a bonus resident. Recurring.
4. **Physical objects.** Cozy-horror fans love merch. The masthead and the
   "POPULATION 7" sign are genuinely poster-worthy. Print-on-demand = no inventory.
   A printed "season zine" collecting ~30 days is a natural artifact to sell.
5. **Sell the engine as a template** (Gumroad): "deploy your own living-town
   newspaper." Bigger upside, and it doubles as dev-portfolio proof.

Realistic order if pursued: build the safeguards (done) -> turn on auto-growth ->
build the Narrator -> add a Ko-fi conjure button + a bwc tile -> consider merch /
template later.

---

## 10. Design philosophy (so future-you keeps it honest)

- **The dread lives in the ordinary.** No gore, no jump-scares. The horror is a
  cheque the council is afraid to cash, a count that does not add up. If an
  enhancement makes it lurid, it is wrong for this town.
- **The town accommodates the strange; it does not flee it.** A vigil becomes a
  bake sale. A standing terror becomes a standing column. Warmth and fear are not
  contradictions here. Keep that.
- **It should not need you.** Every feature should preserve the core magic: a
  world that keeps happening whether or not anyone is looking.
- **Seasons, not infinity.** Every arc must be able to end. The anthology shape is
  what keeps it from becoming slop. Do not remove the arc director.
- **Plain files, in git.** The lack of a database is a feature: the whole history
  is versioned, diffable, recoverable, and free. Resist adding infrastructure the
  story does not actually need.

*Serving Greywater Falls since 1887, and the lake somewhat longer.*
