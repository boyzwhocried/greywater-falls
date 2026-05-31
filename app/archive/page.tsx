import Link from "next/link";
import type { Metadata } from "next";
import { TopBar, Footer } from "@/components/Chrome";
import { getAllEditions } from "@/lib/data";
import { stageLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Archive — The Greywater Gazette",
  description: "Every edition the town has published, back to the first quiet morning.",
};

export default function Archive() {
  const editions = [...getAllEditions()].reverse();

  return (
    <>
      <TopBar />
      <div className="sheet">
        <div className="page-head">
          <h1>The Archive</h1>
          <p>Every edition the town has published, newest first. Read it forward to watch the lake wake.</p>
        </div>
        <ul className="archive-list">
          {editions.map((e) => (
            <li key={e.day}>
              <Link href={`/archive/${e.day}`}>
                <div className="archive-row">
                  <span className="day">
                    Day {e.day}
                    <br />
                    {e.dateline.split(",")[0]}
                  </span>
                  <span className="hl">{e.lead.headline}</span>
                  <span className="stage">{stageLabel(e.stage)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
    </>
  );
}
