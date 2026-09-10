const maplibregl = window.maplibregl;
import { case001 } from '../../data/case001.ts';

let onVesselClickCallback = null;
let popup = null;
let currentTrajectoryVesselId = null;

function createVesselsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: case001.vessels.map(v => {
      const currentPos = v.trajectory[v.trajectory.length - 1];
      
      let color = '#78909c';
      if (v.confidence === 'HIGH') color = '#ff1744';
      else if (v.confidence === 'MEDIUM') color = '#ffab00';

      return {
        type: 'Feature',
        properties: {
          id: v.id,
          name: v.name,
          type: v.type,
          mmsi: v.mmsi,
          heading: v.headingDegrees,
          color: color
        },
        geometry: {
          type: 'Point',
          coordinates: [currentPos.lng, currentPos.lat]
        }
      };
    })
  };
}

function createAllTrajectoriesGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: case001.vessels.map(v => {
      let color = '#78909c';
      if (v.confidence === 'HIGH') color = '#ff1744';
      else if (v.confidence === 'MEDIUM') color = '#ffab00';

      return {
        type: 'Feature',
        properties: {
          id: v.id,
          color: color
        },
        geometry: {
          type: 'LineString',
          coordinates: v.trajectory.map(p => [p.lng, p.lat])
        }
      };
    })
  };
}

export function createVesselLayer(map, onClick) {
  onVesselClickCallback = onClick;
}

export function addVesselLayer(map) {
  if (map.getSource('vessels-source')) return;

  map.addSource('vessels-source', {
    type: 'geojson',
    data: createVesselsGeoJSON()
  });

  map.addSource('all-trajectories-source', {
    type: 'geojson',
    data: createAllTrajectoriesGeoJSON()
  });

  // All Vessel Tracks (Thin, low opacity)
  map.addLayer({
    id: 'vessel-tracks',
    type: 'line',
    source: 'all-trajectories-source',
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-opacity': 0.5, // brighter than before
      'line-dasharray': [4, 4]
    }
  });

  // Highlight circle (underneath) for selected vessel
  map.addLayer({
    id: 'vessels-highlight',
    type: 'circle',
    source: 'vessels-source',
    paint: {
      'circle-radius': 16,
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.4,
      'circle-blur': 0.3
    },
    filter: ['==', 'id', ''] // initially none
  });

  // Vessel solid circle (now ship icon)
  map.addLayer({
    id: 'vessel-points',
    type: 'symbol',
    source: 'vessels-source',
    layout: {
      'icon-image': 'ship-icon',
      'icon-size': 0.8,
      'icon-rotate': ['get', 'heading'],
      'icon-allow-overlap': true
    },
    paint: {
      'icon-color': ['get', 'color']
    }
  });

  // Main vessel symbol (Text only)
  map.addLayer({
    id: 'vessel-labels',
    type: 'symbol',
    source: 'vessels-source',
    layout: {
      'text-field': ['get', 'name'],
      'text-offset': [0, 1.8],
      'text-size': 10,
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#00e5ff', // cyan-ish like the image
      'text-halo-color': 'rgba(10, 15, 25, 0.8)',
      'text-halo-width': 1
    },
    filter: ['!=', 'color', '#ff1744'] // Not top candidate
  });

  // Top candidate label
  map.addLayer({
    id: 'vessel-labels-top',
    type: 'symbol',
    source: 'vessels-source',
    layout: {
      'text-field': ['concat', ['get', 'name'], '\nTop Candidate'],
      'text-offset': [0, 1.8],
      'text-size': 11,
      'text-anchor': 'top',
      'text-justify': 'center'
    },
    paint: {
      'text-color': '#ffab00', // orange
      'text-halo-color': 'rgba(10, 15, 25, 0.9)',
      'text-halo-width': 2
    },
    filter: ['==', 'color', '#ff1744']
  });

  // Interactivity
  map.on('click', 'vessel-points', (e) => {
    const props = e.features[0].properties;
    
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ closeButton: true, offset: [0, -10] })
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${props.name}</strong><br>${props.type} • ${props.mmsi}`)
      .addTo(map);
      
    if (onVesselClickCallback) {
      onVesselClickCallback(props.id);
    }
  });

  map.on('mouseenter', 'vessel-points', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'vessel-points', () => { map.getCanvas().style.cursor = ''; });
}

export function showTrajectory(map, vessel) {
  if (!map || !map.getLayer('vessel-tracks')) return;

  if (!vessel || !vessel.trajectory) {
    // Reset all tracks to dim opacity
    map.setPaintProperty('vessel-tracks', 'line-opacity', 0.2);
    map.setPaintProperty('vessel-tracks', 'line-width', 1.5);
    map.setFilter('vessels-highlight', ['==', 'id', '']);
    return;
  }

  // Highlight only the selected track
  map.setPaintProperty('vessel-tracks', 'line-opacity', [
    'case',
    ['==', ['get', 'id'], vessel.id], 1.0,
    0.1 // even dimmer for unselected
  ]);
  map.setPaintProperty('vessel-tracks', 'line-width', [
    'case',
    ['==', ['get', 'id'], vessel.id], 3.0,
    1.0
  ]);
  
  map.setFilter('vessels-highlight', ['==', 'id', vessel.id]);

  // Fly to the vessel
  const endPoint = vessel.trajectory[vessel.trajectory.length - 1];
  map.flyTo({
    center: [endPoint.lng, endPoint.lat],
    zoom: 12,
    speed: 0.8,
    curve: 1.5,
    essential: true
  });
}

export function hideTrajectory(map) {
  if (!map || !map.getLayer('vessel-tracks')) return;
  map.setPaintProperty('vessel-tracks', 'line-opacity', 0.2);
  map.setPaintProperty('vessel-tracks', 'line-width', 1.5);
  map.setFilter('vessels-highlight', ['==', 'id', '']);
}

export function selectVesselOnMap(id) {
  currentTrajectoryVesselId = id;
}

export function removeVesselLayer(map) {
  if (popup) popup.remove();
  
  if (map.getLayer('vessels-highlight')) map.removeLayer('vessels-highlight');
  if (map.getLayer('vessel-labels')) map.removeLayer('vessel-labels');
  if (map.getLayer('vessel-points')) map.removeLayer('vessel-points');
  if (map.getLayer('vessel-tracks')) map.removeLayer('vessel-tracks');
  
  if (map.getSource('vessels-source')) map.removeSource('vessels-source');
  if (map.getSource('all-trajectories-source')) map.removeSource('all-trajectories-source');
}
