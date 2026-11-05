// ---------------------------------------------------------------------------
// Thread ledger: every open mystery or promise the story has made, with a
// payoff deadline, so the generator cannot quietly drop them. Pure functions.
// ---------------------------------------------------------------------------

export const MAX_OPEN_THREADS = 8;
export const STALE_AFTER_DAYS = 20;

export type ThreadStatus = "open" | "advanced" | "resolved" | "dropped";

export type Thread = {
  id: string;
  text: string;
  opened_day: number;
  last_touched: number;
  status: ThreadStatus;
  /** Day by which this should pay off. Optional. */
  payoff_by?: number;
  notes?: string[];
};

export type ThreadUpdates = {
  open?: { id: string; text: string; payoff_by?: number }[];
  advance?: { id: string; note: string }[];
  resolve?: { id: string; note: string }[];
};

export function openThreads(threads: Thread[]): Thread[] {
  return threads.filter((t) => t.status === "open" || t.status === "advanced");
}

export function overdueThreads(threads: Thread[], day: number): Thread[] {
  return openThreads(threads).filter(
    (t) => (t.payoff_by !== undefined && day > t.payoff_by) || day - t.last_touched >= STALE_AFTER_DAYS
  );
}

export function applyThreadUpdates(threads: Thread[], upd: ThreadUpdates | undefined, day: number): Thread[] {
  const out: Thread[] = threads.map((t) => ({ ...t, notes: t.notes ? [...t.notes] : undefined }));
  if (!upd) return out;
  const byId = new Map(out.map((t) => [t.id, t]));

  for (const a of upd.advance ?? []) {
    const t = byId.get(a.id);
    if (!t || t.status === "resolved" || t.status === "dropped") continue;
    t.status = "advanced";
    t.last_touched = day;
    t.notes = [...(t.notes ?? []), `Day ${day}: ${a.note}`];
  }
  for (const r of upd.resolve ?? []) {
    const t = byId.get(r.id);
    if (!t || t.status === "resolved" || t.status === "dropped") continue;
    t.status = "resolved";
    t.last_touched = day;
    t.notes = [...(t.notes ?? []), `Day ${day}: ${r.note}`];
  }
  for (const o of upd.open ?? []) {
    if (byId.has(o.id)) continue;
    if (openThreads(out).length >= MAX_OPEN_THREADS) break;
    const t: Thread = { id: o.id, text: o.text, opened_day: day, last_touched: day, status: "open", payoff_by: o.payoff_by };
    out.push(t);
    byId.set(t.id, t);
  }
  return out;
}

/** Prompt section: the ledger the model must respect each day. */
export function threadsPromptBlock(threads: Thread[], day: number): string {
  const open = openThreads(threads);
  if (open.length === 0) return "(none open: you may open at most 1 new thread today, only if it matters)";
  const overdue = new Set(overdueThreads(threads, day).map((t) => t.id));
  const lines = open.map((t) => {
    const flag = overdue.has(t.id) ? " [OVERDUE: advance or resolve this soon]" : "";
    const by = t.payoff_by !== undefined ? ` payoff by day ${t.payoff_by}` : "";
    const last = t.notes?.at(-1) ? ` last: ${t.notes.at(-1)}` : "";
    return `- ${t.id}: ${t.text} (opened day ${t.opened_day}, last touched day ${t.last_touched},${by})${last}${flag}`;
  });
  return lines.join("\n");
}
