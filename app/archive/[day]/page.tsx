import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gazette } from "@/components/Gazette";
import { TopBar, Footer } from "@/components/Chrome";
import { getWorld, getAllEditions, getEdition } from "@/lib/data";

export function generateStaticParams() {
  return getAllEditions().map((e) => ({ day: String(e.day) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ day: string }>;
}): Promise<Metadata> {
  const { day } = await params;
  const edition = getEdition(Number(day));
  if (!edition) return { title: "Not found — The Greywater Gazette" };
  return {
    title: `${edition.lead.headline} — The Greywater Gazette`,
    description: edition.dateline,
  };
}

export default async function ArchivedEdition({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  const world = getWorld();
  const edition = getEdition(Number(day));
  if (!edition) notFound();

  const all = getAllEditions();
  const prev = all.find((e) => e.day === edition.day - 1);
  const next = all.find((e) => e.day === edition.day + 1);

  return (
    <>
      <TopBar />
      <div className="paper" data-stage={edition.stage}>
        <div className="sheet">
          <Gazette world={world} edition={edition} />
          <nav
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 32,
              fontFamily: "var(--font-label)",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              fontSize: 11,
            }}
          >
            <span>{prev ? <Link href={`/archive/${prev.day}`}>&larr; Day {prev.day}</Link> : <span />}</span>
            <Link href="/archive">All editions</Link>
            <span>{next ? <Link href={`/archive/${next.day}`}>Day {next.day} &rarr;</Link> : <span />}</span>
          </nav>
        </div>
      </div>
      <Footer />
    </>
  );
}
