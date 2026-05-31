import fs from "node:fs";
import path from "node:path";
import type { SeasonArc } from "./arc";

// ---------------------------------------------------------------------------
// Types: the shape of the town. Shared by the reader (web) and the tick engine.
// ---------------------------------------------------------------------------

export type Relationship = {
  /** slug of the other resident */
  with: string;
  /** e.g. "old friend", "rival", "son", "poker buddy" */
  type: string;
  /** one private line on where the relationship stands right now */
  note: string;
};

export type Resident = {
  slug: string;
  name: string;
  age: number;
  role: string;
  /** one or two lines of personality */
  personality: string;
  /** how they talk, for the writer's ear */
  voice: string;
  relationships: Relationship[];
  /** the thing they are not saying */
  secret: string;
  /** present mood, updated each tick */
  mood: string;
  /** "present" | "missing" | "changed" | "gone" | ... */
  status: string;
  /** the thread they are currently living through */
  arc: string;
  /** recent verbatim beats (last N days), newest last */
  memory: string[];
  /** rolling summary of everything older than `memory` */
  backstory: string;
};

export type Undercurrent = {
  /** 0-100, hidden pressure */
  level: number;
  /** what the wrongness is currently centred on */
  phenomenon: string;
  /** 0 normal, 1 small wrongness, 2 compounding, 3 cannot be ignored */
  stage: number;
  /** private note for the engine on where the arc is heading */
  note: string;
};

export type World = {
  town: string;
  motto: string;
  /** masthead volume joke, e.g. "Vol. CXXXVII" */
  volume: string;
  founded: number;
  population: number;
  season: string;
  /** the current day number; the latest published edition matches this */
  dayNumber: number;
  weather: string;
  undercurrent: Undercurrent;
  /** the editor persona who writes the paper */
  editor: { slug: string; name: string; voice: string };
  /** the season-long arc state; the ending engine. May be absent in old data. */
  season_arc?: SeasonArc;
};

/** Immutable facts always injected into the director, never summarized away.
 *  This is the anti-contradiction guard. */
export type Canon = {
  immutable: string[];
  /** residents the lake has taken across seasons; never revive them wrong */
  gone: string[];
  established_phenomena: string[];
};

export type Letter = { from: string; body: string };
export type Brief = { headline: string; body: string };
export type LeadStory = { headline: string; byline: string; body: string };

export type Edition = {
  day: number;
  /** in-world dateline, no year, e.g. "Monday, October the 6th" */
  dateline: string;
  weather: string;
  stage: number;
  lead: LeadStory;
  briefs: Brief[];
  classifieds: string[];
  /** comings, goings, births, obituaries */
  record: string[];
  letters: Letter[];
  editorNote?: string;
};

export type Seed = {
  /** ISO timestamp the seed was conjured */
  at: string;
  /** the nudge, e.g. "a stranger arrives on the noon bus" */
  text: string;
};

// ---------------------------------------------------------------------------
// Loaders. The town lives as JSON on disk; read it at build time.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  return JSON.parse(raw) as T;
}

export function getWorld(): World {
  return readJson<World>("world.json");
}

export function getResidents(): Resident[] {
  return readJson<Resident[]>("residents.json");
}

export function getResident(slug: string): Resident | undefined {
  return getResidents().find((r) => r.slug === slug);
}

export function getSeeds(): Seed[] {
  try {
    return readJson<Seed[]>("seeds.json");
  } catch {
    return [];
  }
}

export function getCanon(): Canon {
  try {
    return readJson<Canon>("canon.json");
  } catch {
    return { immutable: [], gone: [], established_phenomena: [] };
  }
}

/** Every published edition, oldest first. */
export function getAllEditions(): Edition[] {
  const dir = path.join(DATA_DIR, "days");
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Edition);
}

export function getEdition(day: number): Edition | undefined {
  return getAllEditions().find((e) => e.day === day);
}

export function getLatestEdition(): Edition | undefined {
  const all = getAllEditions();
  return all[all.length - 1];
}

/** The most recent N lead+brief headlines, newest first. Feeds the repetition
 *  guard so the director does not re-run beats it just ran. */
export function getRecentHeadlines(count: number): string[] {
  const all = getAllEditions();
  const lines: string[] = [];
  for (let i = all.length - 1; i >= 0 && lines.length < count; i--) {
    const e = all[i];
    lines.push(e.lead.headline);
    for (const b of e.briefs) {
      if (lines.length < count) lines.push(b.headline);
    }
  }
  return lines.slice(0, count);
}
