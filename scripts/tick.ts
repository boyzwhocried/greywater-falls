/**
 * tick.ts — advance Greywater Falls by one day.
 *
 *   npm run tick          generate the next day, write it, commit-ready
 *   npm run tick -- --dry generate and print, change nothing on disk
 *
 * Needs ANTHROPIC_API_KEY in the environment. Idempotent: refuses to run if the
 * next day already exists. Atomic: nothing is written unless generation succeeds.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Edition, Resident, Seed, World } from "../lib/data";
import {
  SYSTEM_PROMPT,
  TICK_MODEL,
  PUBLISH_DAY_TOOL,
  buildUserPrompt,
  type PublishedDay,
} from "../lib/director";

const DATA = path.join(process.cwd(), "data");
const DAYS = path.join(DATA, "days");
const MEMORY_KEEP = 6;
const DRY = process.argv.includes("--dry");

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}
function writeJson(p: string, value: unknown): void {
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n", "utf8");
}
function pad(n: number): string {
  return String(n).padStart(3, "0");
}

function recentEditions(count: number): Edition[] {
  const files = fs
    .readdirSync(DAYS)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.slice(-count).map((f) => readJson<Edition>(path.join(DAYS, f)));
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "\n  ANTHROPIC_API_KEY is not set. The town cannot tick without it.\n" +
        "  Set it (locally: $env:ANTHROPIC_API_KEY=\"sk-ant-...\"; in CI: a repo secret) and try again.\n"
    );
    process.exit(1);
  }

  const world = readJson<World>(path.join(DATA, "world.json"));
  const residents = readJson<Resident[]>(path.join(DATA, "residents.json"));
  const seeds = (() => {
    try {
      return readJson<Seed[]>(path.join(DATA, "seeds.json"));
    } catch {
      return [];
    }
  })();

  const nextDay = world.dayNumber + 1;
  const nextPath = path.join(DAYS, `${pad(nextDay)}.json`);
  if (fs.existsSync(nextPath)) {
    console.log(`Day ${nextDay} already exists. The press has already run. Nothing to do.`);
    return;
  }

  console.log(
    `Greywater Falls is at day ${world.dayNumber} (stage ${world.undercurrent.stage}).` +
      ` Writing day ${nextDay}${seeds.length ? ` with ${seeds.length} seed(s)` : ""}...`
  );

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: TICK_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [PUBLISH_DAY_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: "publish_day" },
    messages: [{ role: "user", content: buildUserPrompt(world, residents, recentEditions(3), seeds) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The director did not return a published day. Town left untouched.");
  }
  const result = toolUse.input as PublishedDay;

  // ---- assemble the edition --------------------------------------------
  const ed = result.edition;
  if (!ed?.lead?.headline || !ed.lead.body) {
    throw new Error("Returned edition is missing its lead story. Town left untouched.");
  }
  const edition: Edition = {
    day: nextDay,
    dateline: ed.dateline,
    weather: ed.weather,
    stage: ed.stage,
    lead: { ...ed.lead, byline: ed.lead.byline || "By Wren Aldercott" },
    briefs: ed.briefs ?? [],
    classifieds: ed.classifieds ?? [],
    record: ed.record ?? [],
    letters: ed.letters ?? [],
    ...(ed.editorNote ? { editorNote: ed.editorNote } : {}),
  };

  // ---- apply state -----------------------------------------------------
  const u = result.world_update;
  const nextWorld: World = {
    ...world,
    dayNumber: nextDay,
    weather: u.weather ?? ed.weather,
    season: u.season ?? world.season,
    population: typeof u.population === "number" ? u.population : world.population,
    undercurrent: u.undercurrent ?? world.undercurrent,
  };

  const updates = new Map(result.resident_updates?.map((r) => [r.slug, r]) ?? []);
  const nextResidents: Resident[] = residents.map((r) => {
    const up = updates.get(r.slug);
    if (!up) return r;
    let line = up.new_memory.trim();
    if (!/^day\s+\d+/i.test(line)) line = `Day ${nextDay}: ${line}`;
    const memory = [...r.memory, line].slice(-MEMORY_KEEP);
    return {
      ...r,
      mood: up.mood ?? r.mood,
      status: up.status ?? r.status,
      arc: up.arc ?? r.arc,
      memory,
      backstory: up.backstory ?? r.backstory,
    };
  });

  if (DRY) {
    console.log("\n--- DAY " + nextDay + " (dry run, nothing written) ---\n");
    console.log(edition.dateline + " — stage " + edition.stage);
    console.log("\nLEAD: " + edition.lead.headline + "\n" + edition.lead.body + "\n");
    for (const b of edition.briefs) console.log("BRIEF: " + b.headline);
    console.log("\nundercurrent ->", nextWorld.undercurrent.level, "stage", nextWorld.undercurrent.stage);
    console.log("residents updated:", [...updates.keys()].join(", ") || "none");
    return;
  }

  writeJson(nextPath, edition);
  writeJson(path.join(DATA, "world.json"), nextWorld);
  writeJson(path.join(DATA, "residents.json"), nextResidents);
  writeJson(path.join(DATA, "seeds.json"), []);

  console.log(`Published day ${nextDay}: "${edition.lead.headline}"`);
  console.log(`Undercurrent now ${nextWorld.undercurrent.level} (stage ${nextWorld.undercurrent.stage}).`);
  if (seeds.length) console.log(`${seeds.length} seed(s) consumed.`);
}

main().catch((err) => {
  console.error("\nThe tick failed. The town is unchanged.\n", err?.message ?? err);
  process.exit(1);
});
