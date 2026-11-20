import { useState } from "react"
import electric from "../../../fixtures/electrician-demo.json"
import { advanceElectrician } from "../../../client/state"

export function ElectricianConnector({ step, canActivate, onReview }: {
  step: string; canActivate: boolean; onReview: () => void
}) {
  const [text, setText] = useState("")
  return (
    <section className="workspace-feed connector-demo">
      <h2>Elektro Schmitz</h2>
      {!step ? (
        <form onSubmit={event => { event.preventDefault(); if (text.trim()) advanceElectrician("draft") }}>
          <label htmlFor="electric-description">Partner description</label>
          <textarea id="electric-description" value={text} onChange={event => setText(event.target.value)} rows={3} />
          <p>Local demo uses the Elektro Schmitz sample connector.</p>
          <div className="connector-actions">
            <button disabled={!text.trim()}>Draft connector</button>
            <button type="button" className="secondary" onClick={() => setText("Elektro Schmitz checks lamps and wiring after water damage and reports whether the installation is safe.")}>Use sample</button>
          </div>
        </form>
      ) : (
        <>
          <p>{step === "draft" ? "Draft ready for review." : "Connected to the water damage case."}</p>
          <details className="connector-json"><summary>View connector JSON</summary><pre>{JSON.stringify(electric.connector, null, 2)}</pre></details>
          {step === "draft" ? <>
            {!canActivate && <p>Activation requires an open water leak with electrical damage in the photo assessment.</p>}
            <button disabled={!canActivate} onClick={() => advanceElectrician("active")}>Activate for this case</button>
          </> : <button onClick={onReview}>View electrician job</button>}
        </>
      )}
    </section>
  )
}
