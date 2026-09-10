const maplibregl = window.maplibregl;
import { case001 } from '../../data/case001.ts';

function createVectorsGeoJSON(vectors, type) {
  return {
    type: 'FeatureCollection',
    features: vectors.map(v => ({
      type: 'Feature',
      properties: {
        speed: v.speed,
        direction: v.direction,
        type: type,
        // The ➤ character naturally points right (90 degrees). 
        // We subtract 90 to align it with standard geographic bearing.
        rotation: v.direction - 90
      },
      geometry: {
        type: 'Point',
        coordinates: [v.lng, v.lat]
      }
    }))
  };
}

export function addWindCurrentLayer(map) {
  if (map.getSource('wind-source')) return;

  const windGeoJSON = createVectorsGeoJSON(case001.simulation.windVectors, 'Wind');
  const currentGeoJSON = createVectorsGeoJSON(case001.simulation.currentVectors, 'Current');

  map.addSource('wind-source', { type: 'geojson', data: windGeoJSON });
  map.addSource('current-source', { type: 'geojson', data: currentGeoJSON });

  // Wind symbols
  map.addLayer({
    id: 'wind-symbol',
    type: 'symbol',
    source: 'wind-source',
    layout: {
      'text-field': '>',
      'text-rotate': ['get', 'rotation'],
      'text-rotation-alignment': 'map',
      'text-size': ['+', 16, ['*', ['get', 'speed'], 0.5]],
      'text-allow-overlap': true
    },
    paint: {
      'text-color': '#64b5f6',
      'text-halo-color': 'rgba(0,0,0,0.5)',
      'text-halo-width': 1
    }
  });

  // Current symbols
  map.addLayer({
    id: 'current-symbol',
    type: 'symbol',
    source: 'current-source',
    layout: {
      'text-field': '>',
      'text-rotate': ['get', 'rotation'],
      'text-rotation-alignment': 'map',
      'text-size': ['+', 16, ['*', ['get', 'speed'], 5]],
      'text-allow-overlap': true
    },
    paint: {
      'text-color': '#00e5ff',
      'text-halo-color': 'rgba(0,0,0,0.5)',
      'text-halo-width': 1
    }
  });

  // Popups
  let popup = null;
  const setupPopup = (layerId, color) => {
    map.on('click', layerId, (e) => {
      const p = e.features[0].properties;
      if (popup) popup.remove();
      popup = new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <strong style="color:${color};">${p.type}</strong><br>
          Speed: ${p.speed.toFixed(1)} kn<br>
          Direction: ${Math.round(p.direction)}°
        `)
        .addTo(map);
    });
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  };

  setupPopup('wind-symbol', '#64b5f6');
  setupPopup('current-symbol', '#00e5ff');
}

export function removeWindCurrentLayer(map) {
  if (map.getLayer('wind-symbol')) map.removeLayer('wind-symbol');
  if (map.getLayer('current-symbol')) map.removeLayer('current-symbol');
  if (map.getSource('wind-source')) map.removeSource('wind-source');
  if (map.getSource('current-source')) map.removeSource('current-source');
}

export function createWindCurrentLayer() {}
