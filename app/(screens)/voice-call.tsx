"use client"

import { ConversationProvider, useConversation, type UseConversationOptions } from "@elevenlabs/react"
import { useState } from "react"

type VoiceCallProps = {
  agentId: string
  dynamicVariables: NonNullable<Parameters<ReturnType<typeof useConversation>["startSession"]>[0]>["dynamicVariables"]
  clientTools: UseConversationOptions["clientTools"]
  startLabel: string
  onDisconnect?: () => void
  onClosed?: () => void
}

export function VoiceCall(props: VoiceCallProps) {
  return <ConversationProvider><VoiceControls {...props} /></ConversationProvider>
}

function VoiceControls({ agentId, dynamicVariables, clientTools, startLabel, onDisconnect, onClosed }: VoiceCallProps) {
  const [error, setError] = useState("")
  const conversation = useConversation({
    onError: () => setError("The call could not continue. Check microphone access and try again."),
    clientTools,
    onDisconnect,
  })
  const idle = conversation.status === "disconnected"
  const connecting = conversation.status === "connecting"

  function startCall() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Open the report on localhost or over HTTPS to use the microphone.")
      return
    }
    setError("")
    conversation.startSession({
      agentId,
      connectionType: "webrtc",
      dynamicVariables,
    })
  }

  return <div className="voice-report">
    {idle ? <button className="call-button" type="button" onClick={startCall}>{startLabel}</button>
      : <button className="secondary" type="button" onClick={conversation.endSession}>{connecting ? "Cancel call" : "End call"}</button>}
    {idle && onClosed && <button className="secondary" type="button" onClick={onClosed}>Back</button>}
    {connecting && <p role="status">Connecting…</p>}
    {conversation.status === "connected" && <p role="status">Call connected</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}
