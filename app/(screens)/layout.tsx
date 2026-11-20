import { Suspense, type ReactNode } from "react"

export default function ScreensLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main aria-busy="true">Loading Dirigent…</main>}>{children}</Suspense>
}
