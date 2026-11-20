"use client"

import { useEffect, useRef, useState } from "react"

export function PhotoCamera({ onCapture, onClose }: {
  onCapture: (photo: File) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const active = useRef(false)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    active.current = true
    let cancelled = false
    let stream: MediaStream | undefined
    const player = video.current

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access requires localhost or HTTPS. You can still choose an image file.")
        return
      }
      try {
        const result = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        })
        if (cancelled || !player) {
          result.getTracks().forEach((track) => track.stop())
          return
        }
        stream = result
        player.srcObject = stream
      } catch (cause) {
        if (cancelled) return
        const denied = cause instanceof DOMException && cause.name === "NotAllowedError"
        setError(denied
          ? "Camera access was blocked. Allow it in your browser settings and try again."
          : "Could not open the camera. Check that it is connected and available.")
      }
    }

    void startCamera()
    return () => {
      cancelled = true
      active.current = false
      stream?.getTracks().forEach((track) => track.stop())
      if (player) player.srcObject = null
    }
  }, [])

  function takeSnapshot() {
    const player = video.current
    if (!player?.videoWidth || !player.videoHeight || capturing) return

    const canvas = document.createElement("canvas")
    canvas.width = player.videoWidth
    canvas.height = player.videoHeight
    const context = canvas.getContext("2d")
    if (!context) {
      setError("Could not take the photo. Try again or choose an image file.")
      return
    }
    context.drawImage(player, 0, 0)
    setCapturing(true)
    canvas.toBlob((blob) => {
      if (!active.current) return
      setCapturing(false)
      if (!blob) {
        setError("Could not save the photo. Try again or choose an image file.")
        return
      }
      onCapture(new File([blob], "damage-photo.jpg", { type: "image/jpeg" }))
    }, "image/jpeg", 0.9)
  }

  return (
    <div className="photo-camera" role="group" aria-label="Camera">
      {!ready && !error && <p role="status">Opening the camera…</p>}
      {error && <p role="alert">{error}</p>}
      <video ref={video} hidden={!ready} autoPlay playsInline muted onPlaying={() => setReady(true)} aria-label="Live camera preview" />
      <div className="photo-actions">
        {ready && <button type="button" onClick={takeSnapshot} disabled={capturing}>Capture photo</button>}
        <button type="button" className="secondary" onClick={onClose}>Close camera</button>
      </div>
    </div>
  )
}
