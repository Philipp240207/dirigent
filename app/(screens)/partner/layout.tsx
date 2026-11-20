"use client"

import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import Link from "next/link"
import { HomeLink } from "../home-link"

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const electrician = useSearchParams().get("partner") === "electrician_schmitz"
  return (
    <main className="management-dashboard partner-workspace">
      <header className="topbar management-topbar">
        <HomeLink href={electrician ? "/partner?partner=electrician_schmitz" : "/partner"} />
        <nav className="partner-nav" aria-label="Partner navigation">
          <Link className="nav-link" href={electrician ? "/partner?partner=electrician_schmitz" : "/partner"} aria-current="location">Partner jobs</Link>
        </nav>
      </header>
      <div className="partner-content">{children}</div>
    </main>
  )
}
