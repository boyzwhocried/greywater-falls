import Link from "next/link";
import type { Metadata } from "next";
import { TopBar, Footer } from "@/components/Chrome";
import { getResidents } from "@/lib/data";

export const metadata: Metadata = {
  title: "The Townsfolk — The Greywater Gazette",
  description: "The nine souls of Greywater Falls. The sign says seven. Nobody is sure who is right.",
};

export default function Residents() {
  const residents = getResidents();

  return (
    <>
      <TopBar />
      <div className="sheet">
        <div className="page-head">
          <h1>The Townsfolk</h1>
          <p>Nine souls, by the census. Seven, by the sign at the town limits. Make of that what you will.</p>
        </div>
        <div className="folk-grid">
          {residents.map((r) => (
            <Link className="folk-card" key={r.slug} href={`/residents/${r.slug}`}>
              <h3>
                {r.name}
                {r.status !== "present" && <span className="status-pill">{r.status}</span>}
              </h3>
              <div className="role">{r.role}</div>
              <div className="mood">{r.mood}</div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
