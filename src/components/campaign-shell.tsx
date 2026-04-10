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
  return (
    <main className="sheet-shell campaign-shell">
      <div className="sheet-page campaign-page">
        <section className="campaign-topbar">
          <div className="campaign-brand">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
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
