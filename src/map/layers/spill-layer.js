const maplibregl = window.maplibregl;
import { case001 } from '../../data/case001.ts';
import { formatArea, formatTimestamp } from '../../utils/format-utils.js';

let popup = null;

export function addSpillLayer(map) {
  if (map.getSource('spill-source')) return;

  map.addSource('spill-source', {
    type: 'geojson',
    data: case001.simulation.observedSlick
  });

  map.addLayer({
    id: 'spill-fill',
    type: 'fill',
    source: 'spill-source',
    paint: {
      'fill-color': '#ff1744',
      'fill-opacity': 0.35
    }
  });

  map.addLayer({
    id: 'spill-line',
    type: 'line',
    source: 'spill-source',
    paint: {
      'line-color': '#ff1744',
      'line-width': 2.5,
      'line-opacity': 0.95
    }
  });

  // Popup logic
  map.on('click', 'spill-fill', (e) => {
    const { areaKm2, detectionTimestamp } = case001.spill;
    
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ closeButton: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-title" style="color:#ff1744; font-weight:700; margin-bottom:8px; font-size:12px; letter-spacing:0.5px;">OBSERVED SAR SPILL</div>
        <div class="popup-row">
          <span class="popup-label">Time</span>
          <span class="popup-value">${formatTimestamp(detectionTimestamp)}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Area</span>
          <span class="popup-value">${formatArea(areaKm2)}</span>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'spill-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'spill-fill', () => { map.getCanvas().style.cursor = ''; });
}

export function removeSpillLayer(map) {
  if (!map) return;
  if (popup) popup.remove();
  
  const layersToRemove = [
    'spill-fill', 
    'spill-line', 
    'ai-spill-fill', 
    'ai-spill-line', 
    'ai-spill-label', 
    'sar-raster-layer'
  ];
  layersToRemove.forEach(layerId => {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  });
  
  const sourcesToRemove = [
    'spill-source', 
    'ai-spill-geojson', 
    'ai-spill-centroid-source', 
    'sar-raster-source'
  ];
  sourcesToRemove.forEach(sourceId => {
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  });
}

// For compatibility with old structure
export function createSpillLayer(map) {
  // Do nothing, initialization is handled in addSpillLayer
}

export function addAISpillLayer(map, geojson, bounds = null) {
  if (!geojson) return;
  
  if (!map.getSource('ai-spill-geojson')) {
    map.addSource('ai-spill-geojson', {
      type: 'geojson',
      data: geojson
    });

    map.addLayer({
      id: 'ai-spill-fill',
      type: 'fill',
      source: 'ai-spill-geojson',
      paint: {
        'fill-color': '#ff1744',
        'fill-opacity': 0.35
      }
    });

    map.addLayer({
      id: 'ai-spill-line',
      type: 'line',
      source: 'ai-spill-geojson',
      paint: {
        'line-color': '#ff1744',
        'line-width': 2.5,
        'line-opacity': 0.95,
      }
    });

    // Add popup for AI spill
    map.on('click', 'ai-spill-fill', (e) => {
      const props = e.features?.[0]?.properties || {};
      const rawConf = Number(props.confidence || 0);
      const conf = Math.round(rawConf);
      
      if (popup) popup.remove();
      popup = new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="popup-title" style="color:#ff1744; font-weight:700; margin-bottom:8px; font-size:12px; letter-spacing:0.5px;">OBSERVED SAR SPILL</div>
          <div class="popup-row" style="display:flex; justify-content:space-between; gap:16px; margin-bottom:4px; font-size:11px;">
            <span class="popup-label" style="color:#94a3b8;">Validation</span>
            <span class="popup-value" style="color:#60a5fa; font-weight:700;">AI SAR Analysis</span>
          </div>
          <div class="popup-row" style="display:flex; justify-content:space-between; gap:16px; margin-bottom:4px; font-size:11px;">
            <span class="popup-label" style="color:#94a3b8;">Confidence</span>
            <span class="popup-value" style="color:#ff1744; font-weight:800; font-family:'JetBrains Mono',monospace;">${conf}%</span>
          </div>
          <div class="popup-row" style="display:flex; justify-content:space-between; gap:16px; margin-bottom:4px; font-size:11px;">
            <span class="popup-label" style="color:#94a3b8;">Status</span>
            <span class="popup-value" style="color:#34d399; font-weight:700;">INVESTIGATION ELIGIBLE</span>
          </div>
          ${props.pixel_count ? `
          <div class="popup-row" style="display:flex; justify-content:space-between; gap:16px; font-size:11px;">
            <span class="popup-label" style="color:#94a3b8;">Anomaly Pixels</span>
            <span class="popup-value" style="color:#cbd5e1; font-family:'JetBrains Mono',monospace;">${props.pixel_count}</span>
          </div>` : ''}
        `)
        .addTo(map);
    });

    map.on('mouseenter', 'ai-spill-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'ai-spill-fill', () => { map.getCanvas().style.cursor = ''; });
  } else {
    map.getSource('ai-spill-geojson').setData(geojson);
  }

  // Calculate bounds to fit map and place single label at centroid
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  let hasCoords = false;
  
  if (geojson.features) {
    geojson.features.forEach(f => {
      if (f.geometry && f.geometry.coordinates) {
        f.geometry.coordinates.forEach(poly => {
          poly.forEach(coord => {
            minLng = Math.min(minLng, coord[0]);
            maxLng = Math.max(maxLng, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLat = Math.max(maxLat, coord[1]);
            hasCoords = true;
          });
        });
      }
    });
  }

  // Centroid point for a single clean map label
  const centerLng = bounds ? (bounds.west + bounds.east) / 2 : (hasCoords ? (minLng + maxLng) / 2 : 71.25);
  const centerLat = bounds ? (bounds.south + bounds.north) / 2 : (hasCoords ? (minLat + maxLat) / 2 : 19.35);

  const centroidGeoJSON = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [centerLng, centerLat]
      },
      properties: {
        title: 'OBSERVED SAR SPILL'
      }
    }]
  };

  if (!map.getSource('ai-spill-centroid-source')) {
    map.addSource('ai-spill-centroid-source', {
      type: 'geojson',
      data: centroidGeoJSON
    });

    map.addLayer({
      id: 'ai-spill-label',
      type: 'symbol',
      source: 'ai-spill-centroid-source',
      layout: {
        'text-field': 'OBSERVED SAR SPILL',
        'text-size': 11,
        'text-offset': [0, -1.8],
        'text-anchor': 'bottom',
        'text-letter-spacing': 0.1
      },
      paint: {
        'text-color': '#ff1744',
        'text-halo-color': 'rgba(10, 15, 25, 0.95)',
        'text-halo-width': 2
      }
    });
  } else {
    map.getSource('ai-spill-centroid-source').setData(centroidGeoJSON);
  }

  if (bounds) {
    map.fitBounds([
      [bounds.west, bounds.south],
      [bounds.east, bounds.north]
    ], { padding: 80, duration: 2500, curve: 1.5 });
  } else if (hasCoords) {
    map.fitBounds([
      [minLng, minLat],
      [maxLng, maxLat]
    ], { padding: 80, duration: 2500, curve: 1.5 });
  }
}

export function addSARRasterOverlay(map, imageUrl, bounds) {
  if (!imageUrl || !bounds) return;
  
  if (map.getSource('sar-raster-source')) {
    map.removeLayer('sar-raster-layer');
    map.removeSource('sar-raster-source');
  }

  map.addSource('sar-raster-source', {
    type: 'image',
    url: imageUrl,
    coordinates: [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south]
    ]
  });

  // Try to insert below ai-spill-fill, if it doesn't exist yet, just add
  const beforeLayer = map.getLayer('ai-spill-fill') ? 'ai-spill-fill' : undefined;

  map.addLayer({
    id: 'sar-raster-layer',
    type: 'raster',
    source: 'sar-raster-source',
    layout: {
      'visibility': 'none'
    },
    paint: {
      'raster-opacity': 0.8,
      'raster-fade-duration': 500
    }
  }, beforeLayer);
}
