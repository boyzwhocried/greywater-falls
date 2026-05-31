/**
 * arc-sim.ts — prove the ending engine works WITHOUT spending a cent.
 *
 *   npx tsx scripts/arc-sim.ts
 *
 * Simulates many days of pure arc logic (no LLM, no network): phases progress
 * setup -> rising -> cresting -> resolving -> coda, then the season reseeds into
 * a fresh one. This is the test that the town will never run flat forever.
 */
import {
  planNextTick,
  undercurrentBandFor,
  type SeasonArc,
  type Phase,
} from "../lib/arc";

const DAYS = 80;

// start where the live town is: Season 1, day 10 of 14
let arc: SeasonArc = {
  number: 1,
  premise: "the lake wakes and counts the town",
  day_in_season: 10,
  target_length: 14,
  next_premise: "",
};

let dayNumber = 10;
const phaseSeen = new Set<Phase>();
const seasonsStarted: number[] = [];
let reseeds = 0;
const phaseOrderOk: boolean[] = [];
let lastPhaseRank = -1;

const rank: Record<Phase, number> = {
  setup: 0,
  rising: 1,
  cresting: 2,
  resolving: 3,
  coda: 4,
};

console.log("day | season | d/T   | phase     | stage band | reseed");
console.log("----+--------+-------+-----------+------------+-------");

for (let i = 0; i < DAYS; i++) {
  const plan = planNextTick(arc);
  dayNumber += 1;
  phaseSeen.add(plan.phase);
  const band = undercurrentBandFor(plan.phase);

  if (plan.reseed) {
    reseeds += 1;
    seasonsStarted.push(plan.season.number);
    lastPhaseRank = -1; // a new season resets the order check
  }
  // within a season, phase rank must be non-decreasing
  if (!plan.reseed) {
    phaseOrderOk.push(rank[plan.phase] >= lastPhaseRank);
  }
  lastPhaseRank = rank[plan.phase];

  console.log(
    `${String(dayNumber).padStart(3)} |   S${plan.season.number}` +
      `${plan.season.number < 10 ? "  " : " "}| ` +
      `${String(plan.season.day_in_season).padStart(2)}/${String(plan.season.target_length).padEnd(2)} | ` +
      `${plan.phase.padEnd(9)} | ${String(band.min).padStart(3)}-${String(band.max).padStart(3)} s${band.stage} | ` +
      `${plan.reseed ? "RESEED" : ""}`
  );

  // simulate the director setting next_premise when it writes a coda
  let nextArc = plan.season;
  if (plan.phase === "coda") {
    nextArc = { ...nextArc, next_premise: `simulated premise for season ${nextArc.number + 1}` };
  }
  arc = nextArc;
}

// ---- assertions -----------------------------------------------------------
const allPhases: Phase[] = ["setup", "rising", "cresting", "resolving", "coda"];
const sawAllPhases = allPhases.every((p) => phaseSeen.has(p));
const orderOk = phaseOrderOk.every(Boolean);
const reseededMultiple = reseeds >= 2;
const seasonsAscending = seasonsStarted.every((n, i) => i === 0 || n === seasonsStarted[i - 1] + 1);

console.log("\n--- results ---");
console.log(`saw all phases (setup..coda):      ${sawAllPhases ? "PASS" : "FAIL"}`);
console.log(`phase order non-decreasing/season: ${orderOk ? "PASS" : "FAIL"}`);
console.log(`reseeded into new seasons (>=2):    ${reseededMultiple ? "PASS" : "FAIL"} (${reseeds} reseeds)`);
console.log(`season numbers ascend by 1:         ${seasonsAscending ? "PASS" : "FAIL"} (${seasonsStarted.join(", ")})`);

const ok = sawAllPhases && orderOk && reseededMultiple && seasonsAscending;
console.log(`\nARC-SIM: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
