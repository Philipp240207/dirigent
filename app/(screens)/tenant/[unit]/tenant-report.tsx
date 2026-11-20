"use client"

import { HomeLink } from "../../home-link"
import Link from "next/link"
import { buildingPortrait } from "../../../../client/buildings"
import { useEffect, useState, useSyncExternalStore } from "react"
import type { Building } from "../../../../client/buildings"
import { demoReport, saveReplayTime, hasResidentReport, subscribeDemoSession } from "../../../../client/state"
import { PhotoCamera } from "./photo-camera"

export function TenantReport({ unit, building, canSimulate }: { unit: string; building: Building; canSimulate: boolean }) {
  const activeReport = useSyncExternalStore(subscribeDemoSession, hasResidentReport, () => false)
  const reported = canSimulate && activeReport
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [error, setError] = useState("")
  const [cameraOpen, setCameraOpen] = useState(false)

  useEffect(() => {
    if (!photo) return

    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    return <main><h1>Report a repair</h1><p>Tenant voice reporting will be available once the live integration is connected.</p></main>
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
        <h2 id="report-heading" role={reported ? "status" : undefined}>{reported ? "Water leak reported" : canSimulate ? "Talk to your property assistant" : "Repair requests"}</h2>
        {reported ? (
          <>
            <p>Your property manager has received your report about the leak by the ceiling lamp.</p>
            <Link className="primary-link" href={`/track/${demoReport.case_id}`}>Track this repair</Link>
            <details className="report-photo" onToggle={event => { if (!event.currentTarget.open) setCameraOpen(false) }}>
              <summary>{photo ? "Damage photo attached" : "Add a photo (optional)"}</summary>
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
                  setPreview("")
                  setPhoto(captured)
                  setCameraOpen(false)
                }} />
              )}
              <div className="photo-actions">
                {!photo && !cameraOpen && (
                  <button type="button" onClick={() => setCameraOpen(true)}>Take photo</button>
                )}
                <label className="file-button" htmlFor="damage-photo">
                  {photo ? "Replace from file" : "Choose a file"}
                  <input id="damage-photo" type="file" accept="image/*" aria-describedby="photo-note" onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (!file) return
                    event.currentTarget.value = ""
                    if (!file.type.startsWith("image/")) {
                      setError("Choose an image file.")
                      return
                    }
                    setError("")
                    setCameraOpen(false)
                    setPreview("")
                    setPhoto(file)
                  }} />
                </label>
              </div>
              <p id="photo-note">The photo stays on this device. The demo uses its sample assessment.</p>
              {error && <p role="alert">{error}</p>}
            </details>
          </>
        ) : canSimulate ? (
          <>
            <p>Simulate Daniel’s call to report a leak from the living room ceiling.</p>
            <button className="call-button" type="button" onClick={() => saveReplayTime(0)}>Simulate call</button>
          </>
        ) : <p>There is no active repair scenario for this apartment in the local demo.</p>}
      </section>
      {reported && <details className="demo-views"><summary>Demo views</summary><div>
        <Link href={`/dashboard?report=${demoReport.case_id}`}>Property manager</Link>
      </div></details>}
    </main>
  )
}
