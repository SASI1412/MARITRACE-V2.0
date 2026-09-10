/**
 * Globe Controller — Manages the 3D globe visualization, auto-rotation,
 * vessel markers, and camera transitions.
 */

let myGlobe = null;
let isAutoRotate = true;
let currentSelectedVessel = null;

export function initGlobe() {
  const container = document.getElementById('globe-viz');
  if (!container || !window.Globe) return;

  // Initialize Globe.gl instance
  myGlobe = window.Globe()(container)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
    .pointOfView({ lat: 15, lng: 70, altitude: 1.5 })
    .htmlElementsData([])
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(0.01)
    .htmlElement(renderGlobeVesselElement);

  window.myGlobeInstance = myGlobe;

  // Slow, elegant auto-rotation suitable for forensic maritime presentation
  myGlobe.controls().autoRotate = true;
  myGlobe.controls().autoRotateSpeed = 0.5;
  isAutoRotate = true;

  // Pause auto-rotation when the user drags, zooms, or interacts with the globe
  myGlobe.controls().addEventListener('start', () => {
    if (isAutoRotate) {
      setAutoRotate(false);
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (myGlobe && container) {
      myGlobe.width(container.clientWidth).height(container.clientHeight);
    }
  });

  // Inject Controls and HUD Overlays into globe-viz
  injectGlobeControls(container);
}

function injectGlobeControls(container) {
  // 1. Auto-Rotate & Global View Controls (bottom left)
  const controlsDiv = document.createElement('div');
  controlsDiv.id = 'globe-bottom-controls';
  controlsDiv.style.cssText = `
    position: absolute;
    bottom: 24px;
    left: 24px;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
  `;

  controlsDiv.innerHTML = `
    <button id="btn-toggle-autorotate" style="background: rgba(10, 15, 25, 0.88); border: 1px solid rgba(0, 229, 255, 0.4); color: var(--primary-main); padding: 7px 14px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; cursor: pointer; letter-spacing: 1px; backdrop-filter: blur(8px); display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); transition: all 0.2s;">
      <span id="autorotate-indicator" style="width: 7px; height: 7px; border-radius: 50%; background: #00e5ff; box-shadow: 0 0 6px #00e5ff;"></span>
      AUTO ROTATE: <span id="autorotate-status">ON</span>
    </button>
    <button id="btn-reset-globe-view" style="background: rgba(10, 15, 25, 0.88); border: 1px solid rgba(255, 255, 255, 0.2); color: #cbd5e1; padding: 7px 14px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; cursor: pointer; letter-spacing: 0.5px; backdrop-filter: blur(8px); display: none; box-shadow: 0 4px 14px rgba(0,0,0,0.6); transition: all 0.2s;">
      GLOBAL VIEW
    </button>
  `;
  container.appendChild(controlsDiv);

  // Wire Auto Rotate toggle button
  const rotateBtn = controlsDiv.querySelector('#btn-toggle-autorotate');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      setAutoRotate(!isAutoRotate);
    });
  }

  // Wire Global View reset button
  const resetBtn = controlsDiv.querySelector('#btn-reset-globe-view');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      clearSelectedVesselOnGlobe(true);
    });
  }

  // 2. Compact Selected Vessel HUD (top left)
  const hudDiv = document.createElement('div');
  hudDiv.id = 'globe-vessel-hud';
  hudDiv.style.cssText = `
    position: absolute;
    top: 20px;
    left: 24px;
    z-index: 9999;
    display: none;
    min-width: 230px;
    background: rgba(10, 15, 25, 0.94);
    border: 1px solid rgba(0, 229, 255, 0.5);
    border-radius: 6px;
    padding: 10px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #f8fafc;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8), 0 0 12px rgba(0, 229, 255, 0.2);
    backdrop-filter: blur(10px);
    pointer-events: auto;
    transition: left 0.3s ease;
  `;
  hudDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 6px;">
      <div style="font-weight: 700; color: #00e5ff; font-family: 'Inter', sans-serif; font-size: 12px; letter-spacing: 0.5px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" id="hud-vessel-name">VESSEL</div>
      <button id="btn-close-hud" style="background: none; border: none; color: #94a3b8; font-size: 13px; cursor: pointer; padding: 0 4px; line-height: 1;" title="Dismiss">✕</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
      <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">MMSI:</span> <span id="hud-vessel-mmsi" style="color: #cbd5e1;">—</span></div>
      <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">SPEED:</span> <span id="hud-vessel-speed" style="color: #00e5ff;">— kn</span></div>
      <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">COURSE:</span> <span id="hud-vessel-course" style="color: #cbd5e1;">—°</span></div>
      <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">POSITION:</span> <span id="hud-vessel-pos" style="color: #cbd5e1;">—</span></div>
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 9px; color: #34d399; font-weight: 700; letter-spacing: 0.5px;">SOURCE: LIVE AISSTREAM</div>
    </div>
  `;
  container.appendChild(hudDiv);

  const closeHudBtn = hudDiv.querySelector('#btn-close-hud');
  if (closeHudBtn) {
    closeHudBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSelectedVessel(true);
    });
  }

  // Adjust HUD position when drawer toggle is clicked
  const toggleBtn = document.getElementById('btn-live-ais-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      setTimeout(() => {
        const livePanel = document.getElementById('live-ais-panel');
        const isDrawerOpen = livePanel && (livePanel.style.left === '0px' || parseInt(livePanel.style.left, 10) >= 0);
        hudDiv.style.left = isDrawerOpen ? '380px' : '24px';
      }, 50);
    });
  }
}

export function setAutoRotate(enabled) {
  isAutoRotate = !!enabled;
  if (myGlobe && myGlobe.controls()) {
    myGlobe.controls().autoRotate = isAutoRotate;
    if (isAutoRotate) {
      myGlobe.controls().autoRotateSpeed = 0.5;
    }
  }

  const indicator = document.getElementById('autorotate-indicator');
  const status = document.getElementById('autorotate-status');
  if (indicator && status) {
    if (isAutoRotate) {
      indicator.style.background = '#00e5ff';
      indicator.style.boxShadow = '0 0 6px #00e5ff';
      status.textContent = 'ON';
    } else {
      indicator.style.background = '#64748b';
      indicator.style.boxShadow = 'none';
      status.textContent = 'OFF';
    }
  }
}

export function getGlobe() {
  return myGlobe;
}

export function focusVesselOnGlobe(vessel) {
  if (!vessel) return;
  const lat = Number(vessel.lat);
  const lon = Number(vessel.lon !== undefined && vessel.lon !== null ? vessel.lon : vessel.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  currentSelectedVessel = vessel;

  // Make sure globe is visible
  const container = document.getElementById('globe-viz');
  if (container) {
    container.style.display = 'block';
    container.style.opacity = '1';
  }

  // 1. Stop auto-rotation immediately when a vessel is inspected
  setAutoRotate(false);

  // 2. Smoothly fly camera to the vessel coordinates
  if (myGlobe) {
    myGlobe.pointOfView({ lat: lat, lng: lon, altitude: 0.55 }, 1200);

    // 3. Place anchored 3D HTML marker at exact vessel coordinates
    myGlobe.htmlElementsData([{
      ...vessel,
      lat: lat,
      lng: lon
    }]);
  }

  // 4. Update and show the HUD card
  updateVesselHud(vessel);

  // 5. Show the Global View button
  const resetBtn = document.getElementById('btn-reset-globe-view');
  if (resetBtn) resetBtn.style.display = 'inline-flex';
}

function updateVesselHud(vessel) {
  const hudDiv = document.getElementById('globe-vessel-hud');
  if (!hudDiv || !vessel) return;

  const livePanel = document.getElementById('live-ais-panel');
  const isDrawerOpen = livePanel && (livePanel.style.left === '0px' || parseInt(livePanel.style.left, 10) >= 0);
  hudDiv.style.left = isDrawerOpen ? '380px' : '24px';

  const lat = Number(vessel.lat);
  const lon = Number(vessel.lon !== undefined && vessel.lon !== null ? vessel.lon : vessel.lng);

  const mmsiText = vessel.mmsi != null && String(vessel.mmsi).trim() !== '' && String(vessel.mmsi).toLowerCase() !== 'null' && String(vessel.mmsi).toLowerCase() !== 'undefined'
    ? String(vessel.mmsi).trim()
    : 'N/A';
  const shipName = vessel.shipName && String(vessel.shipName).trim() !== '' && String(vessel.shipName).toLowerCase() !== 'null' && String(vessel.shipName).toLowerCase() !== 'undefined'
    ? String(vessel.shipName).trim()
    : (mmsiText !== 'N/A' ? `VESSEL ${mmsiText}` : 'UNKNOWN VESSEL');
  const sogNum = Number(vessel.sog);
  const sogText = Number.isFinite(sogNum) ? `${sogNum.toFixed(1)} kn` : 'N/A';
  const cogNum = Number(vessel.cog);
  const cogText = Number.isFinite(cogNum) ? `${cogNum.toFixed(0)}°` : 'N/A';
  const posText = Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(4)}°, ${lon.toFixed(4)}°` : 'N/A';

  const nameEl = hudDiv.querySelector('#hud-vessel-name');
  const mmsiEl = hudDiv.querySelector('#hud-vessel-mmsi');
  const speedEl = hudDiv.querySelector('#hud-vessel-speed');
  const courseEl = hudDiv.querySelector('#hud-vessel-course');
  const posEl = hudDiv.querySelector('#hud-vessel-pos');

  if (nameEl) nameEl.textContent = shipName;
  if (mmsiEl) mmsiEl.textContent = mmsiText;
  if (speedEl) speedEl.textContent = sogText;
  if (courseEl) courseEl.textContent = cogText;
  if (posEl) posEl.textContent = posText;

  hudDiv.style.display = 'block';
}

export function updateSelectedVesselOnGlobe(updatedVessel) {
  if (!currentSelectedVessel || !updatedVessel) return;
  if (currentSelectedVessel.mmsi && updatedVessel.mmsi && String(currentSelectedVessel.mmsi) === String(updatedVessel.mmsi)) {
    currentSelectedVessel = updatedVessel;
    updateVesselHud(updatedVessel);
    const lat = Number(updatedVessel.lat);
    const lon = Number(updatedVessel.lon !== undefined && updatedVessel.lon !== null ? updatedVessel.lon : updatedVessel.lng);
    if (myGlobe && Number.isFinite(lat) && Number.isFinite(lon)) {
      myGlobe.htmlElementsData([{
        ...updatedVessel,
        lat: lat,
        lng: lon
      }]);
    }
  }
}

let isDeselecting = false;

export function closeSelectedVessel(resumeRotation = true) {
  if (isDeselecting) return;
  isDeselecting = true;

  try {
    currentSelectedVessel = null;

    if (myGlobe) {
      // Clear HTML elements (removes 3D marker and popup overlay)
      myGlobe.htmlElementsData([]);
    }

    // Hide HUD card
    const hudDiv = document.getElementById('globe-vessel-hud');
    if (hudDiv) hudDiv.style.display = 'none';

    // Hide Global View button
    const resetBtn = document.getElementById('btn-reset-globe-view');
    if (resetBtn) resetBtn.style.display = 'none';

    if (resumeRotation) {
      if (myGlobe) {
        // Smoothly return to global starting point of view
        myGlobe.pointOfView({ lat: 15, lng: 70, altitude: 1.5 }, 1200);
      }
      setAutoRotate(true);
    }

    // Dispatch deselection event so drawer removes active card highlight
    window.dispatchEvent(new CustomEvent('live-ais-deselected'));
  } finally {
    isDeselecting = false;
  }
}

export const clearSelectedVesselOnGlobe = closeSelectedVessel;

function renderGlobeVesselElement(d) {
  const container = document.createElement('div');
  container.className = 'globe-vessel-marker-container';
  container.style.position = 'relative';
  container.style.pointerEvents = 'auto';

  const mmsiText = d.mmsi != null && String(d.mmsi).trim() !== '' && String(d.mmsi).toLowerCase() !== 'null' && String(d.mmsi).toLowerCase() !== 'undefined'
    ? String(d.mmsi).trim()
    : 'N/A';
  const shipName = d.shipName && String(d.shipName).trim() !== '' && String(d.shipName).toLowerCase() !== 'null' && String(d.shipName).toLowerCase() !== 'undefined'
    ? String(d.shipName).trim()
    : (mmsiText !== 'N/A' ? `VESSEL ${mmsiText}` : 'UNKNOWN VESSEL');
  const sogNum = Number(d.sog);
  const sogText = Number.isFinite(sogNum) ? `${sogNum.toFixed(1)} kn` : 'N/A';
  const cogNum = Number(d.cog);
  const cogText = Number.isFinite(cogNum) ? `${cogNum.toFixed(0)}°` : 'N/A';
  const latNum = Number(d.lat);
  const lonRaw = d.lon !== undefined && d.lon !== null ? d.lon : d.lng;
  const lonNum = Number(lonRaw);
  const posText = Number.isFinite(latNum) && Number.isFinite(lonNum) ? `${latNum.toFixed(4)}°, ${lonNum.toFixed(4)}°` : 'N/A';
  const rotDeg = Number.isFinite(cogNum) ? cogNum : 0;

  // 1. Maritime Ship Symbol (anchored at center)
  const marker = document.createElement('div');
  marker.style.cssText = `
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    position: relative;
    cursor: pointer;
  `;
  marker.innerHTML = `
    <span style="position: absolute; width: 26px; height: 26px; border: 1.5px solid #00e5ff; border-radius: 50%; box-shadow: 0 0 10px #00e5ff; opacity: 0.8;"></span>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#00e5ff" style="transform: rotate(${rotDeg}deg); filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.9));">
      <path d="M12 2 L19 21 L12 17 L5 21 Z" />
    </svg>
  `;

  // 2. Compact Info Overlay next to marker
  const label = document.createElement('div');
  label.style.cssText = `
    position: absolute;
    left: 18px;
    top: -42px;
    min-width: 170px;
    background: rgba(10, 15, 25, 0.95);
    border: 1px solid rgba(0, 229, 255, 0.5);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #f8fafc;
    box-shadow: 0 4px 18px rgba(0,0,0,0.85), 0 0 10px rgba(0, 229, 255, 0.25);
    backdrop-filter: blur(8px);
    pointer-events: auto;
    user-select: none;
    white-space: nowrap;
  `;

  label.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">
      <span style="font-weight: 700; color: #00e5ff; font-family: 'Inter', sans-serif; font-size: 11px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${shipName}</span>
      <button class="btn-dismiss-marker-card" style="background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; padding: 0 2px; line-height: 1;">✕</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <div><span style="color: #94a3b8;">MMSI:</span> <span style="color: #cbd5e1;">${mmsiText}</span></div>
      <div><span style="color: #94a3b8;">SPEED:</span> <span style="color: #00e5ff;">${sogText}</span></div>
      <div><span style="color: #94a3b8;">COURSE:</span> <span style="color: #cbd5e1;">${cogText}</span></div>
      <div><span style="color: #94a3b8;">POS:</span> <span style="color: #cbd5e1;">${posText}</span></div>
    </div>
  `;

  const dismissBtn = label.querySelector('.btn-dismiss-marker-card');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelectedVesselOnGlobe(true);
    });
  }

  container.appendChild(marker);
  container.appendChild(label);
  return container;
}
