const fieldLabels: Record<string, string> = {
  address: "Property address",
  unit_id: "Apartment",
  caretaker_contact: "Caretaker contact",
  key_safe: "Key safe code",
  damage_photo: "Damage photo",
  damage_assessment: "Damage assessment",
  tenant_availability: "Resident availability",
  affected_units: "Affected apartments and areas",
  rent_arrears_eur: "Rent arrears",
  notes: "Internal notes",
}

export function JobContext({ shared, withheld, sent, partner = "Sanitär Krause" }: {
  shared: Record<string, string | number | string[] | undefined>
  withheld: readonly string[]
  partner?: string
  sent: boolean
}) {
  const privateFields = new Set(withheld)
  const sharedFields = Object.entries(shared).filter(([field, value]) => !privateFields.has(field) && value != null)

  return (
    <details className="approval-fields">
      <summary>{sent ? `Information shared with ${partner}` : "Information to share"}</summary>
      <h3>{sent ? `Sent to ${partner}` : `Shared with ${partner} after approval`}</h3>
      <dl>
        {sharedFields.map(([field, value]) => (
          <div key={field}>
            <dt>{fieldLabels[field] ?? field.replaceAll("_", " ")}</dt>
            <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
          </div>
        ))}
      </dl>
      {privateFields.size > 0 && (
        <div className="approval-withheld">
          <h3>Kept private</h3>
          <ul>
            {[...privateFields].map((field) => <li key={field}>{fieldLabels[field] ?? field.replaceAll("_", " ")}</li>)}
          </ul>
        </div>
      )}
    </details>
  )
}
