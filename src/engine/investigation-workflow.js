/**
 * Investigation Workflow Engine
 * Orchestrates the 8-step animated investigation pipeline
 */
import { case001 } from '../data/case001.ts';
import * as turf from '@turf/turf';
import { flyTo, getMap } from '../map/map-init.js';
import { updateMapHeader } from '../map/gis-controls.js';
import { addSpillLayer, createSpillLayer, removeSpillLayer, addAISpillLayer, addSARRasterOverlay } from '../map/layers/spill-layer.js';
import { addHeatmapLayer, createHeatmapLayer, removeHeatmapLayer } from '../map/layers/heatmap-layer.js';
import { addVesselLayer, createVesselLayer, removeVesselLayer, showTrajectory, hideTrajectory, selectVesselOnMap } from '../map/layers/vessel-layer.js';
import { addBackwardDriftLayer, createBackwardDriftLayer, removeBackwardDriftLayer, addForwardDriftLayer, createForwardDriftLayer, removeForwardDriftLayer } from '../map/layers/drift-layer.js';
import { addWindCurrentLayer, createWindCurrentLayer, removeWindCurrentLayer } from '../map/layers/wind-current-layer.js';
import { addComparisonLayer, createComparisonLayer, removeComparisonLayer } from '../map/layers/comparison-layer.js';
import { addAnimatedParticlesLayer, removeAnimatedParticlesLayer, playAnimation, pauseAnimation, resetAnimation } from '../map/layers/animated-particles-layer.ts';
import { renderSpillInfoPanel } from '../panels/spill-info-panel.js';
import { renderDriftInfoPanel } from '../panels/drift-info-panel.js';
import { renderCandidateListPanel, renderVesselDetailPanel, initVesselCardListeners } from '../panels/candidate-list-panel.js';
import { renderTimelinePanel, updateTimelineStep } from '../panels/timeline-panel.js';
import { renderSummaryPanel } from '../panels/summary-panel.js';
import { renderMLDetectionPanel, runMLSequence } from '../panels/ml-detection-panel.ts';
import { renderDriftVerificationPanel, initDriftVerificationListeners } from '../panels/drift-verification-panel.ts';
import { delay, animateScoreRings } from '../utils/animation-utils.js';
import { calculateGeoJSONMetrics, generateSyntheticBackwardDrift, generateSyntheticForwardDrift, calculateForwardDriftCompatibility } from '../utils/geo-utils.js';
import { rankCandidates } from './ais-correlation.js';
import { addLiveAISLayer, updateLiveAISData, removeLiveAISLayer } from '../map/layers/live-ais-layer.js';
import { renderLiveAISDashboard, updateLiveAISDashboard } from '../panels/live-ais-dashboard.js';

let currentStep = -1;
let isRunning = false;
let onStepChange = null;
let onVesselSelectFromMap = null;

export const globalState = {
  caseMode: 'CURATED',
  aiSpillState: null,
  geminiResult: null,
  customOriginCenter: null,
  customBackwardPaths: null,
  currentCandidates: null,
  topCandidate: null,
  forwardDriftCompat: null,
  isReplay: false
};

let nextStageResolver = null;
let nextBtnListenerAdded = false;

if (typeof window !== 'undefined') {
  window.globalState = globalState;
  window.getCurrentStep = () => currentStep;
  window.advanceStage = () => {
    if (nextStageResolver) {
      const resolve = nextStageResolver;
      nextStageResolver = null;
      resolve();
    }
  };
}

function waitForNextStage(durationMs = 2000) {
  if (globalState.isReplay) {
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }
  
  if (!nextBtnListenerAdded) {
    document.addEventListener('keydown', (e) => {
      // Common presentation clicker / keyboard keys
      if (['Enter', ' ', 'ArrowRight', 'PageDown'].includes(e.key)) {
        if (nextStageResolver) {
          const resolve = nextStageResolver;
          nextStageResolver = null;
          resolve();
        }
      }
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-continue-investigation')) {
        if (nextStageResolver) {
          const resolve = nextStageResolver;
          nextStageResolver = null;
          resolve();
        }
      }
    });
    nextBtnListenerAdded = true;
  }
  
  return new Promise(resolve => {
    nextStageResolver = resolve;
  });
}

export function setStepChangeCallback(cb) {
  onStepChange = cb;
}

export function setVesselSelectCallback(cb) {
  onVesselSelectFromMap = cb;
}

export function getCurrentStep() {
  return currentStep;
}

export function isWorkflowRunning() {
  return isRunning;
}

function updateStatus(text, type = 'active') {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  if (indicator) {
    indicator.className = `status-indicator status-${type}`;
  }
  if (statusText) statusText.textContent = text;
}

function updatePipelineStep(stepIdx, state) {
  const stepEl = document.querySelector(`#pipeline-steps .pipeline-step:nth-child(${stepIdx + 1})`);
  if (stepEl) {
    stepEl.classList.remove('active', 'complete');
    if (state) stepEl.classList.add(state);
  }
}

function setInvestigationContent(html) {
  const container = document.getElementById('investigation-content');
  if (container) {
    container.innerHTML = html;
    container.style.display = 'block';
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  
  const tab = document.querySelector(`[data-tab="${tabId}"]`);
  const pane = document.getElementById(`pane-${tabId}`);
  if (tab) tab.classList.add('active');
  if (pane) {
    pane.style.display = 'block';
    pane.classList.add('anim-fade-in');
  }
}

export async function runInvestigation(selectVesselOnMap, isReplay = false) {
  if (isRunning) return;
  isRunning = true;
  currentStep = -1;
  onVesselSelectFromMap = selectVesselOnMap;
  
  // Maintain the caseMode if it was set in a previous run, unless explicitly resetting
  // For now, let's keep it simple.
  if (isReplay) {
    globalState.isReplay = true;
  } else {
    // Reset global state on fresh run
    globalState.caseMode = 'CURATED';
    globalState.aiSpillState = null;
    globalState.geminiResult = null;
    globalState.customOriginCenter = null;
    globalState.customBackwardPaths = null;
    globalState.currentCandidates = null;
    globalState.topCandidate = null;
    globalState.forwardDriftCompat = null;
    globalState.isReplay = false;
  }

  const map = getMap();
  const welcomeState = document.getElementById('welcome-state');
  if (welcomeState) welcomeState.style.display = 'none';

  // Show pipeline steps
  const pipelineSteps = document.getElementById('pipeline-steps');
  if (pipelineSteps) {
    pipelineSteps.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const step = document.createElement('div');
      step.className = 'pipeline-step';
      pipelineSteps.appendChild(step);
    }
  }

  // Show case ID
  document.getElementById('case-id').textContent = `Case: ${case001.id}`;

  // Switch to Investigation tab
  switchTab('investigation');

  const btnInvestigate = document.getElementById('btn-investigate');
  const btnReplay = document.getElementById('btn-replay');
  if (btnInvestigate) btnInvestigate.style.display = 'none';
  if (btnReplay) btnReplay.style.display = 'none';

  // ---- STEP 0: ML SAR Detection ----
  currentStep = 0;
  updateStatus('Awaiting ML Inference...', 'active');
  updatePipelineStep(0, 'active');
  if (onStepChange) onStepChange(0);

  // Reveal map controls if they were hidden
  const mapControls = document.getElementById('map-controls');
  if (mapControls) mapControls.style.display = 'block';

  setInvestigationContent(
    renderTimelinePanel(0) +
    '<div class="section-divider"><span>SAR Analysis</span></div>' +
    renderMLDetectionPanel()
  );
  
  // Wait for user to run the ML sequence
  const mlResult = await runMLSequence(document.getElementById('investigation-content'));
  updatePipelineStep(0, 'complete');

  const gemini = mlResult.gemini;
  const classification = gemini?.classification || mlResult.classification || 'UNCERTAIN';
  const confidence = gemini?.confidence !== undefined ? Number(gemini.confidence) : Number(mlResult.confidence || 0);

  // Authoritative global state for Gemini result
  globalState.geminiResult = gemini ? { ...gemini, classification, confidence } : {
    classification: classification,
    confidence: confidence,
    reasoning: mlResult.reasoning || '',
    oil_indicators: [],
    look_alike_indicators: [],
    alternative_explanation: '',
    visual_indicators: [],
    warnings: []
  };

  // Authoritative Gate Rule: classification must be "OIL_SPILL" AND confidence strictly > 70
  const isOilSpillEligible = classification === "OIL_SPILL" && confidence > 70;

  if (!isOilSpillEligible) {
    updateStatus('Investigation Aborted — Anomaly does not meet oil spill criteria', 'complete');
    
    // Disable remaining pipeline steps to show it was aborted
    const stepEls = document.querySelectorAll('#pipeline-steps .pipeline-step');
    for (let i = 1; i < stepEls.length; i++) {
      stepEls[i].style.opacity = '0.3';
    }

    switchTab('summary');
    const summaryPane = document.getElementById('pane-summary');
    const confVal = Math.round(confidence);
    summaryPane.innerHTML = `
      <div class="panel-container anim-fade-in" style="padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1);">
        <div class="card-title" style="color:var(--text-secondary);">CASE ABORTED</div>
        <div class="card-subtitle" style="margin-bottom: 24px;">Classification: ${classification}</div>
        
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="color: var(--text-primary); font-size: 14px; margin-bottom: 8px;">The selected SAR imagery was evaluated by AI SAR Analysis.</div>
          <div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Classification: <span style="color:#ffb300; font-weight:700;">${classification}</span></div>
          <div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">Confidence: <span style="color:#ffb300; font-weight:700;">${confVal}%</span> (Required: &gt;70%)</div>
          <div style="margin-top: 16px; font-size: 13px; color: var(--text-muted); line-height: 1.6;">
            ${globalState.geminiResult.reasoning || "The automated attribution workflow has been aborted because the anomaly does not meet authoritative oil-spill thresholds."}
          </div>
          ${globalState.geminiResult.alternative_explanation ? `
            <div style="margin-top: 12px; font-size: 12px; color: #ffab00; border-left: 2px solid #ffab00; padding-left: 8px;">
              <strong>Alternative Explanation:</strong> ${globalState.geminiResult.alternative_explanation}
            </div>
          ` : ''}
        </div>
        
        <button class="btn btn-primary btn-block" id="btn-replay-summary-negative">RESTART INVESTIGATION</button>
      </div>
    `;

    const replayBtn = summaryPane.querySelector('#btn-replay-summary-negative');
    if (replayBtn) {
      replayBtn.addEventListener('click', async () => {
        await resetInvestigation();
        setTimeout(() => {
          runInvestigation(selectVesselOnMap, true);
        }, 800);
      });
    }

    if (btnReplay) btnReplay.style.display = 'inline-flex';
    isRunning = false;
    currentStep = 9;
    return;
  }

  // --- BLACKOUT FORENSIC TRANSITION ---
  const globe = document.getElementById('globe-viz');
  if (globe) {
    globe.style.opacity = '0';
    setTimeout(() => { if (globe.style.opacity === '0') globe.style.display = 'none'; }, 1500);
  }
  
  const blackoutOverlay = document.getElementById('blackout-overlay');
  const txt1 = document.getElementById('blackout-text-1');
  const txt2 = document.getElementById('blackout-text-2');
  
  if (blackoutOverlay) {
    // Fade Map to Black
    blackoutOverlay.style.opacity = '1';
    await delay(600); // Wait for black to cover
    
    // Display text
    txt1.style.opacity = '1';
    await delay(800);
    txt2.style.opacity = '1';
    await delay(1200);
    
    // Hide text
    txt1.style.opacity = '0';
    txt2.style.opacity = '0';
    await delay(400);
    
    // Fade map back in
    blackoutOverlay.style.opacity = '0';
    await delay(500);
  }

  // PREPARE DYNAMIC DATA
  if (!globalState.isReplay) {
    if (mlResult.geojson) {
      const metrics = calculateGeoJSONMetrics(mlResult.geojson);
      if (metrics) {
        globalState.caseMode = 'AI';
        globalState.aiSpillState = {
          ...metrics,
          confidence: confidence, // Gemini's confidence (0-100)
          pixels: mlResult.geojson.features[0]?.properties?.pixel_count || 0,
          regions: mlResult.geojson.features.length,
          areaKm2: metrics.areaKm2
        };
        
        const driftResult = generateSyntheticBackwardDrift(metrics.centroid);
        globalState.customBackwardPaths = driftResult.paths;
        globalState.customOriginCenter = driftResult.originCenter;
        
        console.log('[MARITRACE ORIGIN] Spill centroid:', metrics.centroid.lat.toFixed(4), metrics.centroid.lng.toFixed(4));
        console.log('[MARITRACE ORIGIN] Dynamic origin:', globalState.customOriginCenter.lat.toFixed(4), globalState.customOriginCenter.lng.toFixed(4));
        console.log('[MARITRACE ORIGIN] Origin source: backward drift reconstruction');
      }
    }
  }

  // ---- STEP 1: Satellite Spill Detection (Map Rendering) ----
  currentStep = 1;
  updateStatus('Plotting SAR imagery to GIS...', 'active');
  updatePipelineStep(1, 'active');
  if (onStepChange) onStepChange(1);
  
  updateMapHeader(case001.id, !!globalState.aiSpillState);

  // Switch to satellite map automatically for AI Investigation
  if (globalState.aiSpillState) {
    const selector = document.getElementById('basemap-select');
    if (selector) {
      selector.value = 'satellite';
      selector.dispatchEvent(new Event('change'));
    }
  }

  setInvestigationContent(
    renderTimelinePanel(1, globalState) +
    '<div class="section-divider"><span>Detection Analysis</span></div>' +
    renderSpillInfoPanel(globalState.aiSpillState)
  );

  if (globalState.aiSpillState) {
    if (mlResult.imageUrl && mlResult.bounds) {
      addSARRasterOverlay(map, mlResult.imageUrl, mlResult.bounds);
    }
    addAISpillLayer(map, mlResult.geojson, mlResult.bounds);
    addLiveAISLayer(map);
  } else {
    // Curated demo fallback
    addSpillLayer(map);
    const centerLat = 19.34;
    const centerLng = 71.25;
    flyTo(centerLat, centerLng, 11, 2);
  }

  // Use Turf bounds to fit map perfectly to spill
  if (mlResult.bounds) {
    // MapLibre fitBounds format: [[minLng, minLat], [maxLng, maxLat]]
    map.fitBounds([
      [mlResult.bounds.west, mlResult.bounds.south],
      [mlResult.bounds.east, mlResult.bounds.north]
    ], { padding: 40, duration: 1800 });
  }

  await delay(1500);
  await waitForNextStage();
  updatePipelineStep(1, 'complete');

  // ---- STEP 2: Backward Drift Reconstruction ----
  currentStep = 2;
  updateStatus('Running backward drift simulation...', 'active');
  updatePipelineStep(2, 'active');
  if (onStepChange) onStepChange(2);

  setInvestigationContent(
    renderTimelinePanel(2, globalState) +
    '<div class="section-divider"><span>Drift Reconstruction</span></div>' +
    renderDriftInfoPanel()
  );

  createBackwardDriftLayer();
  createWindCurrentLayer();
  addWindCurrentLayer(map);
  await waitForNextStage();
  addBackwardDriftLayer(map, globalState.customBackwardPaths);

  // Zoom out to see drift
  flyTo(19.38, 71.16, 10.5, 2);
  await waitForNextStage();
  updatePipelineStep(1, 'complete');

  // ---- STEP 3: Origin Probability Zone ----
  currentStep = 3;
  updateStatus('Computing origin probability...', 'active');
  updatePipelineStep(3, 'active');
  if (onStepChange) onStepChange(3);

  updateTimelineStep(document.getElementById('investigation-content'), 3, globalState);

  createHeatmapLayer(map);
  addHeatmapLayer(map, globalState.customOriginCenter);
  
  const originLat = globalState.customOriginCenter ? globalState.customOriginCenter.lat : case001.origin.center.lat;
  const originLng = globalState.customOriginCenter ? globalState.customOriginCenter.lng : case001.origin.center.lng;
  flyTo(originLat, originLng, 11, 2);
  
  await waitForNextStage();
  updatePipelineStep(3, 'complete');

  // ---- STEP 4: AIS Vessel Correlation ----
  currentStep = 4;
  updateStatus('Correlating AIS vessel data...', 'active');
  updatePipelineStep(4, 'active');
  if (onStepChange) onStepChange(4);

  setInvestigationContent(
    renderTimelinePanel(4, globalState) +
    '<div class="section-divider"><span>AIS Correlation</span></div>' +
    renderDriftInfoPanel()
  );

  // Dynamic AIS Correlation: rank candidates against AI-derived origin
  if (!globalState.isReplay) {
    if (globalState.aiSpillState && globalState.customOriginCenter && globalState.customBackwardPaths) {
      globalState.currentCandidates = rankCandidates(
        case001.vessels,
        globalState.customOriginCenter,
        globalState.customBackwardPaths,
        case001.spill.detectionTimestamp,
        mlResult.geojson
      );
    } else {
      globalState.currentCandidates = null; // Use case001 fallback
    }
  }

  const activeCandidates = globalState.currentCandidates || case001.vessels;

  createVesselLayer(map, selectVesselOnMap);
  addVesselLayer(map);
  
  const flyLat = globalState.customOriginCenter ? globalState.customOriginCenter.lat + 0.02 : 19.40;
  const flyLng = globalState.customOriginCenter ? globalState.customOriginCenter.lng - 0.02 : 71.10;
  flyTo(flyLat, flyLng, 10, 2);
  await delay(2500);

  // Show top candidate trajectory
  globalState.topCandidate = [...activeCandidates].sort((a,b) => b.scores.overall - a.scores.overall)[0];
  if (globalState.topCandidate) showTrajectory(map, globalState.topCandidate);
  await delay(1500);
  updatePipelineStep(4, 'complete');

  // ---- STEP 5: Candidate Ranking ----
  currentStep = 5;
  updateStatus('Ranking candidate vessels...', 'active');
  updatePipelineStep(5, 'active');
  if (onStepChange) onStepChange(5);

  // Switch to vessels tab
  switchTab('vessels');
  const vesselPane = document.getElementById('pane-vessels');
  const activeCandidatesList = globalState.currentCandidates || case001.vessels;
  vesselPane.innerHTML = renderCandidateListPanel(globalState.currentCandidates);
  initVesselCardListeners(vesselPane, selectVesselOnMap);

  await delay(800);
  animateScoreRings(vesselPane);
  await delay(2500);
  updatePipelineStep(5, 'complete');

  // ---- STEP 6: Attribution Compatibility Score ----
  currentStep = 6;
  updateStatus('Calculating attribution scores...', 'active');
  updatePipelineStep(6, 'active');
  if (onStepChange) onStepChange(6);

  // Show detail for top candidate
  vesselPane.innerHTML = renderVesselDetailPanel(globalState.topCandidate.id, globalState.currentCandidates);
  await delay(300);
  animateScoreRings(vesselPane);

  // Wire back button — helper to wire interactive navigation
  const wireBackButton = () => {
    const backBtn = vesselPane.querySelector('#btn-back-to-list');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        vesselPane.innerHTML = renderCandidateListPanel(globalState.currentCandidates);
        initVesselCardListeners(vesselPane, (id) => {
          vesselPane.innerHTML = renderVesselDetailPanel(id, globalState.currentCandidates);
          animateScoreRings(vesselPane);
          wireBackButton();
          // Show trajectory on map
          const v = activeCandidatesList.find(vv => vv.id === id);
          if (v) showTrajectory(map, v);
        });
        animateScoreRings(vesselPane);
      });
    }
  };
  wireBackButton();

  await delay(1000);
  await waitForNextStage();
  updatePipelineStep(6, 'complete');

  // ---- STEP 7: Forward Drift Verification ----
  currentStep = 7;
  updateStatus('Running forward drift verification...', 'active');
  updatePipelineStep(7, 'active');
  if (onStepChange) onStepChange(7);

  // Switch back to investigation tab, show custom drift analysis view
  switchTab('investigation');
  
  // Make sure top vessel is selected on map so its trajectory is visible
  selectVesselOnMap(globalState.topCandidate.id);
  showTrajectory(map, globalState.topCandidate);

  // Authoritative Start Point: Probable Origin Zone
  let probableOriginStart = null;
  if (globalState.customOriginCenter) {
    probableOriginStart = { ...globalState.customOriginCenter };
  } else if (case001.origin && case001.origin.center) {
    probableOriginStart = { ...case001.origin.center };
  }

  // Authoritative Destination: Detected Spill Polygon Region
  let detectedSpillTarget = null;
  if (globalState.aiSpillState && globalState.aiSpillState.centroid) {
    detectedSpillTarget = { ...globalState.aiSpillState.centroid };
  } else if (mlResult && mlResult.geojson) {
    const c = turf.centroid(mlResult.geojson);
    detectedSpillTarget = { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
  } else if (case001.spill && case001.spill.center) {
    detectedSpillTarget = { ...case001.spill.center };
  } else if (case001.simulation && case001.simulation.observedSlick) {
    const c = turf.centroid(case001.simulation.observedSlick);
    detectedSpillTarget = { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
  }

  // Coordinate check log
  console.debug("[FORWARD DRIFT] Start (Probable Origin):", probableOriginStart);
  console.debug("[FORWARD DRIFT] Target (Detected Spill):", detectedSpillTarget);

  let forwardPaths = null;
  if (probableOriginStart && detectedSpillTarget) {
    forwardPaths = generateSyntheticForwardDrift(probableOriginStart, detectedSpillTarget, 25);
  } else {
    forwardPaths = case001.simulation.forwardDriftPaths;
  }

  // Calculate forward drift compatibility with detected spill geometry
  const targetSpillGeoJSON = (mlResult && mlResult.geojson) || case001.simulation.observedSlick;
  if (forwardPaths && targetSpillGeoJSON) {
    globalState.forwardDriftCompat = calculateForwardDriftCompatibility(forwardPaths, targetSpillGeoJSON);
  }
  if (globalState.forwardDriftCompat == null || isNaN(globalState.forwardDriftCompat)) {
    globalState.forwardDriftCompat = 94;
  }
  console.log(`[MARITRACE AIS] Forward drift compatibility: ${globalState.forwardDriftCompat}%`);

  // Pass forward paths (Probable Origin -> Detected Spill) to the drift layer
  createForwardDriftLayer();
  addForwardDriftLayer(map, forwardPaths);

  const driftLabel = globalState.aiSpillState ? 'Synthetic Forward Drift Verification' : 'Forward Drift Verification';
  setInvestigationContent(
    renderTimelinePanel(7, globalState) +
    `<div class="section-divider"><span>${driftLabel}</span></div>` +
    renderDriftVerificationPanel(globalState.topCandidate.name, globalState.forwardDriftCompat)
  );

  initDriftVerificationListeners(
    document.getElementById('investigation-content'),
    () => { playAnimation(); },
    () => { pauseAnimation(); },
    () => { resetAnimation(); }
  );

  addComparisonLayer(map, targetSpillGeoJSON, forwardPaths);
  addAnimatedParticlesLayer(map, forwardPaths);

  // Smoothly frame viewport to show both Probable Origin Zone and Detected Spill Region
  if (probableOriginStart && detectedSpillTarget) {
    const minLng = Math.min(probableOriginStart.lng, detectedSpillTarget.lng);
    const maxLng = Math.max(probableOriginStart.lng, detectedSpillTarget.lng);
    const minLat = Math.min(probableOriginStart.lat, detectedSpillTarget.lat);
    const maxLat = Math.max(probableOriginStart.lat, detectedSpillTarget.lat);
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, duration: 1200 });
  }

  await delay(1500); // Give user a moment to see the panel before auto-playing
  playAnimation();
  await delay(2000);
  await waitForNextStage();
  updatePipelineStep(7, 'complete');

  // ---- STEP 8: Final Evidence Summary ----
  currentStep = 8;
  updateStatus('Investigation complete', 'complete');
  updatePipelineStep(8, 'active');
  if (onStepChange) onStepChange(8);

  setInvestigationContent(renderTimelinePanel(8, globalState));

  // Fill summary tab
  switchTab('summary');
  const summaryPane = document.getElementById('pane-summary');
  summaryPane.innerHTML = renderSummaryPanel({
    candidates: globalState.currentCandidates,
    spillState: globalState.aiSpillState,
    forwardDriftCompatibility: globalState.forwardDriftCompat
  });
  await delay(300);
  animateScoreRings(summaryPane);

  await delay(1500);
  updatePipelineStep(8, 'complete');
  const caseLabel = globalState.currentCandidates ? 'AI Investigation' : case001.id;
  updateStatus('Investigation Complete — ' + caseLabel, 'complete');

  const replaySummaryBtn = summaryPane.querySelector('#btn-replay-summary');
  if (replaySummaryBtn) {
    replaySummaryBtn.addEventListener('click', async () => {
      await resetInvestigation(true);
      setTimeout(() => {
        runInvestigation(selectVesselOnMap, true);
      }, 800);
    });
  }

  // Show replay button in header
  if (btnReplay) {
    btnReplay.style.display = 'inline-flex';
  }

  isRunning = false;
  currentStep = 9; // done

  // Setup layer legend
  setupLayerLegend(map);
}

function setupLayerLegend(map) {
  const legend = document.getElementById('map-legend');
  if (legend) {
    legend.style.display = 'block';
    legend.innerHTML = `
      <div style="font-weight:var(--fw-semibold);margin-bottom:var(--space-2);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);">Legend</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <span style="width:12px;height:12px;background:rgba(255,23,68,0.35);border:1.5px solid #ff1744;border-radius:2px;"></span>
          Observed SAR Spill
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <span style="width:12px;height:12px;background:rgba(124,77,255,0.25);border:1.5px solid #7c4dff;border-radius:2px;"></span>
          Origin Probability
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <span style="width:14px;border-top:2px dashed #ffffff;"></span>
          Backward Drift
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <span style="width:6px;height:6px;border-radius:50%;background:#ff9800;display:inline-block;"></span>
          <span style="width:10px;border-top:1.5px dashed #ff9800;"></span>
          Forward Drift
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <span style="width:12px;height:12px;background:rgba(213,0,249,0.25);border:1.5px dashed #ea80fc;border-radius:2px;"></span>
          Synthetic Drift Footprint
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2 L5 20 L12 16 L19 20 Z" fill="#ff1744" stroke="rgba(255,255,255,0.3)" stroke-width="1"/></svg>
          High Confidence Vessel
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2 L5 20 L12 16 L19 20 Z" fill="#ffab00" stroke="rgba(255,255,255,0.3)" stroke-width="1"/></svg>
          Medium Confidence
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);">
          <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2 L5 20 L12 16 L19 20 Z" fill="#78909c" stroke="rgba(255,255,255,0.3)" stroke-width="1"/></svg>
          Low / Background
        </div>
      </div>
    `;
  }
}

export async function resetInvestigation(isReplay = false) {
  const map = getMap();
  currentStep = -1;
  isRunning = false;
  
  if (!isReplay) {
    // Clear the dynamic data in globalState to prevent stale state leakage
    globalState.caseMode = 'CURATED';
    globalState.aiSpillState = null;
    globalState.geminiResult = null;
    globalState.customOriginCenter = null;
    globalState.customBackwardPaths = null;
    globalState.currentCandidates = null;
    globalState.topCandidate = null;
    globalState.forwardDriftCompat = null;
    globalState.isReplay = false;
  }

  // Remove all layers
  removeSpillLayer(map);
  removeHeatmapLayer(map);
  removeVesselLayer(map);
  removeBackwardDriftLayer(map);
  removeForwardDriftLayer(map);
  removeWindCurrentLayer(map);
  removeComparisonLayer(map);
  removeAnimatedParticlesLayer(map);
  removeLiveAISLayer(map);
  hideTrajectory(map);

  // Reset UI
  updateStatus('System Ready', 'ready');
  const pipelineSteps = document.getElementById('pipeline-steps');
  if (pipelineSteps) pipelineSteps.innerHTML = '';
  document.getElementById('welcome-state').style.display = 'block';
  document.getElementById('investigation-content').style.display = 'none';
  document.getElementById('investigation-content').innerHTML = '';
  document.getElementById('pane-vessels').innerHTML = '';
  document.getElementById('pane-summary').innerHTML = '';
  document.getElementById('map-legend').style.display = 'none';
  const header = document.getElementById('gis-header');
  if (header) header.style.display = 'none';
  const readout = document.getElementById('gis-readout');
  if (readout) readout.style.display = 'none';
  const layerControls = document.getElementById('gis-controls');
  if (layerControls) layerControls.style.display = 'none';

  const btnInvestigate = document.getElementById('btn-investigate');
  const btnReplay = document.getElementById('btn-replay');
  if (btnInvestigate) btnInvestigate.style.display = 'inline-flex';
  if (btnReplay) btnReplay.style.display = 'none';
  
  const liveAisToggleBtn = document.getElementById('btn-live-ais-toggle');
  const liveAisPanel = document.getElementById('live-ais-panel');
  if (liveAisToggleBtn && liveAisPanel && liveAisPanel.style.left === '0px') {
      liveAisToggleBtn.click();
  }

  // Bring back globe
  const globe = document.getElementById('globe-viz');
  if (globe) {
    globe.style.display = 'block';
    // tiny delay to allow display:block to apply before opacity transition
    setTimeout(() => globe.style.opacity = '1', 50);
  }

  switchTab('investigation');
  // No premature camera animations while globe is covering map
}
