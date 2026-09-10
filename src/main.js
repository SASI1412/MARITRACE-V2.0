/**
 * Main Application Entry Point
 * Wires together map, panels, and workflow engine
 */
import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/map.css';
import './styles/animations.css';
import './styles/ml-panel.css';

import { initMap, getMap, flyTo } from './map/map-init.js';
import { runInvestigation, resetInvestigation } from './engine/investigation-workflow.js';
import { renderVesselDetailPanel, renderCandidateListPanel, initVesselCardListeners } from './panels/candidate-list-panel.js';
import { animateScoreRings } from './utils/animation-utils.js';
import { getCurrentTimeDisplay } from './utils/format-utils.js';
import { showTrajectory } from './map/layers/vessel-layer.js';
import { case001 } from './data/case001.ts';
import { initLiveAIManager, initializeLiveAIS } from './panels/live-ais-manager.js';
import { initGlobe, focusVesselOnGlobe, clearSelectedVesselOnGlobe, closeSelectedVessel } from './map/globe-controller.js';

// Initialize application
function init() {
  // Init map
  initMap();

  // Init globe
  initGlobe();

  // Update clock
  updateClock();
  setInterval(updateClock, 1000);

  // Live AIS vessel selection handling
  let lastSelectedLiveMmsi = null;
  let lastSelectLiveTimestamp = 0;

  function handleLiveAISVesselSelect(vessel) {
    if (!vessel) return;
    const lat = Number(vessel.lat);
    const lon = Number(vessel.lon !== undefined && vessel.lon !== null ? vessel.lon : vessel.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn('[MariTrace] Invalid coordinates for vessel:', vessel);
      return;
    }

    lastSelectedLiveMmsi = vessel.mmsi || `${lat}_${lon}`;
    lastSelectLiveTimestamp = Date.now();

    // 1. Focus 3D Globe camera smoothly onto vessel and update marker
    focusVesselOnGlobe(vessel);

    // 2. If 2D MapLibre map is active, fly there as well
    const map = getMap();
    if (map) {
      flyTo(lat, lon, 11, 1.5);
    }
  }

  function handleLiveAISVesselDeselect() {
    if (lastSelectedLiveMmsi === null) return;
    lastSelectedLiveMmsi = null;
    closeSelectedVessel(true);
  }

  // Initialize Live AIS Global Stream with explicit callback architecture
  initializeLiveAIS({
    onVesselSelect: handleLiveAISVesselSelect,
    onVesselDeselect: handleLiveAISVesselDeselect
  });

  // Backward compatibility event listeners
  window.addEventListener('live-ais-selected', (e) => {
    const vessel = e.detail;
    if (!vessel) return;
    const key = vessel.mmsi || `${vessel.lat}_${vessel.lon}`;
    if (key === lastSelectedLiveMmsi && (Date.now() - lastSelectLiveTimestamp < 200)) {
      return;
    }
    handleLiveAISVesselSelect(vessel);
  });

  window.addEventListener('live-ais-deselected', () => {
    handleLiveAISVesselDeselect();
  });

  // Set case ID
  document.getElementById('case-id').textContent = 'Case: ' + case001.id;

  // Setup layer toggles
  setupLayerToggles();

  // Tab switching
  setupTabs();

  // Investigate button (header, hidden but maybe used)
  const btnInvestigate = document.getElementById('btn-investigate');
  if (btnInvestigate) {
    btnInvestigate.addEventListener('click', () => {
      runInvestigation(handleVesselSelect);
    });
  }

  // Investigate button (sidebar)
  const btnStartInvestigate = document.getElementById('btn-start-investigation');
  if (btnStartInvestigate) {
    btnStartInvestigate.addEventListener('click', () => {
      runInvestigation(handleVesselSelect);
    });
  }

  // Replay button
  const btnReplay = document.getElementById('btn-replay');
  btnReplay.addEventListener('click', async () => {
    await resetInvestigation();
    // Small delay before re-running
    setTimeout(() => {
      runInvestigation(handleVesselSelect);
    }, 800);
  });
}

function updateClock() {
  const el = document.getElementById('current-time');
  if (el) el.textContent = getCurrentTimeDisplay();
}

function handleVesselSelect(vesselId) {
  const vesselPane = document.getElementById('pane-vessels');
  const map = getMap();

  // Switch to vessels tab
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.querySelector('[data-tab="vessels"]').classList.add('active');
  document.getElementById('pane-vessels').style.display = 'block';

  // Show detail
  vesselPane.innerHTML = renderVesselDetailPanel(vesselId);
  setTimeout(() => animateScoreRings(vesselPane), 100);

  // Show trajectory on map
  const vessel = case001.vessels.find(v => v.id === vesselId);
  if (vessel) showTrajectory(map, vessel);

  // Wire back button
  const backBtn = vesselPane.querySelector('#btn-back-to-list');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      vesselPane.innerHTML = renderCandidateListPanel();
      initVesselCardListeners(vesselPane, handleVesselSelect);
      setTimeout(() => animateScoreRings(vesselPane), 100);
    });
  }
}

function setupTabs() {
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const pane = document.getElementById(`pane-${tabId}`);
      if (pane) pane.style.display = 'block';
    });
  });
}

function setupLayerToggles() {
  const layers = [
    { id: 'spill', label: 'Observed SAR Spill', color: '#ff1744', checked: true },
    { id: 'heatmap', label: 'Origin Probability', color: '#7c4dff', checked: true },
    { id: 'backDrift', label: 'Backward Drift', color: '#ffffff', checked: true },
    { id: 'forwardDrift', label: 'Forward Drift', color: '#ff9800', checked: true },
    { id: 'comparison', label: 'Synthetic Drift Footprint', color: '#d500f9', checked: true },
    { id: 'vessels', label: 'AIS Vessels', color: '#00e5ff', checked: true },
    { id: 'windCurrent', label: 'Wind & Currents', color: '#64b5f6', checked: true },
  ];

  const container = document.getElementById('layer-toggles');
  layers.forEach(layer => {
    const toggle = document.createElement('label');
    toggle.className = 'layer-toggle';
    toggle.innerHTML = `
      <input type="checkbox" ${layer.checked ? 'checked' : ''} data-layer="${layer.id}" id="layer-${layer.id}">
      <span class="layer-color" style="background:${layer.color}"></span>
      ${layer.label}
    `;
    container.appendChild(toggle);
  });

  container.addEventListener('change', (e) => {
    if (!e.target.matches('input[data-layer]')) return;
    const layerId = e.target.dataset.layer;
    const map = getMap();
    const visible = e.target.checked;
    toggleLayerVisibility(layerId, visible, map);
  });
}

function toggleLayerVisibility(layerId, visible, map) {
  const layerMap = {
    spill: () => import('./map/layers/spill-layer.js').then(m => visible ? m.addSpillLayer(map) : m.removeSpillLayer(map)),
    heatmap: () => import('./map/layers/heatmap-layer.js').then(m => visible ? m.addHeatmapLayer(map) : m.removeHeatmapLayer(map)),
    backDrift: () => import('./map/layers/drift-layer.js').then(m => visible ? m.addBackwardDriftLayer(map) : m.removeBackwardDriftLayer(map)),
    forwardDrift: () => import('./map/layers/drift-layer.js').then(m => visible ? m.addForwardDriftLayer(map) : m.removeForwardDriftLayer(map)),
    vessels: () => import('./map/layers/vessel-layer.js').then(m => visible ? m.addVesselLayer(map) : m.removeVesselLayer(map)),
    windCurrent: () => import('./map/layers/wind-current-layer.js').then(m => visible ? m.addWindCurrentLayer(map) : m.removeWindCurrentLayer(map)),
    comparison: () => import('./map/layers/comparison-layer.js').then(m => visible ? m.addComparisonLayer(map) : m.removeComparisonLayer(map)),
  };

  const toggle = layerMap[layerId];
  if (toggle) toggle();
}



// Boot
document.addEventListener('DOMContentLoaded', init);
