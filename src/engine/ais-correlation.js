/**
 * AIS Correlation Engine
 * Dynamically scores candidate vessels against the AI-derived origin zone,
 * backward drift corridor, and spill detection context.
 *
 * Used ONLY in AI Investigation mode. Curated demo mode continues using case001 scores.
 */

import { generateSyntheticTimestamps } from './ais-timestamps.js';

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── SPATIAL COMPATIBILITY ─────────────────────────────────────────
function calculateSpatialCompatibility(trajectory, originCenter) {
  if (!trajectory || trajectory.length === 0) return { score: 0, minDist: Infinity };

  let minDistance = Infinity;
  for (const pt of trajectory) {
    const dist = haversineDistance(pt.lat, pt.lng, originCenter.lat, originCenter.lng);
    if (dist < minDistance) minDistance = dist;
  }

  let score;
  if (minDistance <= 5) score = 100;
  else if (minDistance >= 30) score = 0;
  else score = Math.round(100 - ((minDistance - 5) / 25) * 100);

  return { score, minDist: minDistance };
}

// ─── TEMPORAL COMPATIBILITY ────────────────────────────────────────
function calculateTemporalCompatibility(trajectory, originCenter, spillDetectionTime) {
  if (!trajectory || trajectory.length === 0 || !spillDetectionTime || !trajectory[0].timestamp) {
    return { score: 50, available: false, timeDiffHours: null };
  }

  const detectionTimeMs = new Date(spillDetectionTime).getTime();
  
  // Find point closest to origin
  let minDist = Infinity;
  let closestPt = trajectory[0];
  for (const pt of trajectory) {
    const dist = haversineDistance(pt.lat, pt.lng, originCenter.lat, originCenter.lng);
    if (dist < minDist) {
      minDist = dist;
      closestPt = pt;
    }
  }

  const pointTimeMs = new Date(closestPt.timestamp).getTime();
  const timeDiffHours = Math.abs(pointTimeMs - detectionTimeMs) / (1000 * 60 * 60);

  let score;
  if (timeDiffHours <= 1) score = 100;
  else if (timeDiffHours <= 3) score = 90;
  else if (timeDiffHours <= 6) score = 75;
  else if (timeDiffHours <= 12) score = 55;
  else if (timeDiffHours <= 24) score = 30;
  else score = 0;

  return { score, available: true, timeDiffHours };
}

// ─── TRAJECTORY COMPATIBILITY ──────────────────────────────────────
function calculateTrajectoryCompatibility(trajectory, originCenter) {
  if (!trajectory || trajectory.length < 2) return { score: 0, minDist: Infinity };

  let minDist = Infinity;
  let firstHalfDist = 0;
  let secondHalfDist = 0;

  for (let i = 0; i < trajectory.length; i++) {
    const dist = haversineDistance(trajectory[i].lat, trajectory[i].lng, originCenter.lat, originCenter.lng);
    if (dist < minDist) {
      minDist = dist;
    }
    if (i < trajectory.length / 2) {
      firstHalfDist += dist;
    } else {
      secondHalfDist += dist;
    }
  }

  const avgFirstHalf = firstHalfDist / Math.floor(trajectory.length / 2);
  const avgSecondHalf = secondHalfDist / Math.ceil(trajectory.length / 2);

  let passScore;
  if (minDist <= 5) passScore = 100;
  else if (minDist <= 15) passScore = 80;
  else if (minDist <= 25) passScore = 50;
  else passScore = Math.max(0, 50 - ((minDist - 25) / 25) * 50);

  let directionBonus = 0;
  if (avgSecondHalf < avgFirstHalf - 2) {
    directionBonus = 15;
  }

  return { score: Math.min(100, passScore + directionBonus), minDist };
}

// ─── DRIFT COMPATIBILITY ──────────────────────────────────────────
function calculateDriftCompatibility(trajectory, backwardPaths) {
  if (!trajectory || !backwardPaths || backwardPaths.length === 0) return { score: 0, bestOverlap: Infinity };

  let bestOverlap = Infinity;
  for (const driftPath of backwardPaths) {
    for (const tPt of trajectory) {
      for (const dPt of driftPath) {
        const dist = haversineDistance(tPt.lat, tPt.lng, dPt.lat, dPt.lng);
        if (dist < bestOverlap) bestOverlap = dist;
      }
    }
  }

  let score;
  if (bestOverlap <= 3) score = 100;
  else if (bestOverlap >= 25) score = 0;
  else score = Math.round(100 - ((bestOverlap - 3) / 22) * 100);

  if (bestOverlap < 5) {
    score = Math.min(100, score + 10);
  }

  return { score, bestOverlap };
}

// ─── AIS DATA QUALITY ─────────────────────────────────────────────
function calculateAISQuality(trajectory) {
  if (!trajectory || trajectory.length === 0) return { score: 0, count: 0, trackSpanKm: 0 };
  const len = trajectory.length;

  let trackSpanKm = 0;
  for (let i = 1; i < trajectory.length; i++) {
    trackSpanKm += haversineDistance(
      trajectory[i - 1].lat, trajectory[i - 1].lng,
      trajectory[i].lat, trajectory[i].lng
    );
  }

  const density = len > 1 ? len / Math.max(trackSpanKm, 0.1) : 0;

  let score;
  if (len >= 40 && density > 0.5) score = 95;
  else if (len >= 30) score = 82;
  else if (len >= 20) score = 70;
  else if (len >= 10) score = 55;
  else score = 25;

  const variation = (len * 3 + Math.floor(trackSpanKm * 7)) % 8;
  return { score: Math.min(100, score + variation), count: len, trackSpanKm };
}

// ─── OVERALL ATTRIBUTION COMPATIBILITY SCORE ──────────────────────
function calculateOverallScore(scores) {
  return Math.round(
    scores.spatial * 0.25 +
    scores.temporal * 0.20 +
    scores.trajectory * 0.20 +
    scores.drift * 0.25 +
    scores.aisQuality * 0.10
  );
}

// ─── CONFIDENCE CLASSIFICATION ────────────────────────────────────
function calculateConfidence(overallScore, aisQuality, spatial, drift, temporalAvailable) {
  let confidence = 'LOW';
  if (overallScore >= 80 && aisQuality >= 60 && (spatial >= 70 || drift >= 70)) {
    confidence = 'HIGH';
  } else if (overallScore >= 60 || (spatial >= 70 && drift >= 70)) {
    confidence = 'MEDIUM';
  }
  
  // Cap at MEDIUM if temporal evidence is missing
  if (!temporalAvailable && confidence === 'HIGH') {
    confidence = 'MEDIUM';
  }
  return confidence;
}

// ─── EVIDENCE TEXT GENERATION ──────────────────────────────────────
function generateEvidenceText(metrics) {
  const { spatial, temporal, trajectory, drift, ais } = metrics;
  
  let temporalText = 'Temporal compatibility unavailable: AIS timestamps not available.';
  if (temporal.available && temporal.timeDiffHours !== null) {
    temporalText = `AIS timestamp was within ${temporal.timeDiffHours.toFixed(1)} hours of the estimated spill window.`;
  }

  let trajectoryText = 'Vessel movement does not correlate with the incident origin.';
  if (trajectory.score >= 70) trajectoryText = 'Track direction was compatible with movement toward the origin zone.';
  else if (trajectory.score >= 40) trajectoryText = 'Vessel path shows some alignment with the relevant region.';

  let driftText = 'No meaningful correlation with the backward-drift corridor.';
  if (drift.score >= 80 && drift.bestOverlap < 5) driftText = `Trajectory entered the reconstructed origin corridor (within ${drift.bestOverlap.toFixed(1)} km).`;
  else if (drift.score >= 50) driftText = `Trajectory approached the backward-drift corridor within ${drift.bestOverlap.toFixed(1)} km.`;

  return {
    spatial: `Trajectory approached within ${spatial.minDist.toFixed(1)} km of the dynamic origin.`,
    temporal: temporalText,
    trajectory: trajectoryText,
    drift: driftText,
    aisQuality: `AIS trajectory contains ${ais.count} position reports over approximately ${Math.round(ais.trackSpanKm)} km.`
  };
}

// ─── MAIN RANKING ENTRY POINT ─────────────────────────────────────
/**
 * @param {Array} vessels - The vessel array (typically from case001.vessels). Will be cloned.
 * @param {{ lat: number, lng: number }} originCenter - The dynamic origin probability center.
 * @param {Array} backwardPaths - Dynamic backward drift paths.
 * @param {string} [spillDetectionTime] - ISO timestamp of spill detection (informational).
 * @param {Object} [spillGeoJSON] - AI spill segmentation GeoJSON.
 * @returns {Array} Ranked, scored candidate array.
 */
export function rankCandidates(vessels, originCenter, backwardPaths, spillDetectionTime, spillGeoJSON) {
  console.log('[MARITRACE AIS] Candidates evaluated:', vessels.length);
  console.log(`[MARITRACE AIS] Origin: ${originCenter.lat.toFixed(4)}, ${originCenter.lng.toFixed(4)}`);
  
  let temporalSource = 'unavailable';
  let vesselsToScore = vessels;

  if (spillDetectionTime) {
    console.log(`[MARITRACE AIS] Detection time: ${spillDetectionTime}`);
    // Deterministically generate synthetic timestamps if they don't exist
    if (vessels.length > 0 && (!vessels[0].trajectory || !vessels[0].trajectory[0] || !vessels[0].trajectory[0].timestamp)) {
      vesselsToScore = generateSyntheticTimestamps(vessels, spillDetectionTime);
      temporalSource = 'synthetic';
      console.log(`[MARITRACE AIS] Temporal source: SYNTHETIC`);
    } else {
      temporalSource = 'real';
      console.log(`[MARITRACE AIS] Temporal source: REAL`);
    }
  } else {
    console.log(`[MARITRACE AIS] Temporal source: UNAVAILABLE`);
  }

  const dynamicCandidates = vesselsToScore.map(v => {
    const vessel = JSON.parse(JSON.stringify(v));
    vessel.temporalSource = temporalSource;

    const spatialData = calculateSpatialCompatibility(vessel.trajectory, originCenter);
    const temporalData = calculateTemporalCompatibility(vessel.trajectory, originCenter, spillDetectionTime);
    const trajectoryData = calculateTrajectoryCompatibility(vessel.trajectory, originCenter);
    const driftData = calculateDriftCompatibility(vessel.trajectory, backwardPaths);
    const aisData = calculateAISQuality(vessel.trajectory);

    const scores = { 
      spatial: spatialData.score, 
      temporal: temporalData.score, 
      trajectory: trajectoryData.score, 
      drift: driftData.score, 
      aisQuality: aisData.score 
    };
    scores.overall = calculateOverallScore(scores);

    vessel.scores = scores;
    vessel.confidence = calculateConfidence(scores.overall, scores.aisQuality, scores.spatial, scores.drift, temporalData.available);
    vessel.evidence = generateEvidenceText({ 
      spatial: spatialData, 
      temporal: temporalData, 
      trajectory: trajectoryData, 
      drift: driftData, 
      ais: aisData 
    });

    const lastPt = vessel.trajectory[vessel.trajectory.length - 1];
    vessel.distanceFromOriginKm = Math.round(
      haversineDistance(lastPt.lat, lastPt.lng, originCenter.lat, originCenter.lng)
    );

    return vessel;
  });

  dynamicCandidates.sort((a, b) => b.scores.overall - a.scores.overall);

  if (dynamicCandidates.length > 0) {
    const top = dynamicCandidates[0];
    console.log(`[MARITRACE AIS] Top candidate: ${top.name}`);
    console.log(`[MARITRACE AIS]   Overall: ${top.scores.overall}`);
    console.log(`[MARITRACE AIS]   Spatial: ${top.scores.spatial}`);
    console.log(`[MARITRACE AIS]   Temporal: ${top.scores.temporal}`);
    console.log(`[MARITRACE AIS]   Trajectory: ${top.scores.trajectory}`);
    console.log(`[MARITRACE AIS]   Drift: ${top.scores.drift}`);
    console.log(`[MARITRACE AIS]   AIS Quality: ${top.scores.aisQuality}`);
  }

  return dynamicCandidates;
}
