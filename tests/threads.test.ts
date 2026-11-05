import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyThreadUpdates,
  openThreads,
  overdueThreads,
  threadsPromptBlock,
  MAX_OPEN_THREADS,
  type Thread,
} from "../lib/threads";

const t = (over: Partial<Thread> = {}): Thread => ({
  id: "t1",
  text: "Who is H?",
  opened_day: 10,
  last_touched: 10,
  status: "open",
  payoff_by: 60,
  ...over,
});

test("openThreads excludes resolved and dropped", () => {
  const list = [t({ id: "a" }), t({ id: "b", status: "resolved" }), t({ id: "c", status: "dropped" }), t({ id: "d", status: "advanced" })];
  assert.deepEqual(openThreads(list).map((x) => x.id), ["a", "d"]);
});

test("overdueThreads: past payoff_by or untouched 20+ days", () => {
  const list = [
    t({ id: "late", payoff_by: 50 }),
    t({ id: "stale", payoff_by: 200, last_touched: 70 }),
    t({ id: "fine", payoff_by: 200, last_touched: 95 }),
  ];
  assert.deepEqual(overdueThreads(list, 100).map((x) => x.id).sort(), ["late", "stale"]);
});

test("applyThreadUpdates opens a new thread", () => {
  const out = applyThreadUpdates([], { open: [{ id: "plate", text: "Who leaves the plate?", payoff_by: 140 }] }, 113);
  assert.equal(out.length, 1);
  assert.equal(out[0].opened_day, 113);
  assert.equal(out[0].last_touched, 113);
  assert.equal(out[0].status, "open");
});

test("applyThreadUpdates advance touches and sets status advanced", () => {
  const out = applyThreadUpdates([t()], { advance: [{ id: "t1", note: "a clue" }] }, 80);
  assert.equal(out[0].status, "advanced");
  assert.equal(out[0].last_touched, 80);
  assert.equal(out[0].notes?.at(-1), "Day 80: a clue");
});

test("applyThreadUpdates resolve closes the thread", () => {
  const out = applyThreadUpdates([t()], { resolve: [{ id: "t1", note: "H was the lake" }] }, 90);
  assert.equal(out[0].status, "resolved");
  assert.equal(out[0].notes?.at(-1), "Day 90: H was the lake");
});

test("unknown ids are ignored, duplicate open ids are not re-added", () => {
  const base = [t()];
  const out = applyThreadUpdates(base, { advance: [{ id: "nope", note: "x" }], open: [{ id: "t1", text: "dup" }] }, 20);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Who is H?");
});

test("open cap: refuses new threads when MAX_OPEN_THREADS reached", () => {
  const full = Array.from({ length: MAX_OPEN_THREADS }, (_, i) => t({ id: `x${i}` }));
  const out = applyThreadUpdates(full, { open: [{ id: "extra", text: "one too many" }] }, 30);
  assert.equal(out.length, MAX_OPEN_THREADS);
});

test("threadsPromptBlock lists open threads and flags overdue ones", () => {
  const block = threadsPromptBlock([t({ id: "late", text: "Who is H?", payoff_by: 50 }), t({ id: "ok", text: "The plate", payoff_by: 200, last_touched: 99 })], 100);
  assert.ok(block.includes("late"));
  assert.ok(block.includes("OVERDUE"));
  assert.ok(block.includes("The plate"));
});

test("threadsPromptBlock handles empty", () => {
  assert.ok(threadsPromptBlock([], 5).includes("none"));
});
