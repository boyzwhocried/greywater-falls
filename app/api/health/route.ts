import { NextResponse } from "next/server";
import { getWorld } from "@/lib/data";

// Pulse heartbeat, pull mode. Public, read-only liveness probe that Pulse
// (personal mission control) fetches each poll cycle to render Greywater on the
// board. Must never throw: the town is served statically, so even if state is
// momentarily unreadable we still report liveness rather than fake an outage.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const world = getWorld();
    return NextResponse.json({
      status: "up",
      version: `day-${world.dayNumber}`,
      metrics: {
        day: world.dayNumber,
        season: world.season_arc?.number ?? null,
        stage: world.undercurrent.stage,
        undercurrent: world.undercurrent.level,
        residents: world.population,
      },
    });
  } catch {
    return NextResponse.json({ status: "up" });
  }
}
