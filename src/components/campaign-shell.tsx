import Link from "next/link";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/ui/app-icon";

export function CampaignShell({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  const resolvedTitle = title || "Codex of Echoes";
  const resolvedEyebrow = eyebrow || "";
  const resolvedDescription = description || "";
  return (
    <main className="sheet-shell campaign-shell">
      <div className="sheet-page campaign-page">
        <section className="campaign-topbar">
          <div className="campaign-brand minimal">
            {resolvedEyebrow ? <span className="eyebrow">{resolvedEyebrow}</span> : null}
            <h1>{resolvedTitle}</h1>
            {resolvedDescription ? <p>{resolvedDescription}</p> : null}
          </div>

          <nav className="campaign-nav">
            <Link href="/campaign/creator">
              <AppIcon name="wand" className="nav-icon" />
              <span>Creator</span>
            </Link>
            <Link href="/campaign/sheet">
              <AppIcon name="scroll" className="nav-icon" />
              <span>Sheet</span>
            </Link>
          </nav>
        </section>

        {children}
      </div>
    </main>
  );
}
