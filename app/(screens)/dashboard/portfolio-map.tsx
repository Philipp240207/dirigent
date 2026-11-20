"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap } from "leaflet"
import "leaflet/dist/leaflet.css"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Building } from "../../../client/buildings"
import { portfolioMapStyle } from "./portfolio-map-style"

export type MapState = "clear" | "attention" | "approval" | "scheduled" | "completed"

type Location = { building: Building; status: string; state: MapState }

// Demo pins are approximate; these coordinates do not identify individual properties.
const demoCoordinates: Record<Building["id"], [number, number]> = {
  "ksw-12": [51.237, 6.774],
  "lind-48": [51.229, 6.800],
  "park-7": [51.235, 6.786],
}

const trackpadPinchSpeed = 5

const legend: { state: MapState; label: string }[] = [
  { state: "attention", label: "Open case" },
  { state: "approval", label: "Awaiting approval" },
  { state: "scheduled", label: "Scheduled" },
  { state: "completed", label: "Repaired" },
  { state: "clear", label: "No case" },
]

const houseIcon = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path class="map-house-depth" d="m25 4 19 14v20l-7 6H9V23z" />
  <path class="map-house-front" d="M6 22 23 7l15 14v22H6z" />
  <path class="map-house-roof" d="M2 21 23 3l22 14-7 7L23 12 6 27z" />
  <path fill="white" fill-opacity=".9" d="M12 27h6v6h-6zM24 27h7v16h-7z" />
</svg>`

export function PortfolioMap({ locations, onSelect }: {
  locations: Location[]
  onSelect: (id: Building["id"]) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const select = useRef(onSelect)
  const resetView = useRef<(() => void) | null>(null)
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [notice, setNotice] = useState("Loading city map…")

  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const element = container.current
    if (!element) return

    let cancelled = false
    let instance: LeafletMap | undefined
    let resize: ResizeObserver | undefined

    // Safari on macOS reports trackpad pinches as gesture events. Chrome
    // reports them as wheel events, which Leaflet already handles.
    let pinchStartZoom: number | undefined
    function startPinch(event: Event) {
      if (!instance) return
      event.preventDefault()
      pinchStartZoom = instance.getZoom()
    }

    function changePinch(event: Event) {
      if (!instance || pinchStartZoom === undefined) return
      const { scale } = event as Event & { scale: number }
      if (!(scale > 0)) return
      event.preventDefault()
      const nextZoom = pinchStartZoom + Math.log2(scale) * trackpadPinchSpeed
      instance.setZoomAround(instance.mouseEventToContainerPoint(event as MouseEvent), nextZoom, { animate: false })
    }

    function endPinch(event: Event) {
      if (pinchStartZoom === undefined) return
      event.preventDefault()
      pinchStartZoom = undefined
    }

    element.addEventListener("gesturestart", startPinch, { passive: false })
    element.addEventListener("gesturechange", changePinch, { passive: false })
    element.addEventListener("gestureend", endPinch, { passive: false })

    void import("leaflet").then((L) => {
      if (cancelled) return
      instance = L.map(element, {
        scrollWheelZoom: true,
        touchZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 10,
        minZoom: 10,
        maxZoom: 19,
      })
      instance.zoomControl.setPosition("bottomleft")
      const bounds = L.latLngBounds(Object.values(demoCoordinates))
      resetView.current = () => instance?.fitBounds(bounds, { padding: [42, 51], maxZoom: 15, animate: false })
      resetView.current()
      instance.attributionControl.setPrefix(false)
      resize = new ResizeObserver(() => {
        instance?.invalidateSize({ pan: false })
      })
      resize.observe(element)

      const baseMap = instance
      const fallback = () => {
        if (cancelled) return
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          updateWhenIdle: true,
          maxZoom: 19,
          className: "portfolio-raster-fallback",
        }).on("tileload", () => setNotice(""))
          .on("tileerror", () => setNotice("Map tiles unavailable. You can still open buildings."))
          .addTo(baseMap)
      }

      const testContext = document.createElement("canvas").getContext("webgl2")
      if (testContext) {
        testContext.getExtension("WEBGL_lose_context")?.loseContext()
        void import("@maplibre/maplibre-gl-leaflet").then(({ maplibreGL }) => {
          if (cancelled) return
          const layer = maplibreGL({ style: portfolioMapStyle, interactive: false })
          try {
            layer.addTo(baseMap)
          } catch {
            // A WebGL context may still fail after the capability check.
            if (!layer.getMaplibreMap()) {
              layer.onRemove = () => {
                layer.getContainer()?.remove()
                return layer
              }
            }
            baseMap.removeLayer(layer)
            fallback()
            return
          }
          const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          baseMap.attributionControl.addAttribution(attribution)
          const vector = layer.getMaplibreMap()
          vector.once("load", () => setNotice(""))
          vector.on("error", (event) => {
            if (cancelled || !baseMap.hasLayer(layer)) return
            if (vector.loaded() || ("tile" in event && vector.isStyleLoaded())) return
            baseMap.removeLayer(layer)
            baseMap.attributionControl.removeAttribution(attribution)
            fallback()
          })
        }).catch(fallback)
      } else {
        fallback()
      }
      setMap(instance)
    }).catch(() => {
      if (!cancelled) setNotice("The map could not load. Use the building list.")
    })

    return () => {
      cancelled = true
      resetView.current = null
      element.removeEventListener("gesturestart", startPinch)
      element.removeEventListener("gesturechange", changePinch)
      element.removeEventListener("gestureend", endPinch)
      resize?.disconnect()
      instance?.remove()
    }
  }, [])

  useEffect(() => {
    if (!map) return
    let cancelled = false
    const markers: import("leaflet").Marker[] = []

    void import("leaflet").then((L) => {
      if (cancelled) return
      for (const { building, status, state } of locations) {
        const label = `${building.address} · ${status}`
        const icon = document.createElement("div")
        icon.className = "map-house-marker"
        icon.dataset.state = state
        icon.setAttribute("aria-hidden", "true")
        icon.innerHTML = houseIcon
        const number = document.createElement("span")
        number.textContent = building.address.split(" ").at(-1) ?? ""
        icon.append(number)

        const marker = L.marker(demoCoordinates[building.id], {
          icon: L.divIcon({ html: icon, className: "portfolio-map-pin", iconSize: [48, 60], iconAnchor: [24, 48] }),
          title: label,
          riseOnHover: true,
        }).on("click", () => select.current(building.id)).addTo(map)
        const target = marker.getElement()
        target?.setAttribute("aria-label", label)
        target?.addEventListener("keydown", (event) => {
          if (event.key !== " ") return
          event.preventDefault()
          select.current(building.id)
        })
        markers.push(marker)
      }
    })
    return () => {
      cancelled = true
      markers.forEach((marker) => marker.remove())
    }
  }, [map, locations])

  return (
    <aside className="portfolio-map" aria-labelledby="portfolio-map-title">
      <div className="portfolio-map-heading">
        <div>
          <h3 id="portfolio-map-title">Düsseldorf</h3>
          <p>Approximate demo locations</p>
        </div>
        <button className="map-reset" type="button" disabled={!map} onClick={() => resetView.current?.()}>Reset map view</button>
      </div>
      <div className="portfolio-map-canvas">
        <div className="portfolio-map-tiles" ref={container} aria-label="Interactive city map of Düsseldorf" />
        {(notice || !locations.length) && (
          <p role="status" className="map-empty">{!locations.length ? "No matching buildings." : notice}</p>
        )}
      </div>
      <ul className="map-legend" aria-label="Map legend">
        {legend.map(({ state, label }) => <li key={state}><span data-state={state} aria-hidden="true" />{label}</li>)}
      </ul>
    </aside>
  )
}
