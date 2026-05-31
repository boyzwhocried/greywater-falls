import Link from "next/link";

export function TopBar() {
  return (
    <div className="topbar">
      <span className="edge">Greywater Falls &middot; pop. 9 (the sign disagrees)</span>
      <nav>
        <Link href="/">Today</Link>
        <Link href="/archive">Archive</Link>
        <Link href="/residents">The Townsfolk</Link>
        <Link href="/about">About</Link>
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div>The Greywater Gazette &middot; published daily, fog permitting.</div>
      <div>Serving Greywater Falls since 1887, and the lake somewhat longer.</div>
      <div className="links">
        <Link href="/">Today</Link>
        <Link href="/archive">Archive</Link>
        <Link href="/residents">Townsfolk</Link>
        <Link href="/about">About</Link>
      </div>
    </footer>
  );
}
