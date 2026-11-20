import Link from "next/link"

export function HomeLink({ onNavigate, href = "/dashboard" }: { onNavigate?: () => void; href?: string }) {
  return (
    <Link className="wordmark" href={href} aria-label="Dirigent home" onNavigate={onNavigate}>
      <span className="wordmark-icon" aria-hidden="true" />Dirigent
    </Link>
  )
}
