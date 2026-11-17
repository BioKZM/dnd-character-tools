import type { Metadata } from "next";
import { Alegreya, Figtree } from "next/font/google";
import "./globals.css";

// Stil v2: basliklar Alegreya (kitap hissi), metin ve sayilar Figtree.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const alegreya = Alegreya({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Codex of Echoes",
  description:
    "A campaign-first DM workspace for character prep, monster compendiums, travel planning, and scene control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${alegreya.variable}`}>
        {children}
        <footer className="site-credits">
          Icons by <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a>, CC BY 3.0.
        </footer>
      </body>
    </html>
  );
}
