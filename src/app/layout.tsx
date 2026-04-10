import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
