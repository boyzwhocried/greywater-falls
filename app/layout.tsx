import type { Metadata } from "next";
import { UnifrakturMaguntia, Playfair_Display, Lora, Oswald } from "next/font/google";
import "./globals.css";

const nameplate = UnifrakturMaguntia({
  weight: "400",
  subsets: ["latin"],
  variable: "--f-nameplate",
  display: "swap",
});
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const body = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--f-body",
  display: "swap",
});
const label = Oswald({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--f-label",
  display: "swap",
});

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
      <body
        className={`${nameplate.variable} ${display.variable} ${body.variable} ${label.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
