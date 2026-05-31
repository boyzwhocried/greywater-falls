// ---------------------------------------------------------------------------
// The Arc Director — the "ending engine".
//
// Pure functions only. No I/O, no LLM. The tick script owns all the math here so
// the model never has to count days or decide structure; it only writes to the
// brief these functions produce. This is what stops the town becoming slop: every
// day knows where it sits in a season-long arc, and seasons resolve and reseed
// instead of running flat forever.
//
// Anthology model: each season is a complete story (setup -> rising -> cresting
// -> resolving -> coda). When a season hits its coda, the next tick RESEEDS: a
// new season, a fresh strangeness, the town carrying its history forward.
// ---------------------------------------------------------------------------

export type Phase = "setup" | "rising" | "cresting" | "resolving" | "coda";

export type SeasonArc = {
  /** which season we are in (1-based) */
  number: number;
  /** the strangeness this season is about, e.g. "the lake wakes and counts" */
  premise: string;
  /** how many days into THIS season the latest published day is (1-based) */
  day_in_season: number;
  /** intended length of this season in days */
  target_length: number;
  /** the director's proposed premise for the NEXT season, set on the coda day */
  next_premise: string;
};

/** Where in its arc a given day sits, as a fraction-driven phase. */
export function phaseFor(dayInSeason: number, targetLength: number): Phase {
  if (dayInSeason >= targetLength) return "coda";
  const p = dayInSeason / targetLength;
  if (p <= 0.18) return "setup";
  if (p <= 0.55) return "rising";
  if (p <= 0.78) return "cresting";
  return "resolving";
}

/** The day a season ends on (its coda). */
export function isCodaDay(dayInSeason: number, targetLength: number): boolean {
  return dayInSeason >= targetLength;
}

/** A roughly stage-appropriate undercurrent ceiling for each phase, so the hidden
 *  pressure tracks the story shape even if the model drifts. The tick clamps to
 *  these. setup is calm; cresting is the peak; coda eases back down. */
export function undercurrentBandFor(phase: Phase): { min: number; max: number; stage: number } {
  switch (phase) {
    case "setup":
      return { min: 2, max: 22, stage: 0 };
    case "rising":
      return { min: 20, max: 60, stage: 2 };
    case "cresting":
      return { min: 60, max: 95, stage: 3 };
    case "resolving":
      return { min: 30, max: 70, stage: 2 };
    case "coda":
      return { min: 10, max: 40, stage: 1 };
  }
}

export type TickPlan = {
  /** true if this tick begins a brand-new season */
  reseed: boolean;
  /** the season arc state this day belongs to (already advanced/reseeded) */
  season: SeasonArc;
  phase: Phase;
  /** human-readable directive injected into the prompt */
  directive: string;
};

const TARGET_MIN = 30;
const TARGET_MAX = 44;

/** Deterministic-ish target length, seeded by season number so a dry sim is
 *  reproducible but seasons still vary. */
export function targetLengthForSeason(seasonNumber: number): number {
  const span = TARGET_MAX - TARGET_MIN + 1;
  // simple stable hash of the season number
  const h = (seasonNumber * 2654435761) >>> 0;
  return TARGET_MIN + (h % span);
}

/**
 * Given the season arc state AS OF the latest published day, compute the plan for
 * the NEXT day. If the latest day was a coda, the next day reseeds into a new
 * season. Otherwise it advances within the current season.
 */
export function planNextTick(prev: SeasonArc): TickPlan {
  const wasCoda = isCodaDay(prev.day_in_season, prev.target_length);

  if (wasCoda) {
    const number = prev.number + 1;
    const premise =
      prev.next_premise && prev.next_premise.trim().length > 0
        ? prev.next_premise.trim()
        : "a new strangeness stirs at the lake as the season turns";
    const season: SeasonArc = {
      number,
      premise,
      day_in_season: 1,
      target_length: targetLengthForSeason(number),
      next_premise: "",
    };
    return {
      reseed: true,
      season,
      phase: "setup",
      directive: reseedDirective(season),
    };
  }

  const day_in_season = prev.day_in_season + 1;
  const season: SeasonArc = { ...prev, day_in_season };
  const phase = phaseFor(day_in_season, season.target_length);
  return {
    reseed: false,
    season,
    phase,
    directive: phaseDirective(phase, season),
  };
}

function reseedDirective(s: SeasonArc): string {
  return [
    `NEW SEASON. This is Season ${s.number}, Day 1 of about ${s.target_length}.`,
    `The previous season has fully ended; the town is calm and ordinary again.`,
    `Premise for this season: "${s.premise}".`,
    `Today is SETUP. Open gently. Mostly ordinary small-town life (the bakery, the diner, the weather, the geese), with only the faintest first thread of the new strangeness, easy to dismiss. Undercurrent is LOW. Do NOT re-run last season's beats; this is a fresh arc. Let residents carry forward what last season did to them (changed, closer, wearier) without re-litigating it.`,
  ].join(" ");
}

function phaseDirective(phase: Phase, s: SeasonArc): string {
  const where = `Season ${s.number}, Day ${s.day_in_season} of about ${s.target_length}. Premise: "${s.premise}".`;
  switch (phase) {
    case "setup":
      return `${where} Phase: SETUP. Ordinary life with the faintest first thread of strangeness. Keep it low and deniable.`;
    case "rising":
      return `${where} Phase: RISING. The strangeness compounds, day by day. New small wrong details accumulate; the town starts to notice and rationalize. Escalate, but vary the beats.`;
    case "cresting":
      return `${where} Phase: CRESTING. This is the peak of the arc. The strangeness can no longer be ignored; bring it into the open in the town's cozy, accommodating way. The biggest, most resonant edition of the season.`;
    case "resolving":
      return `${where} Phase: RESOLVING. The crest has passed. Wind the arc down: the town accommodates, makes peace, finds the new normal. Quieter, warmer, conclusive. Begin tying threads off.`;
    case "coda":
      return [
        `${where} Phase: CODA. This is the FINAL day of the season.`,
        `Write a quiet, satisfying close that lands the season's arc and leaves the town at rest, changed but well.`,
        `Then, via the season_update.next_premise field, plant the seed of a DIFFERENT strangeness for next season (not a repeat of this one) — something the ending naturally points toward.`,
      ].join(" ");
  }
}
