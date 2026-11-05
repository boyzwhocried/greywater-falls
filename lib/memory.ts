// ---------------------------------------------------------------------------
// Hierarchical memory: a one-line summary per day, a summary per finished
// season, and a growing list of canon facts. Lets the model "remember" 100+
// days without re-reading old editions. Pure functions, no I/O.
// ---------------------------------------------------------------------------

export const MAX_CANON_FACTS = 40;

export type DaySummary = { day: number; summary: string };
export type SeasonSummary = { number: number; title: string; summary: string };
export type Memory = { seasons: SeasonSummary[]; days: DaySummary[] };

export function addDaySummary(mem: Memory, day: number, summary: string): Memory {
  const days = mem.days.filter((d) => d.day !== day);
  days.push({ day, summary: summary.trim() });
  days.sort((a, b) => a.day - b.day);
  return { seasons: mem.seasons, days };
}

export function setSeasonSummary(mem: Memory, number: number, title: string, summary: string): Memory {
  const seasons = mem.seasons.filter((s) => s.number !== number);
  seasons.push({ number, title, summary: summary.trim() });
  seasons.sort((a, b) => a.number - b.number);
  return { seasons, days: mem.days };
}

/** Prompt section: all season summaries plus the last `keepDays` day summaries. */
export function memoryPromptBlock(mem: Memory, nextDay: number, keepDays = 14): string {
  const parts: string[] = [];
  if (mem.seasons.length > 0) {
    parts.push("SEASONS SO FAR:");
    for (const s of mem.seasons) parts.push(`- Season ${s.number}, "${s.title}": ${s.summary}`);
  }
  const recent = mem.days.filter((d) => d.day < nextDay).slice(-keepDays);
  if (recent.length > 0) {
    parts.push("RECENT DAYS (what changed each day):");
    for (const d of recent) parts.push(`- Day ${d.day}: ${d.summary}`);
  }
  return parts.length > 0 ? parts.join("\n") : "(none yet)";
}

/** Append new permanent facts (deduped, trimmed), keeping the newest MAX_CANON_FACTS. */
export function addCanonFacts(existing: string[], additions: string[] | undefined): string[] {
  const out = [...existing];
  const seen = new Set(out.map((f) => f.trim().toLowerCase()));
  for (const raw of additions ?? []) {
    const f = raw.trim();
    if (!f) continue;
    const key = f.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out.length > MAX_CANON_FACTS ? out.slice(out.length - MAX_CANON_FACTS) : out;
}
