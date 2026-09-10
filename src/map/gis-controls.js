export function initCoordinateReadout(map) {
  const coordsEl = document.getElementById('gis-coords');
  if (!coordsEl) return;
  
  map.on('mousemove', (e) => {
    const lng = e.lngLat.lng.toFixed(4);
    const lat = e.lngLat.lat.toFixed(4);
    coordsEl.innerHTML = `LAT: ${lat}° N<br>LON: ${lng}° E`;
  });
  
  map.on('mouseout', () => {
    coordsEl.style.opacity = '0.5';
  });
  map.on('mouseenter', () => {
    coordsEl.style.opacity = '1';
  });
}

export function initBasemapSelector(map) {
  const selector = document.getElementById('basemap-select');
  if (!selector) return;

  selector.addEventListener('change', (e) => {
    const val = e.target.value;
    
    // We update the visibility of our custom raster basemaps
    const basemaps = ['osm-layer', 'satellite-layer', 'light-layer'];
    
    basemaps.forEach(b => {
      if (map.getLayer(b)) {
        map.setLayoutProperty(b, 'visibility', 'none');
      }
    });

    if (val === 'dark' && map.getLayer('osm-layer')) {
      map.setLayoutProperty('osm-layer', 'visibility', 'visible');
    } else if (val === 'satellite' && map.getLayer('satellite-layer')) {
      map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
    } else if (val === 'light' && map.getLayer('light-layer')) {
      map.setLayoutProperty('light-layer', 'visibility', 'visible');
    }
  });
}

export function updateMapHeader(caseId, isAI) {
  const header = document.getElementById('gis-header');
  
  if (!header) return;
  header.style.display = 'block';
  
  const caseText = caseId ? `CASE: ${caseId}` : '';
  
  if (isAI) {
    header.innerHTML = `
      <div style="color: #00e5ff; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px;">MARITRACE GIS <span style="color: #fff; margin-left: 8px;">${caseText}</span></div>
      <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px;">MODE: AI INVESTIGATION</div>
      <div style="display: flex; flex-direction: column; gap: 2px; color: #8892b0; font-size: 9px; letter-spacing: 0.5px;">
        <div>SAR: <span style="color: #2ea043;">REAL</span></div>
        <div>AIS: <span style="color: #d29922;">SYNTHETIC</span></div>
        <div>DRIFT: <span style="color: #d29922;">SYNTHETIC</span></div>
      </div>
    `;
  } else {
    header.innerHTML = `
      <div style="color: #00e5ff; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px;">MARITRACE GIS <span style="color: #fff; margin-left: 8px;">${caseText}</span></div>
      <div style="color: #ffb300; font-weight: bold; margin-bottom: 4px;">MODE: CURATED DEMO</div>
      <div style="display: flex; flex-direction: column; gap: 2px; color: #8892b0; font-size: 9px; letter-spacing: 0.5px;">
        <div>DATA SOURCE: <span style="color: #d29922;">SIMULATED / SYNTHETIC</span></div>
      </div>
    `;
  }
}

export function initLayerManager(map) {
  const togglesContainer = document.getElementById('layer-toggles');
  const controlsTopRight = document.getElementById('gis-controls');
  const readout = document.getElementById('gis-readout');
  
  if (controlsTopRight) controlsTopRight.style.display = 'flex';
  if (readout) readout.style.display = 'block';
  if (!togglesContainer) return;
  
  // Define layers logically grouped
  const layerGroups = {
    'EVIDENCE': [
      { id: 'ai-spill-fill', label: 'Observed SAR Spill', default: true },
      { id: 'heatmap-layer', label: 'Origin Probability', default: true },
      { id: 'backward-drift', label: 'Backward Drift', default: true },
      { id: 'forward-drift', label: 'Forward Drift', default: true },
      { id: 'drift-footprint', label: 'Synthetic Drift Footprint', default: true },
      { id: 'vessel-tracks', label: 'AIS Tracks', default: true },
      { id: 'vessel-points', label: 'AIS Vessels', default: true },
      { id: 'sar-raster-layer', label: 'SAR Overlay', default: false }
    ],
    'ENVIRONMENT': [
      { id: 'wind-layer', label: 'Synthetic Wind / Current', default: true }
    ],
    'REFERENCE': [
      { id: 'graticule-layer', label: 'Latitude / Longitude Grid', default: true }
    ]
  };

  let html = '';
  
  for (const [group, layers] of Object.entries(layerGroups)) {
    html += `<div style="color: #8892b0; font-size: 10px; margin-top: 8px; margin-bottom: 4px; font-weight: bold; letter-spacing: 1px;">${group}</div>`;
    layers.forEach(l => {
      html += `
        <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 4px; cursor: pointer; color: #fff;">
          <input type="checkbox" class="layer-toggle-cb" data-layer="${l.id}" ${l.default ? 'checked' : ''} style="accent-color: #00e5ff; cursor: pointer;">
          ${l.label}
        </label>
      `;
    });
  }
  
  togglesContainer.innerHTML = html;
  
  // Add listeners
  const checkboxes = document.querySelectorAll('.layer-toggle-cb');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const layerId = e.target.getAttribute('data-layer');
      const isVisible = e.target.checked;
      
      // Handle multi-layers
      let mapLayers = [layerId];
      if (layerId === 'ai-spill-fill') mapLayers = ['ai-spill-fill', 'ai-spill-line', 'spill-fill', 'spill-line'];
      if (layerId === 'heatmap-layer') mapLayers = ['heatmap-layer', 'origin-line'];
      if (layerId === 'backward-drift') mapLayers = ['backward-drift-line', 'backward-drift-arrows'];
      if (layerId === 'forward-drift') mapLayers = ['forward-drift-line', 'forward-drift-arrows', 'animated-particles-circle'];
      if (layerId === 'drift-footprint') mapLayers = ['comparison-simulated-fill', 'comparison-simulated-line'];
      if (layerId === 'vessel-tracks') mapLayers = ['vessel-tracks'];
      if (layerId === 'vessel-points') mapLayers = ['vessel-points', 'vessel-labels'];
      if (layerId === 'graticule-layer') mapLayers = ['graticule-lines', 'graticule-labels'];
      
      mapLayers.forEach(lId => {
        if (map.getLayer(lId)) {
          map.setLayoutProperty(lId, 'visibility', isVisible ? 'visible' : 'none');
        }
      });
    });
  });

  // Toggle panel collapse
  const panelToggle = document.getElementById('layer-panel-toggle');
  const toggleIcon = document.getElementById('layer-toggle-icon');
  if (panelToggle) {
    panelToggle.addEventListener('click', () => {
      if (togglesContainer.style.display === 'none') {
        togglesContainer.style.display = 'block';
        toggleIcon.textContent = '▾';
      } else {
        togglesContainer.style.display = 'none';
        toggleIcon.textContent = '▸';
      }
    });
  }
}

export function renderLegend() {
  const legend = document.getElementById('map-legend');
  if (!legend) return;
  
  legend.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #cbd5e1; font-family: 'Inter', sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 10px; background: rgba(255, 23, 68, 0.35); border: 1.5px solid #ff1744; border-radius: 2px;"></div>
        Observed SAR Spill
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 10px; background: rgba(124, 77, 255, 0.25); border: 1.5px solid #7c4dff; border-radius: 2px;"></div>
        Origin Probability
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; border-top: 2px dashed #ffffff;"></div>
        Backward Drift
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; display: flex; align-items: center; justify-content: center; gap: 2px;">
          <span style="width: 5px; height: 5px; border-radius: 50%; background: #ff9800; display: inline-block;"></span>
          <span style="width: 5px; height: 5px; border-radius: 50%; background: #ff9800; display: inline-block;"></span>
        </div>
        Forward Drift
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 10px; background: rgba(213, 0, 249, 0.25); border: 1.5px dashed #ea80fc; border-radius: 2px;"></div>
        Synthetic Drift Footprint
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; border-top: 2px dashed #00e5ff;"></div>
        AIS Track
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="16" height="10" viewBox="0 0 16 10"><path d="M4 1 L1 4 L1 9 L4 10 L8 9 L8 4 Z" fill="#ffab00" transform="rotate(90 8 5)"/></svg>
        Vessel (Selected)
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="16" height="10" viewBox="0 0 16 10"><path d="M4 1 L1 4 L1 9 L4 10 L8 9 L8 4 Z" fill="#00e5ff" transform="rotate(90 8 5)"/></svg>
        Vessel (Other)
      </div>
    </div>
  `;
  legend.style.display = 'block';
}

export function addGraticuleLayer(map) {
  const features = [];
  for (let lat = 15; lat <= 25; lat += 0.5) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[65, lat], [75, lat]] },
      properties: { label: lat + '° N' }
    });
  }
  for (let lon = 65; lon <= 75; lon += 0.5) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[lon, 15], [lon, 25]] },
      properties: { label: lon + '° E' }
    });
  }

  const graticuleGeoJSON = { type: 'FeatureCollection', features };

  if (!map.getSource('graticule-source')) {
    map.addSource('graticule-source', {
      type: 'geojson',
      data: graticuleGeoJSON
    });
    
    map.addLayer({
      id: 'graticule-lines',
      type: 'line',
      source: 'graticule-source',
      layout: { 'visibility': 'none' },
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.15)',
        'line-width': 1,
        'line-dasharray': [2, 2]
      }
    });

    // Label layer needs a font, we'll try to just not use labels if it breaks or use standard maplibre font
    map.addLayer({
      id: 'graticule-labels',
      type: 'symbol',
      source: 'graticule-source',
      layout: {
        'visibility': 'none',
        'symbol-placement': 'line',
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-keep-upright': true,
        'text-offset': [0, 1]
      },
      paint: {
        'text-color': 'rgba(255, 255, 255, 0.4)'
      }
    });
  }
}

