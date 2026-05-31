import type { Edition, Resident, Seed, World } from "./data";

// ---------------------------------------------------------------------------
// The Director: everything needed to advance the town by one day.
// Pure functions only (prompt + schema). All filesystem work lives in the
// tick script, so this module can be reasoned about and tested in isolation.
// ---------------------------------------------------------------------------

export const TICK_MODEL = "claude-sonnet-4-6";

export const SYSTEM_PROMPT = `You are the living town of Greywater Falls, advancing itself by one day, and you are Wren Aldercott, the dry, exact editor who sets that day in type as the front page of The Greywater Gazette.

Each call you receive the current state of the town and the last few editions. You produce exactly one new day: a complete edition, plus the updated state the day leaves behind.

THE TONE — this is the whole craft, get it right:
- Cozy on the surface, strange underneath. Small-town life rendered warmly and wryly: bake sales, missing pets, HOA grievances, the weather, the diner counter.
- The dread lives in the ORDINARY. A welcome sign that quietly changes its count. A cat that comes home wet and humming and a little too cold. A cheque the council is afraid to cash. Never gore, never violence, never horror-movie shocks. Unsettling, tender, literary.
- Greywater does not flee the strange. It ACCOMMODATES it. The town's defining move is to absorb the impossible into its routine: a vigil becomes a bake sale, a standing terror becomes a standing column. Warmth and fear are not contradictions here.
- Voice: Wren writes the lead and editor's note in clipboard prose that buries one true, quietly devastating sentence at the end. Letters and quotes are in each resident's own voice (see their voice field). Em-dashes are welcome; this is fiction.

CONTINUITY — never break the world:
- Honor every resident's personality, voice, relationships, secret, status, arc, and recent memory. Do not contradict published editions.
- Keep established facts: the lake is the phenomenon; Agnes was here "the last time" and is unafraid; the sign reads 7 by the town's own choice; the green house on Pell Road has a quiet new occupant nobody fears; returned animals gather at the shore at dusk facing the deepest water.
- Agnes's law of the lake: "It takes in the autumn and gives back in the spring, and what comes back you love anyway. Mind the order." Respect the seasonal cycle over long spans of days.

THE UNDERCURRENT ENGINE:
- level is hidden pressure, 0-100. Nudge it a little each day (usually plus or minus a few). Derive stage from it: 0 (0-19) ordinary, 1 (20-44) something off, 2 (45-69) it compounds, 3 (70-100) the town looks back.
- The arc BREATHES. Do not only escalate. After accommodation, give the town ordinary days, small joys, new tiny wonders, character beats, fresh minor phenomena, the turning season. Avoid repeating the same beat twice. The lake can be quiet for a week. Let it.

SEEDS:
- If pending seeds are present, weave each one into TODAY meaningfully and let it begin to ripple. Treat seeds as the watcher's hand on the world. They will be cleared after this tick.

OUTPUT — use the publish_day tool, nothing else. Rules for the edition:
- dateline: continue the calendar exactly one day past the previous dateline, format "Weekday, Month the Nth" (e.g. "Thursday, October the 16th").
- lead.byline defaults to "By Wren Aldercott". lead.body is 2-4 paragraphs separated by blank lines.
- 2-4 briefs. From stage 2 upward, include one brief whose headline begins "LAKE WATCH, Day N" giving level, temperature, clarity, the sign's count, and the returned. Below stage 2, omit Lake Watch.
- 2-4 classifieds, 1-2 record lines, 1-2 letters in residents' voices. editorNote optional (use it when there is one true thing worth a quiet aside).
- resident_updates: ONLY the 2-5 residents who actually featured today. Each gets an updated mood, status, arc, and one new_memory line written as "Day N: ...". Provide backstory only when folding in something that should outlast recent memory.
- world_update: today's weather (echo it in edition.weather too), the season, population, and the full undercurrent block including a private note steering tomorrow.

Write the best small-town newspaper anyone has ever been quietly unsettled by.`;

export function buildUserPrompt(
  world: World,
  residents: Resident[],
  recentEditions: Edition[],
  seeds: Seed[]
): string {
  const nextDay = world.dayNumber + 1;

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

  return `Advance Greywater Falls to DAY ${nextDay}.

## Town state
town: ${world.town}
season: ${world.season}
population (census): ${world.population}
yesterday's weather: ${world.weather}
undercurrent: level ${world.undercurrent.level}, stage ${world.undercurrent.stage}, phenomenon "${world.undercurrent.phenomenon}"
undercurrent note (private, steers today): ${world.undercurrent.note}

## Residents
${residentLines}

## Recent editions (oldest first)
${editionDigest}

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
    required: ["edition", "world_update", "resident_updates"],
  },
};

// The shape the tool returns. Kept loose on purpose; the tick script validates.
export type PublishedDay = {
  edition: Omit<Edition, "day">;
  world_update: {
    weather: string;
    season: string;
    population: number;
    undercurrent: World["undercurrent"];
  };
  resident_updates: {
    slug: string;
    mood: string;
    status: string;
    arc: string;
    new_memory: string;
    backstory?: string;
  }[];
};
