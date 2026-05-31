import type { Metadata } from "next";
import { TopBar, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "About — The Greywater Gazette",
  description: "What this is, and how to let the town keep breathing.",
};

export default function About() {
  return (
    <>
      <TopBar />
      <div className="sheet">
        <div className="page-head">
          <h1>About this paper</h1>
          <p>A town that writes its own news.</p>
        </div>
        <div className="prose">
          <p>
            Greywater Falls is a small fictional town that advances one day at a time, on its own.
            Each day the town &ldquo;ticks&rdquo;: its residents act on what they want and fear,
            their stories move, and a quiet wrongness under the surface compounds a little further.
            The day is published as a front page of <em>The Greywater Gazette</em>.
          </p>
          <p>
            Nobody writes the paper by hand. A director reads the whole town, decides what happened
            today, and sets it in type. The opening run you can read in the{" "}
            <a href="/archive">archive</a> was the town&rsquo;s first ten mornings, from an ordinary
            Monday to the evening the whole town finally walked down to the water and sat with it.
          </p>
          <p>
            It is a living artifact, not a game and not a feed. The pleasure is opening the page and
            finding out what your town did today. The strange never arrives all at once. It seeps in
            through the classifieds and the letters to the editor, through a welcome sign that keeps
            changing its count, through a cat that comes home wet and humming and a little too cold.
          </p>
          <p>
            The watcher has one lever. You can <em>conjure</em> an event &mdash; a stranger on the
            noon bus, a storm, a buried secret surfacing &mdash; and the next morning&rsquo;s edition
            will have woven it in. Otherwise the town is left to its own devices, which is the whole
            point. It does not need you. It is glad when you come.
          </p>
          <p style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>
            Serving Greywater Falls since 1887, and the lake somewhat longer.
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
