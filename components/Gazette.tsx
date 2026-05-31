import type { Edition, World } from "@/lib/data";
import { isLakeWatch, priceForStage } from "@/lib/format";

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </>
  );
}

export function Gazette({ world, edition }: { world: World; edition: Edition }) {
  const lakeWatch = edition.briefs.filter((b) => isLakeWatch(b.headline));
  const briefs = edition.briefs.filter((b) => !isLakeWatch(b.headline));

  return (
    <article className="frontpage">
      <header className="masthead">
        <div className="overline">Greywater Falls &middot; Established 1887</div>
        <h1 className="nameplate">The Greywater Gazette</h1>
        <div className="motto">{world.motto}</div>
        <div className="dateband">
          <span>
            {world.volume}, No. {edition.day}
          </span>
          <span className="mid">{edition.dateline}</span>
          <span>{priceForStage(edition.stage)}</span>
        </div>
      </header>

      <div className="weatherstrip">Weather. {edition.weather}</div>

      <section className="lead">
        <h1>{edition.lead.headline}</h1>
        <div className="byline">{edition.lead.byline}</div>
        <div className="body">
          <Paragraphs text={edition.lead.body} />
        </div>
      </section>

      <div className="columns">
        <main>
          <h2 className="section-label">From Around the Falls</h2>
          {briefs.map((b, i) => (
            <div className="brief" key={i}>
              <h3>{b.headline}</h3>
              <p>{b.body}</p>
            </div>
          ))}
        </main>

        <aside className="rail">
          {lakeWatch.length > 0 && (
            <div className="box lakewatch">
              <h2 className="section-label">Lake Watch</h2>
              {lakeWatch.map((b, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0" }}>
                  {b.body}
                </p>
              ))}
            </div>
          )}

          {edition.classifieds.length > 0 && (
            <div className="box">
              <h2 className="section-label">Classifieds &amp; Notices</h2>
              <ul className="classified">
                {edition.classifieds.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {edition.record.length > 0 && (
            <div className="box">
              <h2 className="section-label">The Record</h2>
              <ul>
                {edition.record.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {edition.letters.length > 0 && (
        <section className="letters">
          <h2 className="section-label">Letters to the Editor</h2>
          <div className="grid">
            {edition.letters.map((l, i) => (
              <div className="letter" key={i}>
                <p>&ldquo;{l.body}&rdquo;</p>
                <div className="from">&mdash; {l.from}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {edition.editorNote && (
        <div className="editor-note">
          <span className="tag">A note from the editor</span>
          {edition.editorNote}
        </div>
      )}
    </article>
  );
}
