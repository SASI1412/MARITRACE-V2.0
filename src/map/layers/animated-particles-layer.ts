type MapLibreMap = any;
import { case001, Coordinate } from '../../data/case001.ts';

let animationFrameId: number | null = null;
let animationProgress = 0; // 0.0 to 1.0
let isPlaying = false;
let lastTimestamp = 0;
const DURATION_MS = 6000; // 6 seconds for full animation

let currentMap: MapLibreMap | null = null;
let activeForwardDriftPaths: Coordinate[][] = case001.simulation.forwardDriftPaths;

export function setAnimatedParticlesPaths(paths: Coordinate[][]) {
  if (paths && paths.length > 0) {
    activeForwardDriftPaths = paths;
    animationProgress = 0;
    updateGeoJSON();
  }
}

function interpolatePosition(path: Coordinate[], progress: number): Coordinate {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];

  const totalSegments = path.length - 1;
  const exactSegment = progress * totalSegments;
  const segmentIndex = Math.floor(exactSegment);
  const segmentProgress = exactSegment - segmentIndex;

  const start = path[segmentIndex];
  const end = path[segmentIndex + 1];

  return {
    lat: start.lat + (end.lat - start.lat) * segmentProgress,
    lng: start.lng + (end.lng - start.lng) * segmentProgress
  };
}

function updateGeoJSON() {
  if (!currentMap || !currentMap.getSource('animated-particles-source')) return;

  const features = activeForwardDriftPaths.map(path => {
    const currentPos = interpolatePosition(path, animationProgress);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [currentPos.lng, currentPos.lat]
      }
    };
  });

  const geojson = {
    type: 'FeatureCollection',
    features
  };

  (currentMap.getSource('animated-particles-source') as any).setData(geojson);
}

function renderFrame(timestamp: number) {
  if (!isPlaying) return;

  if (lastTimestamp === 0) lastTimestamp = timestamp;
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  animationProgress += delta / DURATION_MS;

  if (animationProgress >= 1) {
    animationProgress = 1;
    isPlaying = false;
  }

  updateGeoJSON();

  if (isPlaying) {
    animationFrameId = requestAnimationFrame(renderFrame);
  }
}

export function addAnimatedParticlesLayer(map: MapLibreMap, customPaths?: Coordinate[][]) {
  currentMap = map;
  if (customPaths && customPaths.length > 0) {
    activeForwardDriftPaths = customPaths;
  }
  
  if (map.getSource('animated-particles-source')) {
    animationProgress = 0;
    updateGeoJSON();
    return;
  }

  map.addSource('animated-particles-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'animated-particles-circle',
    type: 'circle',
    source: 'animated-particles-source',
    paint: {
      'circle-radius': 3.5,
      'circle-color': '#ff9800',
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
    }
  });
  
  // Set initial state
  animationProgress = 0;
  updateGeoJSON();
}

export function removeAnimatedParticlesLayer(map: MapLibreMap) {
  pauseAnimation();
  animationProgress = 0;
  currentMap = null;
  
  if (map.getLayer('animated-particles-circle')) map.removeLayer('animated-particles-circle');
  if (map.getSource('animated-particles-source')) map.removeSource('animated-particles-source');
}

export function playAnimation() {
  if (isPlaying) return;
  if (animationProgress >= 1) animationProgress = 0; // Restart if at end
  
  isPlaying = true;
  lastTimestamp = 0;
  animationFrameId = requestAnimationFrame(renderFrame);
}

export function pauseAnimation() {
  isPlaying = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export function resetAnimation() {
  pauseAnimation();
  animationProgress = 0;
  updateGeoJSON();
}
