import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopBar, Footer } from "@/components/Chrome";
import { getResidents, getResident } from "@/lib/data";

export function generateStaticParams() {
  return getResidents().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = getResident(slug);
  if (!r) return { title: "Not found — The Greywater Gazette" };
  return { title: `${r.name} — The Greywater Gazette`, description: r.role };
}

export default async function ResidentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = getResident(slug);
  if (!r) notFound();

  const others = getResidents();
  const nameFor = (s: string) => others.find((o) => o.slug === s)?.name ?? s;

  return (
    <>
      <TopBar />
      <div className="sheet resident">
        <div className="page-head">
          <h1>
            {r.name}
            {r.status !== "present" && <span className="status-pill">{r.status}</span>}
          </h1>
          <p>
            {r.role} &middot; {r.age}
          </p>
        </div>

        <p className="prose" style={{ fontSize: 19 }}>
          {r.personality}
        </p>

        <dl>
          <dt>This week</dt>
          <dd>{r.arc}</dd>

          <dt>Mood</dt>
          <dd style={{ fontStyle: "italic" }}>{r.mood}</dd>

          <dt>Voice</dt>
          <dd>{r.voice}</dd>

          <dt>Knows</dt>
          <dd>
            {r.relationships.map((rel, i) => (
              <p className="rel" key={i}>
                <Link className="who" href={`/residents/${rel.with}`}>
                  {nameFor(rel.with)}
                </Link>{" "}
                <span style={{ color: "var(--ink-faint)" }}>&mdash; {rel.type}.</span> {rel.note}
              </p>
            ))}
          </dd>

          <dt>Lately</dt>
          <dd>
            {r.memory.map((m, i) => (
              <p key={i} style={{ margin: "0 0 6px" }}>
                {m}
              </p>
            ))}
          </dd>

          <dt>Before all this</dt>
          <dd>{r.backstory}</dd>
        </dl>

        <Link className="backlink" href="/residents">
          &larr; All the townsfolk
        </Link>
      </div>
      <Footer />
    </>
  );
}
