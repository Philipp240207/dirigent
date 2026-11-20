import { demoConnectorActivation, demoConnectorDraft, demoConnectorEnd, demoMoveIn, readConnectorDemo } from "../../../client/state"

const sampleText = "RheinNet Glasfaser offers fiber internet to new residents. When someone moves in, prepare a service order and call the resident to confirm the tariff and activation date."

export function ConnectorDemo({ elapsed, text, onTextChange, onDraft, onActivate, onMoveIn, onOutbox }: {
  elapsed: number
  text: string
  onTextChange: (value: string) => void
  onDraft: () => void
  onActivate: () => void
  onMoveIn: () => void
  onOutbox: () => void
}) {
  const drafted = elapsed >= demoConnectorDraft.at_s
  const active = elapsed >= demoConnectorActivation.at_s
  const movedIn = elapsed >= demoMoveIn.at_s
  const complete = elapsed >= demoConnectorEnd
  const replay = readConnectorDemo(elapsed)
  const orderReady = replay.some((event) => event.kind === "order")
  const callStarted = replay.some((event) => event.kind === "call_started")

  return (
    <details className="building-disclosure" id="connector-panel">
      <summary>Connectors{active && <span>RheinNet active</span>}</summary>
      <div className="building-disclosure-content connector-demo">
        <h2>RheinNet Glasfaser</h2>
        {!drafted ? (
          <form onSubmit={(event) => {
            event.preventDefault()
            if (text.trim()) onDraft()
          }}>
            <label htmlFor="connector-description">Partner description</label>
            <textarea id="connector-description" value={text} onChange={(event) => onTextChange(event.currentTarget.value)} rows={4} required aria-describedby="connector-note" />
            <p id="connector-note">The local demo uses a preset RheinNet draft.</p>
            <div className="connector-actions">
              <button type="submit" disabled={!text.trim()}>Draft connector</button>
              <button type="button" className="secondary" onClick={() => onTextChange(sampleText)}>Use sample</button>
            </div>
          </form>
        ) : (
          <>
            <p aria-live="polite">{complete ? "Lucas confirmed his tariff and activation date in the simulated French call."
              : callStarted ? "Simulating a call to Lucas in French…"
              : orderReady ? "Service order ready for RheinNet."
              : movedIn ? "Preparing the service order for apartment 4.2…"
              : active ? "Ready to prepare an internet order when Lucas moves in."
              : "Draft ready. This connector runs when a resident moves in."}</p>
            <details className="connector-json">
              <summary>View connector JSON</summary>
              <pre>{JSON.stringify(demoConnectorDraft.payload.connector, null, 2)}</pre>
            </details>
            <div className="connector-actions">
              {!active && <button type="button" onClick={onActivate}>Activate connector</button>}
              {active && !movedIn && <button type="button" onClick={onMoveIn}>Lucas moves into 4.2</button>}
              {orderReady && <button type="button" className="secondary" onClick={onOutbox}>View order in Outbox</button>}
            </div>
          </>
        )}
      </div>
    </details>
  )
}
