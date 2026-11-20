// Display names for partners the screens know by ID. Unknown IDs fall back to the ID itself.
const names: Record<string, string> = {
  plumber_krause: "Sanitär Krause",
  electrician_schmitz: "Elektro Schmitz",
}

const roles: Record<string, string> = {
  plumber: "plumber",
  electrician: "electrician",
}

export function partnerName(partnerId: unknown) {
  return typeof partnerId === "string" ? names[partnerId] ?? partnerId : "Partner"
}

export function roleLabel(role: unknown) {
  return typeof role === "string" ? roles[role] ?? role : "partner"
}

export function isPartnerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_]+$/.test(value)
}
