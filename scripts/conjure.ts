/**
 * conjure.ts — the watcher's one lever.
 *
 *   npm run conjure -- "a stranger arrives on the noon bus"
 *
 * Appends an event seed. The next tick weaves it into the town and clears it.
 */
import fs from "node:fs";
import path from "node:path";
import type { Seed } from "../lib/data";

const SEEDS = path.join(process.cwd(), "data", "seeds.json");

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error('Conjure what? Try:  npm run conjure -- "a stranger arrives on the noon bus"');
  process.exit(1);
}

let seeds: Seed[] = [];
try {
  seeds = JSON.parse(fs.readFileSync(SEEDS, "utf8")) as Seed[];
} catch {
  seeds = [];
}

seeds.push({ at: new Date().toISOString(), text });
fs.writeFileSync(SEEDS, JSON.stringify(seeds, null, 2) + "\n", "utf8");

console.log(`Conjured: "${text}"`);
console.log(`The next morning's edition will have weather of it. (${seeds.length} seed(s) pending.)`);
