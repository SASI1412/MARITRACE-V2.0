const maplibregl = window.maplibregl;
import * as turf from '@turf/turf';
import { case001 } from '../../data/case001.ts';
import { formatCoord } from '../../utils/geo-utils.js';

let popup = null;

function createOriginPolygons(customCenter = null) {
  const center = customCenter || case001.origin.center;
  const point = turf.point([center.lng, center.lat]);
  
  // Create 3 concentric polygons to represent probability zones
  // 90%, 50%, 10% confidence zones (approximate visual representation)
  const features = [
    turf.ellipse(point, 12, 7, { units: 'kilometers', angle: 45, properties: { type: 'ellipse', confidence: 'LOW', color: '#7c4dff', opacity: 0.1 } }),
    turf.ellipse(point, 8, 4.5, { units: 'kilometers', angle: 45, properties: { type: 'ellipse', confidence: 'MEDIUM', color: '#7c4dff', opacity: 0.2 } }),
    turf.ellipse(point, 4, 2, { units: 'kilometers', angle: 45, properties: { type: 'ellipse', confidence: 'HIGH', color: '#7c4dff', opacity: 0.35 } }),
    turf.point([center.lng, center.lat], { type: 'center-point' })
  ];

  return turf.featureCollection(features);
}

export function addHeatmapLayer(map, customCenter = null) {
  if (!map.getSource('origin-source')) {
    const geojson = createOriginPolygons(customCenter);

    map.addSource('origin-source', {
      type: 'geojson',
      data: geojson
    });

    map.addLayer({
      id: 'heatmap-layer', // using heatmap-layer id for toggles
      type: 'fill',
      source: 'origin-source',
      filter: ['==', 'type', 'ellipse'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity']
      }
    });

    map.addLayer({
      id: 'origin-line',
      type: 'line',
      source: 'origin-source',
      filter: ['==', 'type', 'ellipse'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1,
        'line-opacity': 0.6,
        'line-dasharray': [4, 4]
      }
    });

    map.addLayer({
      id: 'origin-center-dot',
      type: 'circle',
      source: 'origin-source',
      filter: ['==', 'type', 'center-point'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-width': 4,
        'circle-stroke-color': '#7c4dff'
      }
    });

    map.addLayer({
      id: 'origin-label',
      type: 'symbol',
      source: 'origin-source',
      filter: ['==', 'type', 'center-point'],
      layout: {
        'text-field': 'PROBABLE ORIGIN ZONE',
        'text-size': 10,
        'text-offset': [0, 2]
      },
      paint: {
        'text-color': '#d8b4fe', // light purple
        'text-halo-color': 'rgba(10, 15, 25, 0.9)',
        'text-halo-width': 2
      }
    });

    const center = customCenter || case001.origin.center;
    map.on('click', 'heatmap-layer', (e) => {
      if (popup) popup.remove();
      popup = new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <strong>Probable Origin Zone</strong><br>
          Center: ${formatCoord(center.lat, center.lng)}<br>
          Confidence: ${case001.origin.confidence}
        `)
        .addTo(map);
    });
    
    map.on('mouseenter', 'heatmap-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'heatmap-layer', () => { map.getCanvas().style.cursor = ''; });
  } else {
    // Update existing
    map.getSource('origin-source').setData(createOriginPolygons(customCenter));
  }
}

export function removeHeatmapLayer(map) {
  if (popup) popup.remove();
  
  if (map.getLayer('origin-label')) map.removeLayer('origin-label');
  if (map.getLayer('origin-center-dot')) map.removeLayer('origin-center-dot');
  if (map.getLayer('heatmap-layer')) map.removeLayer('heatmap-layer');
  if (map.getLayer('origin-line')) map.removeLayer('origin-line');
  
  if (map.getSource('origin-source')) map.removeSource('origin-source');
}

export function createHeatmapLayer(map) {
  // Handled by addHeatmapLayer
}
