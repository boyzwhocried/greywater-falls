// Small presentation helpers shared across the reader.

export function priceForStage(stage: number): string {
  if (stage >= 3) return "Price: one held breath";
  if (stage === 2) return "Price: keep your lanterns charged";
  return "Price: a kind word";
}

export function stageLabel(stage: number): string {
  switch (stage) {
    case 0:
      return "an ordinary day";
    case 1:
      return "something is off";
    case 2:
      return "it compounds";
    case 3:
      return "the town looks back";
    default:
      return "";
  }
}

export function isLakeWatch(headline: string): boolean {
  return headline.trim().toUpperCase().startsWith("LAKE WATCH");
}

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  let out = "";
  for (const [value, numeral] of ROMAN) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}
