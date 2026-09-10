import { calculateOverallScore, calculateConfidence } from '../utils/scoring.ts';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface SpillData {
  areaKm2: number;
  detectionConfidence: number;
  detectionTimestamp: string;
  location: string;
  polygon: GeoJSON.Feature<GeoJSON.Polygon>;
}

export interface OriginData {
  estimatedWindow: {
    start: string;
    end: string;
  };
  zoneDimensions: {
    widthKm: number;
    heightKm: number;
  };
  confidence: 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW';
  center: Coordinate;
}

export interface VesselCandidate {
  id: string;
  name: string;
  mmsi: number;
  type: string;
  speedKnots: number;
  headingDegrees: number;
  distanceFromOriginKm: number;
  scores: {
    spatial: number;
    temporal: number;
    trajectory: number;
    drift: number;
    aisQuality: number;
    overall: number;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  trajectory: Coordinate[];
}

export interface SimulationData {
  backwardDriftPaths: Coordinate[][];
  forwardDriftPaths: Coordinate[][];
  windVectors: { lat: number; lng: number; speed: number; direction: number }[];
  currentVectors: { lat: number; lng: number; speed: number; direction: number }[];
  observedSlick: GeoJSON.Feature<GeoJSON.Polygon>;
  simulatedSlick: GeoJSON.Feature<GeoJSON.Polygon>;
  originProbabilityHeatmap: [number, number, number][]; // lat, lng, intensity
}

export interface CaseData {
  id: string;
  spill: SpillData;
  origin: OriginData;
  vessels: VesselCandidate[];
  simulation: SimulationData;
}

// Helper to generate a rough polygon around a center
function generatePolygon(center: Coordinate, radiusLat: number, radiusLng: number, points: number = 12): Coordinate[] {
  const poly: Coordinate[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Add some noise
    const rL = radiusLat * (0.8 + Math.random() * 0.4);
    const rLn = radiusLng * (0.8 + Math.random() * 0.4);
    poly.push({
      lat: center.lat + Math.cos(angle) * rL,
      lng: center.lng + Math.sin(angle) * rLn
    });
  }
  poly.push(poly[0]); // close polygon
  return poly;
}

// Helper to compute dynamic scores
function createVessel(v: Omit<VesselCandidate, 'confidence'> & { scores: Omit<VesselCandidate['scores'], 'overall'> }): VesselCandidate {
  const overall = calculateOverallScore(v.scores);
  return {
    ...v,
    scores: { ...v.scores, overall },
    confidence: calculateConfidence(overall)
  };
}

// Case 001 Data
const centerSpill: Coordinate = { lat: 19.34, lng: 71.25 }; // Detected spill
const centerOrigin: Coordinate = { lat: 19.38, lng: 71.12 }; // Estimated origin (north-west of spill)

export const case001: CaseData = {
  id: 'MT-001',
  spill: {
    areaKm2: 14.8,
    detectionConfidence: 94,
    detectionTimestamp: '2026-07-18T06:40:00Z',
    location: 'Arabian Sea',
    polygon: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          generatePolygon(centerSpill, 0.05, 0.03).map(c => [c.lng, c.lat])
        ]
      }
    }
  },
  origin: {
    estimatedWindow: {
      start: '2026-07-18T04:10:00Z',
      end: '2026-07-18T05:20:00Z'
    },
    zoneDimensions: {
      widthKm: 18,
      heightKm: 11
    },
    confidence: 'MEDIUM-HIGH',
    center: centerOrigin
  },
  vessels: [
    createVessel({
      id: 'V001',
      name: 'MV OCEAN STAR',
      mmsi: 636012345,
      type: 'Oil Tanker',
      speedKnots: 11.8,
      headingDegrees: 142,
      distanceFromOriginKm: 19,
      scores: {
        spatial: 92,
        temporal: 96,
        trajectory: 89,
        drift: 94,
        aisQuality: 87
      },
      trajectory: [
        { lat: 19.45, lng: 71.05 },
        { lat: 19.41, lng: 71.09 },
        { lat: 19.38, lng: 71.12 }, // intersects origin
        { lat: 19.34, lng: 71.16 },
        { lat: 19.30, lng: 71.20 }
      ]
    }),
    createVessel({
      id: 'V002',
      name: 'MV EASTERN WIND',
      mmsi: 636045678,
      type: 'Cargo',
      speedKnots: 13.1,
      headingDegrees: 158,
      distanceFromOriginKm: 12,
      scores: {
        spatial: 85,
        temporal: 60,
        trajectory: 72,
        drift: 65,
        aisQuality: 90
      },
      trajectory: [
        { lat: 19.50, lng: 71.05 },
        { lat: 19.44, lng: 71.08 },
        { lat: 19.39, lng: 71.10 }, // passes near but not through exact center at the right time
        { lat: 19.33, lng: 71.13 },
        { lat: 19.26, lng: 71.16 }
      ]
    }),
    createVessel({
      id: 'V003',
      name: 'MV BLUE HORIZON',
      mmsi: 636078901,
      type: 'Tanker',
      speedKnots: 10.4,
      headingDegrees: 131,
      distanceFromOriginKm: 25,
      scores: {
        spatial: 65,
        temporal: 70,
        trajectory: 55,
        drift: 50,
        aisQuality: 80
      },
      trajectory: [
        { lat: 19.55, lng: 71.00 },
        { lat: 19.48, lng: 71.08 },
        { lat: 19.42, lng: 71.15 },
        { lat: 19.35, lng: 71.22 }
      ]
    }),
    createVessel({
      id: 'V004',
      name: 'MV CORAL TRADER',
      mmsi: 636023456,
      type: 'Cargo',
      speedKnots: 14.2,
      headingDegrees: 180,
      distanceFromOriginKm: 22,
      scores: { spatial: 55, temporal: 65, trajectory: 40, drift: 45, aisQuality: 95 },
      trajectory: [
        { lat: 19.60, lng: 71.20 },
        { lat: 19.50, lng: 71.20 },
        { lat: 19.40, lng: 71.20 },
        { lat: 19.30, lng: 71.20 }
      ]
    }),
    createVessel({
      id: 'V005',
      name: 'MV SEA FALCON',
      mmsi: 636034567,
      type: 'Cargo',
      speedKnots: 12.0,
      headingDegrees: 90,
      distanceFromOriginKm: 28,
      scores: { spatial: 45, temporal: 50, trajectory: 40, drift: 35, aisQuality: 85 },
      trajectory: [
        { lat: 19.20, lng: 70.90 },
        { lat: 19.20, lng: 71.00 },
        { lat: 19.20, lng: 71.10 },
        { lat: 19.20, lng: 71.20 }
      ]
    }),
    createVessel({
      id: 'V006',
      name: 'MV MERIDIAN',
      mmsi: 636056789,
      type: 'Tanker',
      speedKnots: 15.5,
      headingDegrees: 45,
      distanceFromOriginKm: 35,
      scores: { spatial: 30, temporal: 40, trajectory: 30, drift: 20, aisQuality: 98 },
      trajectory: [
        { lat: 19.10, lng: 70.80 },
        { lat: 19.20, lng: 70.90 },
        { lat: 19.30, lng: 71.00 },
        { lat: 19.40, lng: 71.10 }
      ]
    }),
    createVessel({
      id: 'V007',
      name: 'MV PACIFIC DAWN',
      mmsi: 636067890,
      type: 'Cargo',
      speedKnots: 9.8,
      headingDegrees: 270,
      distanceFromOriginKm: 40,
      scores: { spatial: 20, temporal: 25, trajectory: 20, drift: 10, aisQuality: 92 },
      trajectory: [
        { lat: 19.50, lng: 71.50 },
        { lat: 19.50, lng: 71.40 },
        { lat: 19.50, lng: 71.30 },
        { lat: 19.50, lng: 71.20 }
      ]
    })
  ],
  simulation: {
    // Generate some fake drift particles moving from spill to origin as smooth curves
    backwardDriftPaths: Array.from({ length: 30 }).map(() => {
      const path: Coordinate[] = [];
      const startLat = centerSpill.lat + (Math.random() - 0.5) * 0.05;
      const startLng = centerSpill.lng + (Math.random() - 0.5) * 0.05;
      const endLat = centerOrigin.lat + (Math.random() - 0.5) * 0.05;
      const endLng = centerOrigin.lng + (Math.random() - 0.5) * 0.05;
      
      // Control point for quadratic curve (offset perpendicularly)
      const midLat = (startLat + endLat) / 2;
      const midLng = (startLng + endLng) / 2;
      const offsetLat = (endLng - startLng) * 0.3; // Perpendicular offset
      const offsetLng = -(endLat - startLat) * 0.3;
      const cpLat = midLat + offsetLat;
      const cpLng = midLng + offsetLng;

      for (let i = 0; i <= 15; i++) {
        const t = i / 15;
        const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * cpLat + t * t * endLat;
        const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * cpLng + t * t * endLng;
        path.push({ lat, lng });
      }
      return path;
    }),
    
    // Generate some forward drift paths from origin to slick
    forwardDriftPaths: Array.from({ length: 30 }).map(() => {
      const path: Coordinate[] = [];
      let currentLat = centerOrigin.lat + (Math.random() - 0.5) * 0.03;
      let currentLng = centerOrigin.lng + (Math.random() - 0.5) * 0.03;
      for (let i = 0; i < 10; i++) {
        path.push({ lat: currentLat, lng: currentLng });
        currentLat += (centerSpill.lat - centerOrigin.lat) / 10 + (Math.random() - 0.5) * 0.005;
        currentLng += (centerSpill.lng - centerOrigin.lng) / 10 + (Math.random() - 0.5) * 0.005;
      }
      return path;
    }),

    windVectors: [
      { lat: 19.40, lng: 71.10, speed: 12.5, direction: 310 },
      { lat: 19.40, lng: 71.20, speed: 13.0, direction: 315 },
      { lat: 19.30, lng: 71.10, speed: 12.2, direction: 305 },
      { lat: 19.30, lng: 71.20, speed: 12.8, direction: 312 },
    ],
    
    currentVectors: [
      { lat: 19.45, lng: 71.15, speed: 0.8, direction: 140 },
      { lat: 19.35, lng: 71.15, speed: 0.9, direction: 145 },
      { lat: 19.25, lng: 71.15, speed: 0.7, direction: 135 },
    ],

    observedSlick: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          generatePolygon(centerSpill, 0.05, 0.03).map(c => [c.lng, c.lat])
        ]
      }
    },
    
    simulatedSlick: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          generatePolygon({ lat: centerSpill.lat + 0.005, lng: centerSpill.lng - 0.005 }, 0.055, 0.035).map(c => [c.lng, c.lat])
        ]
      }
    },

    // Origin heatmap
    originProbabilityHeatmap: Array.from({ length: 150 }).map(() => {
      // Gaussian-ish distribution around centerOrigin
      const u = Math.random() * Math.random();
      const v = Math.random() * Math.PI * 2;
      const radius = u * 0.08; 
      return [
        centerOrigin.lat + Math.cos(v) * radius,
        centerOrigin.lng + Math.sin(v) * radius,
        Math.max(0.2, 1 - (radius / 0.08)) // Intensity falls off with distance
      ];
    })
  }
};
