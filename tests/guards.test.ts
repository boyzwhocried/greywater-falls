import { test } from "node:test";
import assert from "node:assert/strict";
import { styleIssues, wordCount } from "../lib/guards";

const goodBody = (words: number) =>
  Array.from({ length: words }, (_, i) => `word${i}`).join(" ");

const ed = (over: Partial<{ body: string; editorNote: string }> = {}) => ({
  lead: { headline: "Hank Locks the Mill", byline: "By Wren Aldercott", body: over.body ?? goodBody(200) },
  editorNote: over.editorNote,
});

test("wordCount counts whitespace-separated words", () => {
  assert.equal(wordCount("one two  three\nfour"), 4);
});

test("clean edition has no issues", () => {
  assert.deepEqual(styleIssues(ed()), []);
});

test("bans the 'one true thing' template, case-insensitive", () => {
  const issues = styleIssues(ed({ body: goodBody(200) + " The One True Thing this editor sets down today." }));
  assert.ok(issues.some((i) => i.includes("one true thing")));
});

test("bans 'where the town keeps such things'", () => {
  const issues = styleIssues(ed({ body: goodBody(200) + " low, where the town keeps such things." }));
  assert.ok(issues.some((i) => i.includes("keeps such things")));
});

test("flags banned phrases in the editor note too", () => {
  const issues = styleIssues(ed({ editorNote: "its own kind of answer" }));
  assert.ok(issues.some((i) => i.includes("its own kind of")));
});

test("flags a lead that is too long", () => {
  const issues = styleIssues(ed({ body: goodBody(450) }));
  assert.ok(issues.some((i) => i.startsWith("lead too long")));
});

test("flags a lead that is too short", () => {
  const issues = styleIssues(ed({ body: goodBody(30) }));
  assert.ok(issues.some((i) => i.startsWith("lead too short")));
});

test("caps 'this editor' at 2 mentions", () => {
  const body = goodBody(200) + " this editor this editor This Editor";
  const issues = styleIssues(ed({ body }));
  assert.ok(issues.some((i) => i.includes("this editor")));
});

test("allows exactly 2 'this editor' mentions", () => {
  const body = goodBody(200) + " this editor this editor";
  assert.deepEqual(styleIssues(ed({ body })), []);
});

test("flags the 'On the morning of' opener", () => {
  const issues = styleIssues(ed({ body: "On the morning of Tuesday, " + goodBody(200) }));
  assert.ok(issues.some((i) => i.includes("opening")));
});

test("flags a weather-first opener", () => {
  const issues = styleIssues(ed({ body: "Overcast and still, 31 degrees. " + goodBody(200) }));
  assert.ok(issues.some((i) => i.includes("opening")));
});
