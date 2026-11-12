import type { Metadata } from "next";
import "@fontsource/unifrakturmaguntia/latin-400.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-800.css";
import "@fontsource/playfair-display/latin-900.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "@fontsource/playfair-display/latin-700-italic.css";
import "@fontsource/playfair-display/latin-800-italic.css";
import "@fontsource/playfair-display/latin-900-italic.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-500-italic.css";
import "@fontsource/lora/latin-600-italic.css";
import "@fontsource/oswald/latin-300.css";
import "@fontsource/oswald/latin-400.css";
import "@fontsource/oswald/latin-500.css";
import "./globals.css";

// Fonts are self-hosted (Fontsource) so a Google Fonts fetch failure can no longer
// fail the production build (Nov 5 deploy failure). The --f-* vars live in globals.css.

export const metadata: Metadata = {
  title: "The Greywater Gazette",
  description:
    "A small town that publishes a newspaper. Nobody writes it. It just keeps happening. Serving Greywater Falls since 1887, and the lake somewhat longer.",
  openGraph: {
    title: "The Greywater Gazette",
    description:
      "A living town that publishes a daily paper. Cozy on the surface, with a lake that has gone quiet underneath.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
