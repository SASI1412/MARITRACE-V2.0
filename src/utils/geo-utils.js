/**
 * Geographic utility functions for dynamic ML spill analysis
 */

import * as turf from '@turf/turf';

/**
 * Formats a coordinate pair as a human-readable string
 */
export function formatCoord(lat, lng) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}°${latDir}, ${Math.abs(lng).toFixed(5)}°${lngDir}`;
}

/**
 * Calculates haversine distance between two coordinates in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Validates and extracts metrics from an AI GeoJSON spill
 */
export function calculateGeoJSONMetrics(geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features) || geojson.features.length === 0) {
    console.error("[MARITRACE GEO] Invalid GeoJSON: Not a valid FeatureCollection.");
    return null; // Invalid or empty
  }

  let validVertices = 0;
  let isValid = true;

  // Validate geometry minimums and coordinates
  geojson.features.forEach(f => {
    if (f.geometry && f.geometry.coordinates) {
      if (f.geometry.type === 'Polygon') {
        f.geometry.coordinates.forEach(poly => {
          if (poly.length >= 4) validVertices += (poly.length - 1);
          poly.forEach(coord => {
            if (isNaN(coord[0]) || isNaN(coord[1]) || coord[0] < -180 || coord[0] > 180 || coord[1] < -90 || coord[1] > 90) {
              isValid = false;
            }
          });
        });
      } else if (f.geometry.type === 'MultiPolygon') {
        f.geometry.coordinates.forEach(polySet => {
          polySet.forEach(poly => {
            if (poly.length >= 4) validVertices += (poly.length - 1);
            poly.forEach(coord => {
              if (isNaN(coord[0]) || isNaN(coord[1]) || coord[0] < -180 || coord[0] > 180 || coord[1] < -90 || coord[1] > 90) {
                isValid = false;
              }
            });
          });
        });
      } else {
        isValid = false; // Unsupported geometry type
      }
    } else {
      isValid = false;
    }
  });

  if (!isValid || validVertices < 3) {
    console.error("[MARITRACE GEO] Invalid GeoJSON geometry or coordinates out of bounds.");
    return null; // Degenerate geometry
  }

  // Calculate bbox: [minLng, minLat, maxLng, maxLat]
  const bbox = turf.bbox(geojson);
  const minLng = bbox[0];
  const minLat = bbox[1];
  const maxLng = bbox[2];
  const maxLat = bbox[3];

  if (minLng > maxLng || minLat > maxLat) {
    console.error("[MARITRACE GEO] Invalid geographic bounds calculated from GeoJSON.");
    return null;
  }

  // Calculate proper area-weighted planar polygon centroid
  const centerPoint = turf.centerOfMass(geojson);
  const centroid = {
    lng: centerPoint.geometry.coordinates[0],
    lat: centerPoint.geometry.coordinates[1]
  };

  const widthKm = haversineDistance(centroid.lat, minLng, centroid.lat, maxLng);
  const heightKm = haversineDistance(minLat, centroid.lng, maxLat, centroid.lng);
  
  // Calculate true geographic area in square kilometers
  const areaKm2 = turf.area(geojson) / 1000000;

  return {
    centroid,
    bounds: { minLng, minLat, maxLng, maxLat },
    approxWidthKm: widthKm,
    approxHeightKm: heightKm,
    areaKm2
  };
}

/**
 * Generates dynamic synthetic backward drift paths from a spill centroid
 */
export function generateSyntheticBackwardDrift(spillCentroid, driftDistanceKm = 20) {
  // Deterministic pseudo-random based on centroid
  const seed = Math.abs(spillCentroid.lat * spillCentroid.lng);
  // Pseudo-random bearing between 200 and 340 degrees (generally NW like the original demo)
  const bearingDegrees = 200 + ((seed * 100) % 140);
  
  // Convert distance to approx lat/lng degrees (rough approx)
  const bearingRad = bearingDegrees * Math.PI / 180;
  const distDegLat = (driftDistanceKm / 111) * Math.cos(bearingRad);
  const distDegLng = (driftDistanceKm / (111 * Math.cos(spillCentroid.lat * Math.PI / 180))) * Math.sin(bearingRad);

  const initialOriginCenter = {
    lat: spillCentroid.lat + distDegLat,
    lng: spillCentroid.lng + distDegLng
  };

  const paths = Array.from({ length: 30 }).map((_, i) => {
    const path = [];
    // Deterministic random using index and seed
    const pseudoRand1 = ((seed * (i + 1) * 17) % 100) / 100;
    const pseudoRand2 = ((seed * (i + 2) * 23) % 100) / 100;
    const pseudoRand3 = ((seed * (i + 3) * 29) % 100) / 100;
    const pseudoRand4 = ((seed * (i + 4) * 31) % 100) / 100;

    const startLat = spillCentroid.lat + (pseudoRand1 - 0.5) * 0.05;
    const startLng = spillCentroid.lng + (pseudoRand2 - 0.5) * 0.05;
    const endLat = initialOriginCenter.lat + (pseudoRand3 - 0.5) * 0.05;
    const endLng = initialOriginCenter.lng + (pseudoRand4 - 0.5) * 0.05;
    
    // Control point for quadratic curve (offset perpendicularly)
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;
    const offsetLat = (endLng - startLng) * 0.3; // Perpendicular offset
    const offsetLng = -(endLat - startLat) * 0.3;
    const cpLat = midLat + offsetLat;
    const cpLng = midLng + offsetLng;

    for (let j = 0; j <= 15; j++) {
      const t = j / 15;
      const t1 = 1 - t;
      const lat = (t1 * t1 * startLat) + (2 * t1 * t * cpLat) + (t * t * endLat);
      const lng = (t1 * t1 * startLng) + (2 * t1 * t * cpLng) + (t * t * endLng);
      path.push({ lat, lng });
    }
    return path;
  });

  // Calculate originCenter correctly as turf centroid of endpoints
  const endpoints = paths.map(p => turf.point([p[p.length-1].lng, p[p.length-1].lat]));
  const featureCol = turf.featureCollection(endpoints);
  const calculatedCentroid = turf.centroid(featureCol);

  const finalOriginCenter = {
    lat: calculatedCentroid.geometry.coordinates[1],
    lng: calculatedCentroid.geometry.coordinates[0]
  };

  const probabilityZone = generateOriginProbabilityZone(paths);

  return {
    paths,
    originCenter: finalOriginCenter,
    spillCentroid,
    probabilityZone
  };
}

/**
 * Calculates a dynamic origin zone (convex hull style or bounding box) from drift endpoints
 */
export function generateOriginProbabilityZone(driftPaths) {
  // Get all endpoints
  const endpoints = driftPaths.map(path => path[path.length - 1]);
  
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  endpoints.forEach(pt => {
    minLng = Math.min(minLng, pt.lng);
    maxLng = Math.max(maxLng, pt.lng);
    minLat = Math.min(minLat, pt.lat);
    maxLat = Math.max(maxLat, pt.lat);
  });
  
  // Add a small buffer around the bounding box of endpoints
  const buffer = 0.03;
  
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [minLng - buffer, maxLat + buffer],
          [maxLng + buffer, maxLat + buffer],
          [maxLng + buffer, minLat - buffer],
          [minLng - buffer, minLat - buffer],
          [minLng - buffer, maxLat + buffer]
        ]]
      },
      properties: {
        probability: 0.95
      }
    }]
  };
}

/**
 * Generates dynamic synthetic forward drift paths from a probable origin start coordinate
 * to a detected spill end coordinate.
 *
 * Forensic sequence:
 * PROBABLE ORIGIN ZONE (simulation START, t = 0)
 *       ↓ forward drift
 * DETECTED SPILL POLYGON (simulation END, t = 1)
 */
export function generateSyntheticForwardDrift(startCoord, endCoord, count = 25) {
  if (!startCoord || !endCoord) return [];

  // Midpoint between probable origin and detected spill
  const midLat = (startCoord.lat + endCoord.lat) / 2;
  const midLng = (startCoord.lng + endCoord.lng) / 2;

  // Curvature matching the hydrodynamic current channel:
  // In backward drift: start = spill, end = origin, offsetLat = (endLng - startLng) * 0.3
  // In forward drift: start = origin, end = spill. Negating by -0.3 keeps the curve bending along the exact same channel.
  const offsetLat = (endCoord.lng - startCoord.lng) * -0.3;
  const offsetLng = (endCoord.lat - startCoord.lat) * 0.3;
  const cpLat = midLat + offsetLat;
  const cpLng = midLng + offsetLng;

  const paths = Array.from({ length: count }).map((_, i) => {
    const p = [];

    // Particles originate inside or immediately around the PROBABLE ORIGIN ZONE:
    const randStart1 = ((((i + 1) * 19) % 100) / 100 - 0.5) * 0.035;
    const randStart2 = ((((i + 1) * 29) % 100) / 100 - 0.5) * 0.035;
    const sLat = startCoord.lat + randStart1;
    const sLng = startCoord.lng + randStart2;

    // Particles terminate inside or intersecting the DETECTED SPILL REGION:
    const randEnd1 = ((((i + 1) * 37) % 100) / 100 - 0.5) * 0.025;
    const randEnd2 = ((((i + 1) * 43) % 100) / 100 - 0.5) * 0.025;
    const eLat = endCoord.lat + randEnd1;
    const eLng = endCoord.lng + randEnd2;

    // Slight variance on control point for realistic hydrodynamic plume dispersion
    const cpVarLat = cpLat + ((((i + 1) * 53) % 100) / 100 - 0.5) * 0.015;
    const cpVarLng = cpLng + ((((i + 1) * 61) % 100) / 100 - 0.5) * 0.015;

    // Quadratic Bezier from START (t = 0: probable origin) to END (t = 1: detected spill)
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const t1 = 1 - t;
      const lat = (t1 * t1 * sLat) + (2 * t1 * t * cpVarLat) + (t * t * eLat);
      const lng = (t1 * t1 * sLng) + (2 * t1 * t * cpVarLng) + (t * t * eLng);
      p.push({ lat, lng });
    }
    return p;
  });

  return paths;
}

/**
 * Calculates a simple forward drift compatibility score by checking how close
 * the synthetic forward drift endpoints are to the AI spill centroid.
 */
export function calculateForwardDriftCompatibility(driftPaths, spillGeoJSON) {
  if (!driftPaths || driftPaths.length === 0 || !spillGeoJSON) return 0;
  
  try {
    let totalScore = 0;
    
    if (!spillGeoJSON.features || spillGeoJSON.features.length === 0) return 0;
    
    driftPaths.forEach(path => {
      const coords = path.map(pt => [pt.lng, pt.lat]);
      if (coords.length < 2) return;
      const line = turf.lineString(coords);
      
      const lineBuffer = turf.buffer(line, 2, { units: 'kilometers' });
      
      let pathIntersects = false;
      let minDistance = Infinity;

      spillGeoJSON.features.forEach(feature => {
        if (!feature.geometry) return;
        
        if (turf.booleanIntersects(lineBuffer, feature)) {
          pathIntersects = true;
        } else {
          const endPt = turf.point(coords[coords.length - 1]);
          const featureCentroid = turf.centroid(feature);
          const dist = turf.distance(endPt, featureCentroid, { units: 'kilometers' });
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      });
      
      if (pathIntersects) {
        totalScore += 100;
      } else {
        if (minDistance < 5) totalScore += 80;
        else if (minDistance < 20) totalScore += Math.max(0, 80 - ((minDistance - 5) / 15) * 80);
      }
    });
    
    return Math.round(totalScore / driftPaths.length);
  } catch (err) {
    console.error("Error calculating forward drift compatibility", err);
    return 0;
  }
}
