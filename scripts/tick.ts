/**
 * tick.ts — advance Greywater Falls by one day.
 *
 *   npm run tick               generate the next day, write it, commit-ready
 *   npm run tick -- --dry      generate and print, change nothing on disk
 *
 * Env:
 *   ANTHROPIC_API_KEY          required
 *   GREYWATER_NO_CRITIC=1      skip the critic pass (cheaper, for quick tests)
 *
 * Idempotent: refuses to run if the next day already exists.
 * Atomic: nothing is written unless the whole day generates cleanly.
 *
 * Safeguards (the anti-slop bundle):
 *   1. Canon         immutable facts always in context  (data/canon.json)
 *   2. Repetition    recent headlines fed in, "do not repeat"
 *   3. Critic        a cheap second pass audits each day, one regeneration
 *   4. Arc director  seasons that resolve and reseed     (lib/arc.ts)
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic, {
  RateLimitError,
  InternalServerError,
  APIConnectionError,
  APIConnectionTimeoutError,
} from "@anthropic-ai/sdk";
import type { Canon, Edition, Resident, Seed, World } from "../lib/data";
import {
  SYSTEM_PROMPT,
  TICK_MODEL,
  CRITIC_MODEL,
  CRITIC_SYSTEM,
  PUBLISH_DAY_TOOL,
  CRITIQUE_TOOL,
  buildUserPrompt,
  buildCriticPrompt,
  type PublishedDay,
  type Critique,
} from "../lib/director";
import {
  planNextTick,
  undercurrentBandFor,
  targetLengthForSeason,
  type SeasonArc,
} from "../lib/arc";

const DATA = path.join(process.cwd(), "data");
const DAYS = path.join(DATA, "days");
const MEMORY_KEEP = 6;
const DRY = process.argv.includes("--dry");
const NO_CRITIC = process.env.GREYWATER_NO_CRITIC === "1";

const RETRYABLE_ERRORS = [RateLimitError, InternalServerError, APIConnectionError, APIConnectionTimeoutError];

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = RETRYABLE_ERRORS.some((E) => err instanceof E);
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.warn(`Retry ${attempt}/${maxRetries} after ${delay / 1000}s: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}
function writeJson(p: string, value: unknown): void {
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n", "utf8");
}
function pad(n: number): string {
  return String(n).padStart(3, "0");
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function recentEditions(count: number): Edition[] {
  const files = fs.readdirSync(DAYS).filter((f) => f.endsWith(".json")).sort();
  return files.slice(-count).map((f) => readJson<Edition>(path.join(DAYS, f)));
}

function recentHeadlines(count: number): string[] {
  const eds = recentEditions(8);
  const lines: string[] = [];
  for (let i = eds.length - 1; i >= 0 && lines.length < count; i--) {
    lines.push(eds[i].lead.headline);
    for (const b of eds[i].briefs) if (lines.length < count) lines.push(b.headline);
  }
  return lines.slice(0, count);
}

/** A sensible default arc state for data that predates seasons. */
function ensureSeasonArc(world: World): SeasonArc {
  if (world.season_arc) return world.season_arc;
  return {
    number: 1,
    premise: "the lake wakes and counts the town",
    day_in_season: world.dayNumber,
    target_length: targetLengthForSeason(1),
    next_premise: "",
  };
}

async function generateDay(
  client: Anthropic,
  basePrompt: string,
  fixNote: string | null
): Promise<PublishedDay> {
  const content = fixNote
    ? `${basePrompt}\n\n## The editor flagged the previous draft. Rewrite the day fixing these:\n${fixNote}`
    : basePrompt;
  const message = await client.messages.create({
    model: TICK_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [PUBLISH_DAY_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: "publish_day" },
    messages: [{ role: "user", content }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The director did not return a published day. Town left untouched.");
  }
  return toolUse.input as PublishedDay;
}

async function critique(
  client: Anthropic,
  args: { edition: Omit<Edition, "day">; canon: Canon; directive: string; recentHeadlines: string[]; prevDateline: string }
): Promise<Critique> {
  const message = await client.messages.create({
    model: CRITIC_MODEL,
    max_tokens: 1024,
    system: CRITIC_SYSTEM,
    tools: [CRITIQUE_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: "critique" },
    messages: [{ role: "user", content: buildCriticPrompt(args) }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // If the critic itself fails, do not block publication.
    return { verdict: "ok", worst: "none", issues: [] };
  }
  return toolUse.input as Critique;
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "\n  ANTHROPIC_API_KEY is not set. The town cannot tick without it.\n" +
        '  Set it (locally: $env:ANTHROPIC_API_KEY="sk-ant-..."; in CI: a repo secret) and try again.\n'
    );
    process.exit(1);
  }

  const world = readJson<World>(path.join(DATA, "world.json"));
  const residents = readJson<Resident[]>(path.join(DATA, "residents.json"));
  const canon: Canon = (() => {
    try {
      return readJson<Canon>(path.join(DATA, "canon.json"));
    } catch {
      return { immutable: [], gone: [], established_phenomena: [] };
    }
  })();
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

  // ---- the arc director decides what kind of day this is ----------------
  const prevArc = ensureSeasonArc(world);
  const plan = planNextTick(prevArc);
  const band = undercurrentBandFor(plan.phase);

  console.log(
    `Greywater Falls at day ${world.dayNumber}. Writing day ${nextDay} — ` +
      `Season ${plan.season.number}, ${plan.phase}` +
      (plan.reseed ? " (RESEED, new season)" : "") +
      `${seeds.length ? `, ${seeds.length} seed(s)` : ""}...`
  );

  const client = new Anthropic({ apiKey });
  const basePrompt = buildUserPrompt({
    world,
    residents,
    recentEditions: recentEditions(3),
    seeds,
    canon,
    recentHeadlines: recentHeadlines(15),
    directive: plan.directive,
    nextDay,
  });

  // ---- generate, then critique, then regenerate once if flagged --------
  let result = await withRetry(() => generateDay(client, basePrompt, null), "generateDay");
  if (!NO_CRITIC) {
    let verdict: { verdict: "ok" | "revise"; worst: string; issues: string[] };
    try {
      verdict = await withRetry(
        () => critique(client, {
          edition: result.edition,
          canon,
          directive: plan.directive,
          recentHeadlines: recentHeadlines(15),
          prevDateline: recentEditions(1)[0]?.dateline ?? "(none)",
        }),
        "critique"
      );
    } catch (err) {
      console.warn(`Critic unavailable after retries: ${(err as Error).message}. Publishing without critic review.`);
      verdict = { verdict: "ok", worst: "none", issues: [] };
    }
    if (verdict.verdict === "revise") {
      console.log(`Critic flagged (${verdict.worst}): ${verdict.issues.join("; ")}. Regenerating once...`);
      result = await withRetry(() => generateDay(client, basePrompt, verdict.issues.join("; ")), "generateDay (retry)");
      let second: { verdict: string; worst: string; issues: string[] };
      try {
        second = await withRetry(
          () => critique(client, {
            edition: result.edition,
            canon,
            directive: plan.directive,
            recentHeadlines: recentHeadlines(15),
            prevDateline: recentEditions(1)[0]?.dateline ?? "(none)",
          }),
          "critique (retry)"
        );
      } catch (err) {
        console.warn(`Critic unavailable after retries: ${(err as Error).message}. Publishing without second review.`);
        second = { verdict: "ok", worst: "none", issues: [] };
      }
      if (second.verdict === "revise") {
        // Better to publish a slightly-off day than to stall the town forever.
        console.warn(`Critic still flags (${second.worst}): ${second.issues.join("; ")}. Publishing best effort.`);
      }
    } else {
      console.log("Critic: ok.");
    }
  }

  // ---- assemble the edition --------------------------------------------
  const ed = result.edition;
  if (!ed?.lead?.headline || !ed.lead.body) {
    throw new Error("Returned edition is missing its lead story. Town left untouched.");
  }

  // The arc owns stage + the undercurrent band; clamp the model into them so the
  // hidden pressure always tracks the story shape.
  const modelLevel = result.world_update?.undercurrent?.level ?? world.undercurrent.level;
  const level = clamp(modelLevel, band.min, band.max);
  const stage = band.stage;

  const edition: Edition = {
    day: nextDay,
    dateline: ed.dateline,
    weather: ed.weather,
    stage,
    lead: { ...ed.lead, byline: ed.lead.byline || "By Wren Aldercott" },
    briefs: ed.briefs ?? [],
    classifieds: ed.classifieds ?? [],
    record: ed.record ?? [],
    letters: ed.letters ?? [],
    ...(ed.editorNote ? { editorNote: ed.editorNote } : {}),
  };

  // ---- apply world + arc state -----------------------------------------
  const u = result.world_update;
  const su = result.season_update ?? { premise: plan.season.premise };
  const nextSeason: SeasonArc = {
    ...plan.season,
    // let the director carry/refine the premise text, but the NUMBER, day, and
    // target_length are the arc's to own.
    premise: plan.reseed ? plan.season.premise : su.premise || plan.season.premise,
    next_premise: su.next_premise?.trim() ? su.next_premise.trim() : plan.season.next_premise,
  };

  const nextWorld: World = {
    ...world,
    dayNumber: nextDay,
    weather: u?.weather ?? ed.weather,
    season: u?.season ?? world.season,
    population: typeof u?.population === "number" ? u.population : world.population,
    undercurrent: {
      level,
      stage,
      phenomenon: u?.undercurrent?.phenomenon ?? world.undercurrent.phenomenon,
      note: u?.undercurrent?.note ?? world.undercurrent.note,
    },
    season_arc: nextSeason,
  };

  // ---- apply residents (bounded memory) + track the taken --------------
  const updates = new Map(result.resident_updates?.map((r) => [r.slug, r]) ?? []);
  const newlyGone: string[] = [];
  const nextResidents: Resident[] = residents.map((r) => {
    const up = updates.get(r.slug);
    if (!up) return r;
    let line = up.new_memory.trim();
    if (!/^day\s+\d+/i.test(line)) line = `Day ${nextDay}: ${line}`;
    const status = up.status ?? r.status;
    if (/\b(gone|taken)\b/i.test(status) && !/\b(gone|taken)\b/i.test(r.status)) {
      newlyGone.push(r.name);
    }
    return {
      ...r,
      mood: up.mood ?? r.mood,
      status,
      arc: up.arc ?? r.arc,
      memory: [...r.memory, line].slice(-MEMORY_KEEP),
      backstory: up.backstory ?? r.backstory,
    };
  });

  // Anyone the lake took joins canon.gone so they are never revived wrong.
  const nextCanon: Canon = newlyGone.length
    ? { ...canon, gone: [...canon.gone, ...newlyGone] }
    : canon;

  if (DRY) {
    console.log(`\n--- DAY ${nextDay} (dry run, nothing written) ---`);
    console.log(`${edition.dateline} — Season ${nextSeason.number} ${plan.phase}, stage ${stage}, level ${level}`);
    console.log(`\nLEAD: ${edition.lead.headline}\n${edition.lead.body}\n`);
    for (const b of edition.briefs) console.log(`BRIEF: ${b.headline}`);
    if (nextSeason.next_premise) console.log(`\nnext season premise: ${nextSeason.next_premise}`);
    if (newlyGone.length) console.log(`taken by the lake: ${newlyGone.join(", ")}`);
    console.log(`residents updated: ${[...updates.keys()].join(", ") || "none"}`);
    return;
  }

  writeJson(nextPath, edition);
  writeJson(path.join(DATA, "world.json"), nextWorld);
  writeJson(path.join(DATA, "residents.json"), nextResidents);
  if (newlyGone.length) writeJson(path.join(DATA, "canon.json"), nextCanon);
  writeJson(path.join(DATA, "seeds.json"), []);

  console.log(`Published day ${nextDay}: "${edition.lead.headline}"`);
  console.log(
    `Season ${nextSeason.number}, day ${nextSeason.day_in_season}/${nextSeason.target_length} (${plan.phase}); ` +
      `undercurrent ${level} (stage ${stage}).`
  );
  if (plan.reseed) console.log(`A new season has begun: "${nextSeason.premise}".`);
  if (newlyGone.length) console.log(`The lake took: ${newlyGone.join(", ")}.`);
  if (seeds.length) console.log(`${seeds.length} seed(s) consumed.`);
}

main().catch((err) => {
  console.error("\nThe tick failed. The town is unchanged.\n", err?.message ?? err);
  process.exit(1);
});
