import { test } from "node:test";
import assert from "node:assert/strict";
import { beatFor, planNextTick, type SeasonArc, type Beat } from "../lib/arc";

const outline: Beat[] = [
  { at: 10, must_happen: "first hard clue" },
  { at: 18, must_happen: "midpoint reversal" },
  { at: 28, must_happen: "climax" },
];

test("beatFor returns the first beat due on or after today", () => {
  assert.equal(beatFor(outline, 3)?.must_happen, "first hard clue");
  assert.equal(beatFor(outline, 10)?.must_happen, "first hard clue");
  assert.equal(beatFor(outline, 11)?.must_happen, "midpoint reversal");
  assert.equal(beatFor(outline, 28)?.must_happen, "climax");
});

test("beatFor returns undefined past the last beat or with no outline", () => {
  assert.equal(beatFor(outline, 29), undefined);
  assert.equal(beatFor(undefined, 5), undefined);
  assert.equal(beatFor([], 5), undefined);
});

test("beatFor sorts unsorted outlines", () => {
  const messy: Beat[] = [{ at: 20, must_happen: "b" }, { at: 5, must_happen: "a" }];
  assert.equal(beatFor(messy, 1)?.must_happen, "a");
});

const arc = (day: number): SeasonArc => ({
  number: 5,
  premise: "plates",
  day_in_season: day,
  target_length: 32,
  next_premise: "",
  outline,
});

test("planNextTick directive includes the upcoming beat", () => {
  const plan = planNextTick(arc(8)); // next day = 9
  assert.ok(plan.directive.includes("first hard clue"));
});

test("planNextTick flags the beat day itself", () => {
  const plan = planNextTick(arc(9)); // next day = 10
  assert.ok(plan.directive.includes("TODAY IS A BEAT DAY"));
  assert.ok(plan.directive.includes("first hard clue"));
});

test("planNextTick without an outline still works", () => {
  const plan = planNextTick({ ...arc(8), outline: undefined });
  assert.ok(plan.directive.length > 0);
  assert.ok(!plan.directive.includes("STORY BEAT"));
});

test("resolving/cresting directives demand a cost, not pure acceptance", () => {
  const crest = planNextTick({ ...arc(17), outline: undefined }); // day 18/32 ~ rising/cresting boundary
  const later = planNextTick({ ...arc(22), outline: undefined }); // day 23 cresting
  assert.ok(/cost|price|lose|loss/i.test(later.directive) || /cost|price|lose|loss/i.test(crest.directive));
});

import { normalizeOutline } from "../lib/arc";

test("normalizeOutline drops invalid beats, clamps to the season, sorts", () => {
  const out = normalizeOutline(
    [
      { at: 40, must_happen: "late" },
      { at: 5, must_happen: "early" },
      { at: 12, must_happen: "   " },
      { at: "x" as unknown as number, must_happen: "bad at" },
      { at: 20, must_happen: "mid" },
    ],
    30
  );
  assert.deepEqual(out.map((b) => [b.at, b.must_happen]), [[5, "early"], [20, "mid"], [30, "late"]]);
});

test("normalizeOutline returns [] for junk input", () => {
  assert.deepEqual(normalizeOutline(undefined, 30), []);
  assert.deepEqual(normalizeOutline("nope" as unknown as undefined, 30), []);
});
