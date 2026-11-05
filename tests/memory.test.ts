import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaySummary,
  setSeasonSummary,
  memoryPromptBlock,
  addCanonFacts,
  MAX_CANON_FACTS,
  type Memory,
} from "../lib/memory";

const empty = (): Memory => ({ seasons: [], days: [] });

test("addDaySummary appends and replaces the same day", () => {
  let m = addDaySummary(empty(), 5, "The lake rose.");
  m = addDaySummary(m, 6, "The cat returned.");
  m = addDaySummary(m, 6, "The cat returned, humming.");
  assert.equal(m.days.length, 2);
  assert.equal(m.days[1].summary, "The cat returned, humming.");
});

test("addDaySummary does not mutate the input", () => {
  const m = empty();
  addDaySummary(m, 1, "x");
  assert.equal(m.days.length, 0);
});

test("setSeasonSummary upserts by season number", () => {
  let m = setSeasonSummary(empty(), 1, "The Lake Counts", "First season.");
  m = setSeasonSummary(m, 1, "The Lake Counts", "First season, revised.");
  m = setSeasonSummary(m, 2, "The Correspondence", "Second.");
  assert.equal(m.seasons.length, 2);
  assert.equal(m.seasons[0].summary, "First season, revised.");
});

test("memoryPromptBlock lists season summaries and only the last N day summaries", () => {
  let m = setSeasonSummary(empty(), 1, "The Lake Counts", "First season summary.");
  for (let d = 1; d <= 30; d++) m = addDaySummary(m, d, `event ${d}`);
  const block = memoryPromptBlock(m, 31, 5);
  assert.ok(block.includes("First season summary."));
  assert.ok(block.includes("Day 30: event 30"));
  assert.ok(block.includes("Day 26: event 26"));
  assert.ok(!block.includes("Day 25: event 25"));
});

test("memoryPromptBlock handles empty memory", () => {
  assert.ok(memoryPromptBlock(empty(), 1, 5).includes("none"));
});

test("addCanonFacts dedupes case-insensitively and trims", () => {
  const out = addCanonFacts(["The sign reads 7."], ["  the sign reads 7. ", "A new fact."]);
  assert.deepEqual(out, ["The sign reads 7.", "A new fact."]);
});

test("addCanonFacts ignores empties and caps the list, keeping the newest", () => {
  const base = Array.from({ length: MAX_CANON_FACTS }, (_, i) => `fact ${i}`);
  const out = addCanonFacts(base, ["", "   ", "brand new"]);
  assert.equal(out.length, MAX_CANON_FACTS);
  assert.equal(out.at(-1), "brand new");
  assert.ok(!out.includes("fact 0"));
});
