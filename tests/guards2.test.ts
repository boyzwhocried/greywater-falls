import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerIssues, summaryIssues, similarity } from "../lib/guards";
import type { Thread } from "../lib/threads";

const th = (id: string, status: Thread["status"] = "open"): Thread => ({
  id,
  text: id,
  opened_day: 1,
  last_touched: 1,
  status,
});

test("ledgerIssues: open threads exist and none advanced -> issue", () => {
  assert.equal(ledgerIssues(undefined, [th("a")]).length, 1);
  assert.equal(ledgerIssues({}, [th("a")]).length, 1);
});

test("ledgerIssues: an advance or a resolve satisfies it", () => {
  assert.deepEqual(ledgerIssues({ advance: [{ id: "a", note: "x" }] }, [th("a")]), []);
  assert.deepEqual(ledgerIssues({ resolve: [{ id: "a", note: "x" }] }, [th("a")]), []);
});

test("ledgerIssues: no open threads -> nothing required", () => {
  assert.deepEqual(ledgerIssues(undefined, []), []);
  assert.deepEqual(ledgerIssues(undefined, [th("a", "resolved")]), []);
});

test("ledgerIssues: unknown ids in advance do not count", () => {
  assert.equal(ledgerIssues({ advance: [{ id: "zzz", note: "x" }] }, [th("a")]).length, 1);
});

test("similarity: identical is 1, disjoint is 0", () => {
  assert.equal(similarity("the cat sat", "the cat sat"), 1);
  assert.equal(similarity("alpha beta", "gamma delta"), 0);
});

test("summaryIssues: empty summary is an issue", () => {
  assert.equal(summaryIssues("", []).length, 1);
  assert.equal(summaryIssues(undefined, []).length, 1);
});

test("summaryIssues: near-duplicate of a recent day is an issue", () => {
  const recent = ["Mrs. Vance finds a fourth object on the green house step."];
  assert.equal(summaryIssues("Mrs. Vance finds a fifth object on the green house step.", recent).length, 1);
});

test("summaryIssues: genuinely new event passes", () => {
  const recent = ["Mrs. Vance finds a fourth object on the green house step."];
  assert.deepEqual(summaryIssues("Calloway admits what H gave her: a key to the lake road gate.", recent), []);
});
