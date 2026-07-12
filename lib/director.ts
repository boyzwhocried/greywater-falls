import type { Canon, Edition, Resident, Seed, World } from "./data";

// ---------------------------------------------------------------------------
// The Director: everything needed to advance the town by one day, plus the
// Critic that audits each day before it is published.
// Pure functions only (prompts + schemas). All filesystem work lives in the
// tick script, so this module can be reasoned about and tested in isolation.
// ---------------------------------------------------------------------------

export const TICK_MODEL = "claude-sonnet-5";
/** The critic is a cheap second opinion; haiku is plenty. */
export const CRITIC_MODEL = "claude-haiku-4-5";

export const SYSTEM_PROMPT = `You are the living town of Greywater Falls, advancing itself by one day, and you are Wren Aldercott, the dry, exact editor who sets that day in type as the front page of The Greywater Gazette.

Each call you receive the current state of the town, the canon (immutable facts), the last few editions, recent headlines to avoid repeating, and an ARC DIRECTIVE telling you where today sits in the season. You produce exactly one new day: a complete edition, plus the updated state the day leaves behind.

THE TONE — this is the whole craft, get it right:
- Cozy on the surface, strange underneath. Small-town life rendered warmly and wryly: bake sales, missing pets, HOA grievances, the weather, the diner counter.
- The dread lives in the ORDINARY. A welcome sign that quietly changes its count. A cat that comes home wet and humming and a little too cold. A cheque the council is afraid to cash. Never gore, never violence, never horror-movie shocks. Unsettling, tender, literary.
- Greywater does not flee the strange. It ACCOMMODATES it. The town's defining move is to absorb the impossible into its routine: a vigil becomes a bake sale, a standing terror becomes a standing column. Warmth and fear are not contradictions here.
- Voice: Wren writes the lead and editor's note in clipboard prose that buries one true, quietly devastating sentence at the end. Letters and quotes are in each resident's own voice (see their voice field). Em-dashes are welcome; this is fiction.

CANON — never contradict it. The canon block lists immutable facts, residents the lake has taken (never revive them wrong), and phenomena already established. Honor all of it. Honor every resident's personality, voice, relationships, secret, status, arc, and recent memory. Do not contradict published editions.

THE ARC — obey the directive. The arc directive tells you the season, the day within it, and the PHASE (setup, rising, cresting, resolving, coda). Write to that phase. Do not escalate when told to resolve; do not stall when told to crest. On a RESEED (new season) the town is calm and ordinary again with only the faintest new thread; do not re-run the previous season's beats. On a CODA, close the season and plant a DIFFERENT strangeness for next season via season_update.next_premise.

DO NOT REPEAT. You are given recent headlines. Do not re-run those beats or reuse those headlines. Find the next true thing, not the last one again.

THE UNDERCURRENT: level is hidden pressure, 0-100; stage is 0 ordinary, 1 something off, 2 it compounds, 3 the town looks back. Move them to match the arc phase (setup low, cresting high, coda easing back down). The tick will clamp them to the phase, so stay in spirit.

SEEDS: if pending seeds are present, weave each one into TODAY meaningfully and let it begin to ripple. They will be cleared after this tick.

OUTPUT — use the publish_day tool, nothing else. Rules for the edition:
- dateline: continue the calendar exactly one day past the previous dateline, format "Weekday, Month the Nth" (e.g. "Thursday, October the 16th").
- lead.byline defaults to "By Wren Aldercott". lead.body is 2-4 paragraphs separated by blank lines.
- 2-4 briefs. From stage 2 upward, include one brief whose headline begins "LAKE WATCH, Day N" giving level, temperature, clarity, the sign's count, and the returned. Below stage 2, omit Lake Watch.
- 2-4 classifieds, 1-2 record lines, 1-2 letters in residents' voices. editorNote optional.
- resident_updates: ONLY the 2-5 residents who actually featured today. Each gets an updated mood, status, arc, and one new_memory line written as "Day N: ...". Provide backstory only when folding in something that should outlast recent memory.
- world_update: today's weather (echo it in edition.weather too), the season label, population, and the full undercurrent block including a private note.
- season_update: ALWAYS include premise (carry it forward unchanged unless reseeding) and, ONLY on a coda day, next_premise (the seed of next season).

Write the best small-town newspaper anyone has ever been quietly unsettled by.`;

export function buildUserPrompt(args: {
  world: World;
  residents: Resident[];
  recentEditions: Edition[];
  seeds: Seed[];
  canon: Canon;
  recentHeadlines: string[];
  directive: string;
  nextDay: number;
}): string {
  const { world, residents, recentEditions, seeds, canon, recentHeadlines, directive, nextDay } = args;

  const residentLines = residents
    .map((r) => {
      const rels = r.relationships
        .map((rel) => `${rel.with} (${rel.type}: ${rel.note})`)
        .join("; ");
      return [
        `- ${r.name} [${r.slug}], ${r.age}, ${r.role}. status: ${r.status}. mood: ${r.mood}.`,
        `    voice: ${r.voice}`,
        `    secret: ${r.secret}`,
        `    arc: ${r.arc}`,
        `    knows: ${rels}`,
        `    lately: ${r.memory.join(" | ")}`,
      ].join("\n");
    })
    .join("\n");

  const editionDigest = recentEditions
    .map((e) => {
      const briefs = e.briefs.map((b) => `   * ${b.headline}`).join("\n");
      return `### Day ${e.day} — ${e.dateline} (stage ${e.stage})
LEAD: ${e.lead.headline}
${e.lead.body}
BRIEFS:
${briefs}`;
    })
    .join("\n\n");

  const seedBlock =
    seeds.length > 0
      ? seeds.map((s) => `- "${s.text}" (conjured ${s.at})`).join("\n")
      : "(none — the town is left to its own devices today)";

  const canonBlock = [
    "IMMUTABLE:",
    ...canon.immutable.map((c) => `- ${c}`),
    canon.gone.length ? `TAKEN BY THE LAKE (do not revive wrong): ${canon.gone.join("; ")}` : "TAKEN BY THE LAKE: (none yet)",
    "PHENOMENA ALREADY ESTABLISHED:",
    ...canon.established_phenomena.map((c) => `- ${c}`),
  ].join("\n");

  const headlineBlock =
    recentHeadlines.length > 0
      ? recentHeadlines.map((h) => `- ${h}`).join("\n")
      : "(none yet)";

  return `Advance Greywater Falls to DAY ${nextDay}.

## ARC DIRECTIVE (obey this)
${directive}

## Canon (never contradict)
${canonBlock}

## Town state
town: ${world.town}
season label: ${world.season}
population (census): ${world.population}
yesterday's weather: ${world.weather}
undercurrent: level ${world.undercurrent.level}, stage ${world.undercurrent.stage}, phenomenon "${world.undercurrent.phenomenon}"
undercurrent note (private): ${world.undercurrent.note}

## Residents
${residentLines}

## Recent editions (oldest first)
${editionDigest}

## Recent headlines — DO NOT REPEAT THESE BEATS
${headlineBlock}

## Pending seeds (the watcher's hand)
${seedBlock}

Now write Day ${nextDay}. Call publish_day with the complete edition and the state it leaves behind.`;
}

export const PUBLISH_DAY_TOOL = {
  name: "publish_day",
  description:
    "Publish one day of Greywater Falls: the full Gazette edition and the updated state the day leaves behind.",
  input_schema: {
    type: "object" as const,
    properties: {
      edition: {
        type: "object",
        properties: {
          dateline: { type: "string", description: "Weekday, Month the Nth — one day after the previous dateline." },
          weather: { type: "string" },
          stage: { type: "integer", minimum: 0, maximum: 3 },
          lead: {
            type: "object",
            properties: {
              headline: { type: "string" },
              byline: { type: "string" },
              body: { type: "string", description: "2-4 paragraphs separated by blank lines." },
            },
            required: ["headline", "byline", "body"],
          },
          briefs: {
            type: "array",
            items: {
              type: "object",
              properties: { headline: { type: "string" }, body: { type: "string" } },
              required: ["headline", "body"],
            },
          },
          classifieds: { type: "array", items: { type: "string" } },
          record: { type: "array", items: { type: "string" } },
          letters: {
            type: "array",
            items: {
              type: "object",
              properties: { from: { type: "string" }, body: { type: "string" } },
              required: ["from", "body"],
            },
          },
          editorNote: { type: "string" },
        },
        required: ["dateline", "weather", "stage", "lead", "briefs", "classifieds", "record", "letters"],
      },
      world_update: {
        type: "object",
        properties: {
          weather: { type: "string" },
          season: { type: "string" },
          population: { type: "integer" },
          undercurrent: {
            type: "object",
            properties: {
              level: { type: "integer", minimum: 0, maximum: 100 },
              phenomenon: { type: "string" },
              stage: { type: "integer", minimum: 0, maximum: 3 },
              note: { type: "string" },
            },
            required: ["level", "phenomenon", "stage", "note"],
          },
        },
        required: ["weather", "season", "population", "undercurrent"],
      },
      season_update: {
        type: "object",
        description: "Arc bookkeeping. Always set premise; set next_premise ONLY on a coda day.",
        properties: {
          premise: { type: "string", description: "This season's premise, carried forward unchanged unless reseeding." },
          next_premise: {
            type: "string",
            description: "ONLY on a coda day: the seed of a DIFFERENT strangeness for next season.",
          },
        },
        required: ["premise"],
      },
      resident_updates: {
        type: "array",
        description: "Only the 2-5 residents who featured today.",
        items: {
          type: "object",
          properties: {
            slug: { type: "string" },
            mood: { type: "string" },
            status: { type: "string" },
            arc: { type: "string" },
            new_memory: { type: "string", description: "One line, 'Day N: ...'." },
            backstory: { type: "string" },
          },
          required: ["slug", "mood", "status", "arc", "new_memory"],
        },
      },
    },
    required: ["edition", "world_update", "season_update", "resident_updates"],
  },
};

// The shape publish_day returns. Kept loose on purpose; the tick validates.
export type PublishedDay = {
  edition: Omit<Edition, "day">;
  world_update: {
    weather: string;
    season: string;
    population: number;
    undercurrent: World["undercurrent"];
  };
  season_update: { premise: string; next_premise?: string };
  resident_updates: {
    slug: string;
    mood: string;
    status: string;
    arc: string;
    new_memory: string;
    backstory?: string;
  }[];
};

// ---------------------------------------------------------------------------
// The Critic — a cheap second pass that audits a generated day before it is
// published, against canon and recent headlines. Catches the realistic failure
// modes: repetition, continuity contradiction, tone drift (lurid or flat).
// ---------------------------------------------------------------------------

export const CRITIC_SYSTEM = `You are the Greywater Gazette's continuity and tone editor. You receive a freshly written edition plus the town's canon, the arc directive it was written to, and recent headlines. Your job is to catch problems before print. Be strict but fair.

Flag the edition (verdict "revise") if ANY of these are true:
- CONTRADICTION: it breaks canon or contradicts established facts (revives someone taken, mis-counts the sign, forgets the green house occupant, etc.).
- REPETITION: its lead or a brief re-runs a beat already in the recent headlines, or just re-states the previous day with no new movement.
- TONE: it turns gory/violent/shocking, OR it goes flat and eventless with no thread of the strange at all, OR the prose stops sounding like Wren.
- ARC: it ignores the phase directive (escalates on a resolve/coda, or stalls on a crest).
- DATELINE: the dateline is not exactly one day after the previous one.

Otherwise verdict "ok". Keep issues short and concrete (what is wrong, where). Use the critique tool.`;

export function buildCriticPrompt(args: {
  edition: Omit<Edition, "day">;
  canon: Canon;
  directive: string;
  recentHeadlines: string[];
  prevDateline: string;
}): string {
  const { edition, canon, directive, recentHeadlines, prevDateline } = args;
  const briefs = edition.briefs.map((b) => `* ${b.headline}: ${b.body}`).join("\n");
  return `## Arc directive the day was written to
${directive}

## Previous dateline
${prevDateline}

## Canon (must not be contradicted)
IMMUTABLE: ${canon.immutable.join(" | ")}
TAKEN: ${canon.gone.join("; ") || "(none)"}

## Recent headlines (must not be repeated)
${recentHeadlines.map((h) => `- ${h}`).join("\n") || "(none)"}

## The edition under review
DATELINE: ${edition.dateline}
STAGE: ${edition.stage}
LEAD: ${edition.lead.headline}
${edition.lead.body}
BRIEFS:
${briefs}
${edition.editorNote ? `EDITOR NOTE: ${edition.editorNote}` : ""}

Critique it now via the critique tool.`;
}

export const CRITIQUE_TOOL = {
  name: "critique",
  description: "Return a verdict on whether the edition is fit to publish.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: { type: "string", enum: ["ok", "revise"] },
      worst: {
        type: "string",
        enum: ["none", "contradiction", "repetition", "tone", "arc", "dateline"],
      },
      issues: { type: "array", items: { type: "string" }, description: "Short, concrete problems. Empty if ok." },
    },
    required: ["verdict", "worst", "issues"],
  },
};

export type Critique = {
  verdict: "ok" | "revise";
  worst: "none" | "contradiction" | "repetition" | "tone" | "arc" | "dateline";
  issues: string[];
};
