"use client"

import { ConversationProvider, useConversation } from "@elevenlabs/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Mode = "dispatch" | "report"

type IncomingCallProps = {
  agentId: string
  caseId: string
  partnerId: string
  mode: Mode
  caller: string
  fallbackBriefing: string
  /** The job is done: show nothing once the call has ended. */
  completed: boolean
}

export function IncomingCall(props: IncomingCallProps) {
  return <ConversationProvider><IncomingCallControls {...props} /></ConversationProvider>
}

async function postUpdate(caseId: string, path: "slot" | "result", body: Record<string, unknown>) {
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return response.ok
}

async function loadBriefing(caseId: string, partnerId: string) {
  const query = new URLSearchParams({ case_id: caseId, partner_id: partnerId })
  const response = await fetch(`/api/partner-job?${query}`, { cache: "no-store" })
  if (!response.ok) return ""
  const job = await response.json() as { briefing?: unknown }
  return typeof job.briefing === "string" ? job.briefing : ""
}

function IncomingCallControls({ agentId, caseId, partnerId, mode, caller, fallbackBriefing, completed }: IncomingCallProps) {
  const router = useRouter()
  const [declined, setDeclined] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")
  const conversation = useConversation({
    onError: () => setError("Der Anruf wurde unterbrochen. Mikrofon prüfen und erneut annehmen."),
    onDisconnect: () => router.refresh(),
    clientTools: {
      confirm_slot: async ({ slot }) => {
        if (typeof slot !== "string" || !slot.trim()) return "No slot given. Ask for a date and time."
        const saved = await postUpdate(caseId, "slot", { partner_id: partnerId, slot: slot.trim() }).catch(() => false)
        if (!saved) return "Could not save the slot."
        router.refresh()
        return "Saved"
      },
      report_result: async ({ cost_eur, work_description }) => {
        const cost = typeof cost_eur === "string" ? Number(cost_eur) : cost_eur
        if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0 ||
            typeof work_description !== "string" || !work_description.trim()) {
          return "Need the work done and the final cost in euros."
        }
        const saved = await postUpdate(caseId, "result", { partner_id: partnerId, cost_eur: cost, work_description: work_description.trim() }).catch(() => false)
        if (!saved) return "Could not save the result."
        router.refresh()
        return "Saved"
      },
    },
  })
  const idle = conversation.status !== "connected" && conversation.status !== "connecting"

  async function accept() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Die Seite über localhost oder HTTPS öffnen, damit das Mikrofon funktioniert.")
      return
    }
    setStarting(true)
    setError("")
    try {
      const briefing = await loadBriefing(caseId, partnerId).catch(() => "") || fallbackBriefing
      // No first message override: the agent waits until the partner speaks ("Krause hier").
      await conversation.startSession({
        agentId,
        connectionType: "webrtc",
        dynamicVariables: { case_id: caseId, mode, briefing },
        overrides: { agent: { language: "de" } },
      })
    } catch {
      setError("Der Anruf konnte nicht verbunden werden. Mikrofon erlauben und erneut annehmen.")
    } finally {
      setStarting(false)
    }
  }

  if (completed && idle) return null

  if (declined && idle) {
    return <section className="incoming-call" data-state="declined" aria-label="Anruf abgelehnt">
      <p>Anruf abgelehnt.</p>
      <button type="button" className="secondary" onClick={() => setDeclined(false)}>Zurückrufen</button>
    </section>
  }

  return <section className="incoming-call" data-state={idle ? "ringing" : "active"} aria-live="polite">
    <p className="incoming-label">{idle ? "Eingehender Anruf" : conversation.status === "connecting" ? "Verbinde…" : "Im Gespräch"}</p>
    <p className="incoming-caller">{caller}</p>
    <p className="incoming-topic">{mode === "dispatch" ? "Neuer Auftrag: Termin abstimmen" : "Auftrag abschließen: Arbeit und Kosten melden"}</p>
    {idle ? <div className="incoming-actions">
      <button type="button" className="decline" onClick={() => setDeclined(true)} disabled={starting}>Ablehnen</button>
      <button type="button" className="accept" onClick={accept} disabled={starting}>{starting ? "Verbinde…" : "Annehmen"}</button>
    </div> : <div className="incoming-actions">
      <button type="button" className="decline" onClick={() => conversation.endSession()}>Auflegen</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>
}
