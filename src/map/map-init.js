import {
  initCoordinateReadout,
  initBasemapSelector,
  initLayerManager,
  renderLegend,
  addGraticuleLayer
} from './gis-controls.js';

const maplibregl = window.maplibregl;

let map = null;

// Free public CARTO Dark Matter basemap (raster tiles, no API key required)
const mapStyle = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    'osm': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    },
    'satellite': {
      type: 'raster',
      tiles: [
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      ],
      tileSize: 256,
      maxzoom: 11,
      attribution: '&copy; Google'
    },
    'light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    }
  },
  layers: [
    {
      id: 'ocean-background',
      type: 'background',
      paint: {
        'background-color': '#0c1f38'
      }
    },
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22,
      layout: { 'visibility': 'none' }
    },
    {
      id: 'light-layer',
      type: 'raster',
      source: 'light',
      minzoom: 0,
      maxzoom: 19,
      layout: { 'visibility': 'none' }
    },
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
      layout: { 'visibility': 'visible' }
    }
  ]
};

export function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: mapStyle,
    center: [71.15, 19.35], // [lng, lat] for MapLibre
    zoom: 9.5,
    maxZoom: 18,
    minZoom: 5,
    attributionControl: false // We'll add it manually to customize position
  });

  window.map = map;

  // Controls
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'top-left');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right');
  map.addControl(new maplibregl.GeolocateControl(), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }), 'bottom-left');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  map.on('load', () => {
    // Add custom ship icon
    const shipSvg = `
      <svg width="12" height="36" viewBox="0 0 12 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 0 L0 10 L0 34 L6 36 L12 34 L12 10 Z" fill="white" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"/>
        <rect x="2" y="18" width="8" height="10" fill="#2c3e50" />
        <rect x="3" y="6" width="6" height="4" fill="#2c3e50" />
      </svg>
    `;
    const img = new Image(12, 36);
    img.onload = () => map.addImage('ship-icon', img, { sdf: true });
    img.src = 'data:image/svg+xml;base64,' + btoa(shipSvg);

    initCoordinateReadout(map);
    initBasemapSelector(map);
    initLayerManager(map);
    renderLegend();
    addGraticuleLayer(map);
  });

  return map;
}

export function getMap() {
  return map;
}

export function flyTo(lat, lng, zoom, durationSecs = 2) {
  if (!map) return;
  map.flyTo({
    center: [lng, lat],
    zoom: zoom,
    duration: durationSecs * 1000,
    essential: true,
    curve: 1.2
  });
}

// Added this to allow map to load fully before adding layers
export function onMapLoad(callback) {
  if (!map) return;
  if (map.loaded()) {
    callback();
  } else {
    map.on('load', callback);
  }
}
