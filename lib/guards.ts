// ---------------------------------------------------------------------------
// Style guards: cheap, deterministic checks that catch the template loops the
// model falls into over a long run (fixed closing line, "this editor" tic,
// weather-first openers, bloated leads). Pure functions, no I/O.
// ---------------------------------------------------------------------------

export const LEAD_MIN_WORDS = 80;
export const LEAD_MAX_WORDS = 340;
export const THIS_EDITOR_MAX = 2;

/** Phrases the model has turned into template slots. Lowercase. */
export const BANNED_PHRASES = [
  "one true thing",
  "keeps such things",
  "its own kind of answer",
  "its own kind of report",
  "its own kind of",
  "old pewter",
  "for a second day running",
  "no change to report",
];

const WEATHER_OPENERS =
  /^(overcast|clear|cold|mild|grey|gray|fog|foggy|still|snow|cloud|clouded|frost|warm|light snow|thin snow|rain)\b/i;

type EditionLike = {
  lead: { body: string };
  editorNote?: string;
};

export function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

function countOf(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/** Returns human-readable issues; empty array means the edition passes. */
export function styleIssues(ed: EditionLike): string[] {
  const issues: string[] = [];
  const body = ed.lead.body ?? "";
  const all = `${body}\n${ed.editorNote ?? ""}`.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (all.includes(phrase)) {
      issues.push(`banned phrase "${phrase}" (a recurring template, find fresh wording)`);
    }
  }

  const words = wordCount(body);
  if (words > LEAD_MAX_WORDS) {
    issues.push(`lead too long (${words} words, max ${LEAD_MAX_WORDS}); cut to one event that changes something`);
  } else if (words < LEAD_MIN_WORDS) {
    issues.push(`lead too short (${words} words, min ${LEAD_MIN_WORDS})`);
  }

  const te = countOf(all, "this editor");
  if (te > THIS_EDITOR_MAX) {
    issues.push(`"this editor" used ${te} times (max ${THIS_EDITOR_MAX}); vary the voice`);
  }

  const opening = body.trim();
  if (/^on the (morning|evening|afternoon) of\b/i.test(opening) || WEATHER_OPENERS.test(opening)) {
    issues.push("opening is a date/weather formula; open on a person, an object or an event");
  }

  return issues;
}
