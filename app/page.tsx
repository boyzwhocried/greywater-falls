import { Gazette } from "@/components/Gazette";
import { TopBar, Footer } from "@/components/Chrome";
import { getWorld, getLatestEdition } from "@/lib/data";

export default function Today() {
  const world = getWorld();
  const edition = getLatestEdition();

  if (!edition) {
    return (
      <>
        <TopBar />
        <div className="sheet">
          <div className="page-head">
            <h1>The press could not run today.</h1>
            <p>The town is here. The paper will be along shortly.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <TopBar />
      <div className="paper" data-stage={edition.stage}>
        <div className="sheet">
          <Gazette world={world} edition={edition} />
        </div>
      </div>
      <Footer />
    </>
  );
}
