import type { LayerSpecification, StyleSpecification } from "maplibre-gl"

const majorRoads = ["motorway", "trunk", "primary", "secondary"]
const source = "city"
const surface = "#eeede4"
const street = "#fffefa"
const streetEdge = "#d0cfc2"
const water = "#a4c9f3"
const park = "#79a653"
const localRoads = ["tertiary", "minor"]


const layers: LayerSpecification[] = [
  { id: "land", type: "background", paint: { "background-color": surface } },
  {
    id: "urban-blocks", type: "fill", source, "source-layer": "landuse",
    filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "retail", "industrial"]]],
    paint: { "fill-color": "#dbd9cc", "fill-outline-color": "#f6f5ee" },
  },
  {
    id: "parks", type: "fill", source, "source-layer": "park",
    paint: { "fill-color": park },
  },
  {
    id: "green-space", type: "fill", source, "source-layer": "landcover",
    filter: ["in", ["get", "class"], ["literal", ["grass", "wood"]]],
    paint: { "fill-color": ["match", ["get", "class"], "wood", "#89ad66", "#a6bd82"] },
  },
  {
    id: "water", type: "fill", source, "source-layer": "water",
    paint: { "fill-color": water },
  },
  {
    id: "waterways", type: "line", source, "source-layer": "waterway", minzoom: 12,
    filter: ["in", ["get", "class"], ["literal", ["river", "canal"]]],
    paint: { "line-color": water, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 17, 4] },
  },
  {
    id: "building-footprints", type: "fill", source, "source-layer": "building", minzoom: 14.5,
    paint: {
      "fill-color": "#a4a59d",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, .42, 17, .88],
    },
  },
  {
    id: "pathways", type: "line", source, "source-layer": "transportation", minzoom: 15.5,
    filter: ["all", ["==", ["get", "class"], "path"], ["in", ["get", "subclass"], ["literal", ["footway", "pedestrian", "path"]]], ["!=", ["get", "brunnel"], "tunnel"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#f2efd7",
      "line-width": ["interpolate", ["linear"], ["zoom"], 15.5, .65, 18, 1.8],
    },
  },
  {
    id: "connecting-street-outline", type: "line", source, "source-layer": "transportation", minzoom: 14,
    filter: ["all", ["in", ["get", "class"], ["literal", localRoads]], ["!=", ["get", "brunnel"], "tunnel"], ["!=", ["get", "ramp"], 1]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": streetEdge,
      "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2.9, 16, 5.6, 19, 13],
    },
  },
  {
    id: "main-street-outline", type: "line", source, "source-layer": "transportation",
    filter: ["all", ["in", ["get", "class"], ["literal", majorRoads]], ["!=", ["get", "brunnel"], "tunnel"], ["!=", ["get", "ramp"], 1]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": streetEdge,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.1, 13, 5.7, 16, 10.2, 19, 19],
    },
  },
  {
    id: "connecting-streets", type: "line", source, "source-layer": "transportation", minzoom: 14,
    filter: ["all", ["in", ["get", "class"], ["literal", localRoads]], ["!=", ["get", "brunnel"], "tunnel"], ["!=", ["get", "ramp"], 1]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": street,
      "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 16, 4.4, 19, 11],
    },
  },
  {
    id: "main-streets", type: "line", source, "source-layer": "transportation",
    filter: ["all", ["in", ["get", "class"], ["literal", majorRoads]], ["!=", ["get", "brunnel"], "tunnel"], ["!=", ["get", "ramp"], 1]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": street,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 13, 4.5, 16, 8.5, 19, 16],
    },
  },
  {
    id: "river-names", type: "symbol", source, "source-layer": "waterway", minzoom: 11,
    filter: ["all", ["==", ["get", "class"], "river"], ["has", "name"]],
    layout: {
      "symbol-placement": "line", "symbol-spacing": 310,
      "text-field": ["coalesce", ["get", "name:de"], ["get", "name"]],
      "text-font": ["Noto Sans Italic"], "text-size": 12,
    },
    paint: { "text-color": "#2f6174", "text-halo-color": water, "text-halo-width": 1 },
  },
  {
    id: "city-names", type: "symbol", source, "source-layer": "place", maxzoom: 15,
    filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
    layout: {
      "text-field": ["coalesce", ["get", "name:de"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"], "text-size": 15,
    },
    paint: { "text-color": "#354b55", "text-halo-color": surface, "text-halo-width": 1.25 },
  },
  {
    id: "street-names", type: "symbol", source, "source-layer": "transportation_name", minzoom: 17,
    filter: ["in", ["get", "class"], ["literal", majorRoads]],
    layout: {
      "symbol-placement": "line", "symbol-spacing": 360,
      "text-field": ["coalesce", ["get", "name:de"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"], "text-size": 11,
    },
    paint: { "text-color": "#50616a", "text-halo-color": "#fffdf8", "text-halo-width": 1.2 },
  },
]

export const portfolioMapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    [source]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers,
}
