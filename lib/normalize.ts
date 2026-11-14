import type { PublishedDay } from "./director";

/**
 * Tolerant normalizer for the model's publish_day tool input.
 *
 * Observed failure (CI 2026-11-08, 2026-11-14): the model returned `edition` as a
 * JSON *string* (and sometimes the whole payload nested inside it). Object.keys of a
 * string is 0,1,2,..., which is the "numeric-key edition" seen in the logs. Tool
 * schemas are not hard-enforced, so we repair what is recoverable and let the
 * existing retry path handle the rest. Never throws.
 */

const SECTIONS = ["edition", "world_update", "season_update", "resident_updates", "thread_updates", "canon_additions"] as const;

function stripFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

function parseMaybe(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(stripFence(value));
    } catch {
      return value;
    }
  }
  // array-like object of single characters: {"0":"{","1":"\"",...}
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length > 1 && keys.every((k, i) => k === String(i))) {
      const vals = Object.values(value as Record<string, unknown>);
      if (vals.every((v) => typeof v === "string" && (v as string).length === 1)) {
        return parseMaybe(vals.join(""));
      }
    }
  }
  return value;
}

export function isValidEdition(edition: unknown): boolean {
  const e = edition as PublishedDay["edition"] | undefined | null;
  return !!e && typeof e === "object" && !!e.lead?.headline && !!e.lead.body && Array.isArray(e.briefs);
}

export function normalizePublishedDay(input: unknown): PublishedDay {
  let root: unknown = parseMaybe(input);
  if (!root || typeof root !== "object" || Array.isArray(root)) return {} as PublishedDay;
  const out: Record<string, unknown> = { ...(root as Record<string, unknown>) };
  for (const k of SECTIONS) if (k in out) out[k] = parseMaybe(out[k]);

  // whole payload nested inside edition: hoist its sections
  const ed = out.edition as Record<string, unknown> | undefined;
  if (ed && typeof ed === "object" && ed.edition && typeof ed.edition === "object") {
    const inner = normalizePublishedDay(ed) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(inner)) if (!(k in out) || k === "edition") out[k] = v;
  }
  return out as unknown as PublishedDay;
}
