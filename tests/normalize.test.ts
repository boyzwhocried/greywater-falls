import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePublishedDay, isValidEdition } from "../lib/normalize";

const edition = {
  dateline: "Wednesday, November 12",
  weather: "fog",
  stage: 2,
  lead: { headline: "The Thimble Comes Home", byline: "By Wren Aldercott", body: "Body text." },
  briefs: [{ headline: "Brief one", body: "Short." }],
};
const worldUpdate = { weather: "fog", season: "autumn", population: 212, undercurrent: { stage: 2, level: 50 } };
const full = {
  edition,
  world_update: worldUpdate,
  season_update: { premise: "p" },
  resident_updates: [],
  day_summary: "s",
};

test("well-formed output passes through unchanged", () => {
  const out = normalizePublishedDay(structuredClone(full));
  assert.deepEqual(out.edition, edition);
  assert.equal(isValidEdition(out.edition), true);
});

test("edition returned as a JSON string (the 11-08/11-14 numeric-key shape) is parsed", () => {
  // Object.keys of a string is 0,1,2,... which is exactly what the CI log showed.
  const bad = { edition: JSON.stringify(edition) };
  assert.deepEqual(Object.keys(bad.edition).slice(0, 3), ["0", "1", "2"]);
  const out = normalizePublishedDay(bad);
  assert.equal(isValidEdition(out.edition), true);
  assert.equal(out.edition.lead.headline, "The Thimble Comes Home");
});

test("whole payload JSON-stringified inside edition is hoisted", () => {
  const out = normalizePublishedDay({ edition: JSON.stringify(full) });
  assert.equal(isValidEdition(out.edition), true);
  assert.equal(out.world_update.population, 212);
  assert.equal(out.day_summary, "s");
});

test("code-fenced JSON string edition is parsed", () => {
  const out = normalizePublishedDay({ edition: "```json\n" + JSON.stringify(edition) + "\n```" });
  assert.equal(isValidEdition(out.edition), true);
});

test("array-like object of single characters is joined then parsed", () => {
  const chars = Object.fromEntries(JSON.stringify(edition).split("").map((c, i) => [String(i), c]));
  const out = normalizePublishedDay({ edition: chars });
  assert.equal(isValidEdition(out.edition), true);
});

test("other string-encoded sections are parsed too", () => {
  const out = normalizePublishedDay({
    ...full,
    world_update: JSON.stringify(worldUpdate),
    resident_updates: "[]",
  });
  assert.equal(out.world_update.population, 212);
  assert.deepEqual(out.resident_updates, []);
});

test("unparseable garbage does not throw and stays invalid", () => {
  for (const bad of [{ edition: "not json at all" }, null, undefined, 42, "x", {}]) {
    const out = normalizePublishedDay(bad as unknown);
    assert.equal(isValidEdition(out.edition), false);
  }
});

test("a valid-JSON but wrong-shaped edition string stays invalid", () => {
  const out = normalizePublishedDay({ edition: JSON.stringify({ lead: "just a string" }) });
  assert.equal(isValidEdition(out.edition), false);
});
