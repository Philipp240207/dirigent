"use client"

import { HomeLink } from "../../home-link"
import Link from "next/link"
import { buildingPortrait } from "../../../../client/buildings"
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import type { Building } from "../../../../client/buildings"
import { demoReport, saveReplayTime, hasResidentReport, subscribeDemoSession } from "../../../../client/state"
import { PhotoCamera } from "./photo-camera"
import { VoiceCall } from "../../voice-call"

const languageNames: Record<string, string> = {
  en: "English", de: "German", fr: "French", nl: "Dutch", it: "Italian", pl: "Polish", ar: "Arabic",
}

function languageName(code: string) {
  return languageNames[code] ?? code
}

export function TenantReport({ unit, building, canSimulate, liveResident }: {
  unit: string
  building: Building
  canSimulate: boolean
  liveResident?: { name: string; language: string; agentId?: string }
}) {
  const mock = process.env.NEXT_PUBLIC_MOCK === "true"
  const [caseId, setCaseId] = useState("")
  const reportRequest = useRef<Promise<string> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reportError, setReportError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [voiceStarted, setVoiceStarted] = useState(false)
  const activeReport = useSyncExternalStore(subscribeDemoSession, hasResidentReport, () => false)
  const reported = mock ? canSimulate && activeReport : Boolean(caseId)
  const trackingId = mock ? demoReport.case_id : caseId
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [error, setError] = useState("")
  const [cameraOpen, setCameraOpen] = useState(false)

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview)
  }, [preview])

  function attachPhoto(file: File) {
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  function createCase(description: string) {
    if (reportRequest.current) return reportRequest.current
    setSubmitting(true)
    setReportError("")
    const request = fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // tenant_language is required by POST /api/cases; building_id is sent for the record.
      body: JSON.stringify({ building_id: building.id, unit_id: unit, description, tenant_language: liveResident?.language ?? "en" }),
    }).then(async response => {
      if (!response.ok) throw new Error()
      const result = await response.json()
      if (typeof result.case_id !== "string" || !result.case_id) throw new Error()
      setCaseId(result.case_id)
      return result.case_id as string
    }).catch(() => {
      setReportError("The report could not be saved. Please try again.")
      reportRequest.current = null
      throw new Error("Case could not be created.")
    }).finally(() => setSubmitting(false))
    reportRequest.current = request
    return request
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const description = String(new FormData(event.currentTarget).get("description") ?? "").trim()
    if (description) void createCase(description).catch(() => {})
  }

  async function uploadPhoto() {
    if (!photo || uploading) return
    setUploading(true)
    setError("")
    try {
      const form = new FormData()
      form.set("file", photo)
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/photo`, { method: "POST", body: form })
      if (!response.ok) {
        setError(response.status === 413 ? "Choose an image up to 8 MiB."
          : response.status === 415 ? "Choose a JPEG, PNG or WebP photo."
          : "The photo could not be sent. Try again.")
        return
      }
      setUploaded(true)
    } catch {
      setError("The photo could not be sent. Try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="tenant-page">
      <header className="topbar">
        <HomeLink href={`/tenant/${unit}?building=${building.id}`} />
        <span className="mode">Resident portal</span>
      </header>
      <div className="heading"><h1>{reported ? "Your repair" : "Report a repair"}</h1></div>
      <div className="tenant-location" aria-label="Your apartment">
          <img src={buildingPortrait(building)} width="72" height="76" alt="" />
        <div><strong>{building.address}</strong><p>{building.city}</p></div>
        <span>Apartment {unit}</span>
      </div>
      <section className="report-card" aria-labelledby="report-heading">
        <h2 id="report-heading" role={reported ? "status" : undefined}>{reported ? "Water leak reported" : (mock ? canSimulate : liveResident) ? "Talk to your property assistant" : "Repair requests"}</h2>
        {reported ? (
          <>
            <p>{mock ? "Your property manager has received your report about the leak by the ceiling lamp." : "Your property manager has received your report."}</p>
            <Link className="primary-link" href={`/track/${trackingId}`}>Track this repair</Link>
            <details className="report-photo" onToggle={event => { if (!event.currentTarget.open) setCameraOpen(false) }}>
              <summary>{uploaded ? "Damage photo sent" : photo ? "Damage photo attached" : "Add a photo (optional)"}</summary>
              {uploaded ? <p role="status">The photo was sent to your property manager.</p> : <fieldset className="photo-fields" disabled={uploading}>
              {photo && preview && !cameraOpen && (
                <div className="photo-attachment">
                  <img className="damage-preview" src={preview} alt="Damage photo preview" />
                  <div className="attachment-actions">
                    <button type="button" className="secondary" onClick={() => setCameraOpen(true)}>Retake</button>
                    <button type="button" className="remove-photo" onClick={() => {
                      setPhoto(null)
                      setPreview("")
                      setError("")
                    }}>Remove</button>
                  </div>
                </div>
              )}
              {cameraOpen && (
                <PhotoCamera onClose={() => setCameraOpen(false)} onCapture={(captured) => {
                  setError("")
                  attachPhoto(captured)
                  setCameraOpen(false)
                }} />
              )}
              <div className="photo-actions">
                {!photo && !cameraOpen && (
                  <button type="button" onClick={() => setCameraOpen(true)}>Take photo</button>
                )}
                <label className="file-button" htmlFor="damage-photo">
                  {photo ? "Replace from file" : "Choose a file"}
                  <input id="damage-photo" type="file" accept={mock ? "image/*" : "image/jpeg,image/png,image/webp"} aria-describedby="photo-note" onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (!file) return
                    event.currentTarget.value = ""
                    if (!file.type.startsWith("image/")) {
                      setError("Choose an image file.")
                      return
                    }
                    setError("")
                    setCameraOpen(false)
                    attachPhoto(file)
                  }} />
                </label>
              </div>
              <p id="photo-note">{mock ? "The photo stays on this device. The demo uses its sample assessment." : "JPEG, PNG or WebP up to 8 MiB."}</p>
              {!mock && photo && !cameraOpen && <button type="button" className="call-button" onClick={uploadPhoto}>{uploading ? "Sending…" : "Send photo"}</button>}
              </fieldset>}
              {error && <p role="alert">{error}</p>}
            </details>
          </>
        ) : mock && canSimulate ? (
          <>
            <p>Simulate Daniel’s call to report a leak from the living room ceiling.</p>
            <button className="call-button" type="button" onClick={() => saveReplayTime(0)}>Simulate call</button>
          </>
        ) : !mock && liveResident ? (
          <div className="written-report">
            <form onSubmit={submitReport}>
              <label>Describe the water leak<textarea name="description" rows={3} required /></label>
              <button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send written report"}</button>
            </form>
          </div>
        ) : <p>There is no active repair scenario for this apartment in the demo.</p>}
        {!mock && liveResident?.agentId && (!reported || voiceStarted) && (
          <VoiceCall agentId={liveResident.agentId} startLabel="Talk to your property manager"
            language={liveResident.language}
            dynamicVariables={{ unit_id: unit, tenant_name: liveResident.name, language: languageName(liveResident.language) }}
            clientTools={{
              create_case: async ({ description }) => {
                if (typeof description !== "string" || !description.trim()) return "No description given. Ask the resident what happened."
                // Keep the call mounted once the report exists, so the conversation continues.
                setVoiceStarted(true)
                try {
                  await createCase(description.trim())
                  return "Case created"
                } catch {
                  return "Case could not be created. Ask the resident to use the written form."
                }
              },
            }} />
        )}
        {reportError && <p role="alert">{reportError}</p>}
      </section>
      {mock && reported && <details className="demo-views"><summary>Demo views</summary><div>
        <Link href={`/dashboard?report=${demoReport.case_id}`}>Property manager</Link>
      </div></details>}
    </main>
  )
}
