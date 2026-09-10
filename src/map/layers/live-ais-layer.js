export function addLiveAISLayer(map) {
  if (!map.getSource('live-ais-source')) {
    map.addSource('live-ais-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.addLayer({
      id: 'live-ais-layer',
      type: 'symbol',
      source: 'live-ais-source',
      layout: {
        'icon-image': 'ship-icon',
        'icon-size': 0.4,
        'icon-allow-overlap': true,
        'icon-rotate': ['get', 'cog'],
        'icon-rotation-alignment': 'map'
      },
      paint: {
        'icon-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          1.0,
          0.6
        ]
      }
    });

    map.on('click', 'live-ais-layer', (e) => {
      if (!e.features || e.features.length === 0) return;
      const mmsi = e.features[0].properties.mmsi;
      
      // Highlight on map
      const features = map.queryRenderedFeatures({ layers: ['live-ais-layer'] });
      features.forEach(f => {
        map.setFeatureState({ source: 'live-ais-source', id: f.id }, { selected: false });
      });
      map.setFeatureState({ source: 'live-ais-source', id: e.features[0].id }, { selected: true });

      // Dispatch custom event for dashboard
      window.dispatchEvent(new CustomEvent('live-ais-selected', { detail: { mmsi } }));
    });

    map.on('mouseenter', 'live-ais-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'live-ais-layer', () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

export function updateLiveAISData(map, vesselsMap) {
  if (!map.getSource('live-ais-source')) return;

  const features = Array.from(vesselsMap.values()).map(vessel => ({
    type: 'Feature',
    id: parseInt(vessel.mmsi, 10), // Required for feature-state
    properties: {
      mmsi: vessel.mmsi,
      shipName: vessel.shipName,
      sog: vessel.sog,
      cog: vessel.cog,
      timestamp: vessel.timestamp
    },
    geometry: {
      type: 'Point',
      coordinates: [vessel.lon, vessel.lat]
    }
  }));

  map.getSource('live-ais-source').setData({
    type: 'FeatureCollection',
    features: features
  });
}

export function removeLiveAISLayer(map) {
  if (map.getLayer('live-ais-layer')) map.removeLayer('live-ais-layer');
  if (map.getSource('live-ais-source')) map.removeSource('live-ais-source');
}
