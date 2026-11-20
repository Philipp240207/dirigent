"use client"

import { type FormEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"

export function WorkForm({ id, partnerId, schedule }: {
  id: string
  partnerId: string
  schedule: boolean
}) {
  const router = useRouter()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function save(body: { slot: string } | { cost_eur: number; work_description: string }) {
    const response = await fetch(`/api/cases/${encodeURIComponent(id)}/${schedule ? "slot" : "result"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_id: partnerId, ...body }),
    })
    if (!response.ok) throw new Error("Could not save the job update.")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const data = new FormData(event.currentTarget)
    const slot = String(data.get("slot") ?? "").trim()
    const work = String(data.get("work") ?? "").trim()
    const rawCost = String(data.get("cost") ?? "").trim()
    const cost = Number(rawCost)
    if (schedule ? !slot : !work || !rawCost || !Number.isFinite(cost) || cost < 0) {
      setError("Please complete the required fields.")
      return
    }
    lock.current = true
    setBusy(true)
    setError("")
    try {
      await save(schedule ? { slot } : { cost_eur: cost, work_description: work })
    } catch {
      setError("The update could not be confirmed. Check the current job status and try again.")
    } finally {
      router.refresh()
      lock.current = false
      setBusy(false)
    }
  }
  return <>
  <form className="work-form" onSubmit={submit}>
    {schedule ? <label>Visit date and time<input name="slot" required placeholder="e.g. 21 November at 16:00" /></label> : <>
      <label>Work completed<textarea name="work" required rows={2} /></label>
      <label>Final cost (€)<input name="cost" type="number" min="0" step="0.01" required /></label>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="partner-action" disabled={busy}>{busy ? "Saving…" : schedule ? "Confirm appointment" : "Report completion"}</button>
  </form>
  </>
}
