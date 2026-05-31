# The Greywater Gazette

*A small town that publishes a newspaper. Nobody writes it. It just keeps happening.*

Greywater Falls is a living artifact. It is a cozy little town, by a lake, that
advances one day at a time, on its own. Each day the town **ticks**: its nine
residents act on what they want and fear, their stories move, and a quiet
wrongness under the surface compounds a little further. The day is set in type
as the front page of *The Greywater Gazette*.

You do not write the paper. You read it. Open the site and find out what your
town did today.

> Cozy on the surface. The lake has gone quiet underneath. The cat came home
> wet and humming and a little too cold. Nobody is afraid yet. That is the
> point.

**Full reference:** [`docs/HANDBOOK.md`](docs/HANDBOOK.md) covers architecture,
cost, how to turn on auto-growth, troubleshooting, and future enhancements.

## How it works

```
data/world.json       the town: day number, season, weather, the undercurrent
data/residents.json   nine souls with memory, relationships, secrets, arcs
data/days/NNN.json    one published Gazette edition per day (immutable history)
data/seeds.json       the watcher's pending nudges, consumed by the next tick

app/                  the reader (Next.js, bespoke print CSS)
lib/data.ts           types + loaders shared by reader and engine
lib/director.ts       the prompt + tool schema that advance one day
scripts/tick.ts       generate the next day, apply state, write it
scripts/conjure.ts    the one lever: queue an event seed
```

The whole town's history lives in git. There is no database. Every morning is a
commit.

## The tick

```
load world + residents + recent editions + seeds
  -> the director (Claude) writes the day: a full edition + the state it leaves
  -> write days/NNN.json, update world + residents, clear consumed seeds
  -> commit -> the site rebuilds -> the new day is live
```

It is **idempotent** (it refuses to run a day that already exists) and **atomic**
(nothing is written unless the whole day generates cleanly; a failed call leaves
the town untouched and it simply tries again tomorrow). Each resident keeps only
their last six days verbatim plus a rolling backstory, so cost and context stay
flat no matter how long the town runs.

## Run it

```bash
npm install
npm run dev        # read the town locally at http://localhost:3000

# advance one day (needs a key, see below)
npm run tick
npm run tick -- --dry   # generate and print, change nothing

# the one lever
npm run conjure -- "a stranger steps off the noon bus with a dripping suitcase"
# the next tick will weave it in
```

## Letting it breathe (the handoff)

The opening ten days are already written, so the site is alive the moment it is
opened. To let the town keep going on its own, two one-time steps:

1. **Add your Claude API key as a GitHub secret.**
   Repo -> Settings -> Secrets and variables -> Actions -> New repository secret
   `ANTHROPIC_API_KEY = sk-ant-...`
   The workflow in `.github/workflows/tick.yml` then advances the town every
   morning at 06:00 WIB and commits the new edition. (You can also trigger it by
   hand from the Actions tab, or locally with `npm run tick`.)

2. **Connect this repo to Vercel** (if it is not already), so each committed day
   redeploys the site automatically. Vercel -> Add New Project -> import this repo.
   No build config needed; it is a stock Next.js app.

That is the entire ongoing cost: one API key, a few cents of generation a day,
and a town that keeps a paper without you.

## A note on the strange

It never arrives all at once. It seeps in through the classifieds and the letters
to the editor, through a welcome sign that keeps changing its count. Greywater
does not flee the strange. It accommodates it. A vigil becomes a bake sale. A
standing terror becomes a standing column. The town is well, and frightened, and
together, and home, and here those are not contradictions.

*Serving Greywater Falls since 1887, and the lake somewhat longer.*

<!-- git-integration deploy probe 20260531T193906Z -->
