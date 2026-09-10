/**
 * Live AIS Dashboard — Renders the Left Drawer UI, Search Controls, and
 * Vessel Cards with selection state and robust empty states.
 */

export function renderLiveAISDashboard() {
  return `
    <div class="panel-container anim-fade-in" style="height: 100%; display: flex; flex-direction: column;">
      <div class="card-title" style="letter-spacing: 1.5px;">LIVE SHIP TRACKING</div>
      <div class="card-subtitle" style="margin-bottom: 12px; color: var(--primary-main); font-weight: 700; letter-spacing: 1px;">LIVE AIS FEED</div>
      
      <!-- Connection Status & Refresh Controls -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px 12px; background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 6px;">
        <div>
          <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Global AIS Stream</div>
          <div id="ais-connection-status" style="font-size: 13px; font-weight: bold; color: var(--primary-main); display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 7px; height: 7px; background: var(--primary-main); border-radius: 50%; box-shadow: 0 0 6px var(--primary-main);"></span>LIVE FEED
          </div>
        </div>
        <button id="btn-refresh-vessels" style="background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.35); border-radius: 4px; color: var(--primary-main); font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s; letter-spacing: 0.5px;">
          <span>↻</span> REFRESH VESSELS
        </button>
      </div>
      
      <!-- Forensic Notice -->
      <div style="font-size: 11px; color: #ffab00; border-left: 2px solid #ffab00; padding-left: 8px; margin-bottom: 12px; line-height: 1.4;">
        ⚠ GLOBAL LIVE AIS HOOK DATASET. INDEPENDENT OF SAR INVESTIGATION AREA.
      </div>
      
      <!-- Search Mode Tabs -->
      <div style="margin-bottom: 12px;">
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <button id="tab-search-name" class="search-mode-tab active" style="flex: 1; padding: 6px 8px; font-size: 11px; cursor: pointer; background: rgba(0, 229, 255, 0.15); border: 1px solid rgba(0, 229, 255, 0.4); color: white; border-radius: 4px; font-weight: 700; letter-spacing: 0.5px;">
            [ NAME / MMSI ]
          </button>
          <button id="tab-search-loc" class="search-mode-tab" style="flex: 1; padding: 6px 8px; font-size: 11px; cursor: pointer; background: transparent; border: 1px solid rgba(255,255,255,0.12); color: var(--text-secondary); border-radius: 4px; font-weight: 700; letter-spacing: 0.5px;">
            [ LOCATION ]
          </button>
        </div>
        
        <!-- Mode 1: Search Name / MMSI -->
        <div id="pane-search-name" style="display: block;">
          <div style="display: flex; gap: 6px;">
            <input type="text" id="ais-search-name" placeholder="Filter Name or MMSI..." autocomplete="off" style="flex: 1; padding: 7px 10px; font-size: 11px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; font-family: 'Inter', sans-serif;">
            <button id="btn-clear-name" style="padding: 7px 12px; font-size: 11px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; font-weight: 600; border-radius: 4px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">CLEAR</button>
          </div>
        </div>
        
        <!-- Mode 2: Search Location -->
        <div id="pane-search-loc" style="display: none;">
          <div style="display: flex; gap: 6px; margin-bottom: 6px;">
            <input type="number" step="any" id="ais-search-lat" placeholder="Latitude (-90 to 90)" style="flex: 1; padding: 6px 8px; font-size: 11px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; font-family: 'JetBrains Mono', monospace;">
            <input type="number" step="any" id="ais-search-lon" placeholder="Longitude (-180 to 180)" style="flex: 1; padding: 6px 8px; font-size: 11px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; font-family: 'JetBrains Mono', monospace;">
          </div>
          <div style="display: flex; gap: 6px;">
            <input type="number" step="any" min="1" id="ais-search-rad" placeholder="Radius (km) e.g. 500" style="flex: 1; padding: 6px 8px; font-size: 11px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; font-family: 'JetBrains Mono', monospace;">
            <button id="btn-search-loc" style="padding: 6px 12px; font-size: 11px; background: var(--primary-main); border: none; color: black; font-weight: bold; border-radius: 4px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">SEARCH</button>
            <button id="btn-clear-loc" style="padding: 6px 12px; font-size: 11px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; font-weight: 600; border-radius: 4px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">CLEAR</button>
          </div>
        </div>
      </div>

      <!-- Counter readout -->
      <div id="ais-count-banner" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 11px; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace;">
        <span id="ais-showing-count">Showing 0 of 0 vessels</span>
        <span style="color: #64748b; font-size: 10px;">CLICK SHIP TO FOCUS</span>
      </div>
      
      <!-- Scrollable Vessel List -->
      <div id="ais-vessel-container" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 2px;">
        <div id="ais-vessel-list" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Injected dynamically -->
        </div>
      </div>
    </div>
  `;
}

export function updateLiveAISDashboard(container, vessels, totalCount = 20, isLocationSearch = false, radiusKm = null, selectedVessel = null) {
  if (!container) return;
  const countEl = container.querySelector('#ais-showing-count');
  const listEl = container.querySelector('#ais-vessel-list');
  const statusEl = container.querySelector('#ais-connection-status');
  
  if (!countEl || !listEl) return;

  if (statusEl) {
    statusEl.innerHTML = '<span style="display: inline-block; width: 7px; height: 7px; background: var(--primary-main); border-radius: 50%; box-shadow: 0 0 6px var(--primary-main);"></span>LIVE FEED';
    statusEl.style.color = 'var(--primary-main)';
  }

  const validVessels = Array.isArray(vessels) ? vessels : [];
  const currentCount = validVessels.length;

  if (isLocationSearch && radiusKm !== null) {
    countEl.textContent = `${currentCount} vessels within ${radiusKm} km`;
  } else {
    countEl.textContent = `Showing ${currentCount} of ${totalCount} vessels`;
  }

  // Handle empty state
  if (currentCount === 0) {
    const emptyMsg = isLocationSearch
      ? "No live vessels found in this radius."
      : "No matching vessels found.";
    listEl.innerHTML = `
      <div style="padding: 36px 16px; text-align: center; color: var(--text-muted); font-size: 12px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 6px;">
        ${emptyMsg}
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  validVessels.forEach(vessel => {
    const card = document.createElement('div');
    card.className = 'ais-vessel-card';

    // Safe MMSI normalization: never undefined.toString()
    const mmsiText = vessel.mmsi != null && String(vessel.mmsi).trim() !== '' && String(vessel.mmsi).toLowerCase() !== 'null'
      ? String(vessel.mmsi).trim()
      : 'N/A';

    const isSelected = selectedVessel && (
      (vessel.mmsi && selectedVessel.mmsi && String(vessel.mmsi) === String(selectedVessel.mmsi)) ||
      (vessel === selectedVessel)
    );

    const cardBorder = isSelected ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.08)';
    const cardBg = isSelected ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)';
    const cardShadow = isSelected ? '0 0 12px rgba(0, 229, 255, 0.25)' : 'none';

    card.style.cssText = `
      background: ${cardBg};
      border: ${cardBorder};
      border-radius: 6px;
      padding: 10px 12px;
      cursor: pointer;
      box-shadow: ${cardShadow};
      transition: all 0.2s ease;
    `;

    const shipName = vessel.shipName ? String(vessel.shipName).trim() : (mmsiText !== 'N/A' ? `VESSEL ${mmsiText}` : 'UNKNOWN VESSEL');
    const latText = typeof vessel.lat === 'number' && !isNaN(vessel.lat) ? vessel.lat.toFixed(4) + '°' : 'N/A';
    const lon = vessel.lon !== undefined && vessel.lon !== null ? vessel.lon : vessel.lng;
    const lonText = typeof lon === 'number' && !isNaN(lon) ? lon.toFixed(4) + '°' : 'N/A';
    const sogText = typeof vessel.sog === 'number' && !isNaN(vessel.sog) ? `${vessel.sog.toFixed(1)} kn` : 'N/A';
    const cogText = typeof vessel.cog === 'number' && !isNaN(vessel.cog) ? `${vessel.cog.toFixed(0)}°` : 'N/A';

    let timeText = 'LIVE';
    if (vessel.timestamp) {
      try {
        const d = new Date(vessel.timestamp);
        if (!isNaN(d.getTime())) {
          timeText = d.toISOString().substring(11, 19) + ' UTC';
        }
      } catch {
        timeText = 'LIVE';
      }
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="font-weight: 700; color: ${isSelected ? '#00e5ff' : '#f8fafc'}; font-size: 13px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 215px;" title="${shipName} (MMSI: ${mmsiText})">${shipName}</div>
        <span style="font-size: 9px; padding: 2px 6px; border-radius: 3px; background: rgba(0, 229, 255, 0.15); color: #00e5ff; border: 1px solid rgba(0, 229, 255, 0.35); font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">LIVE AIS</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; font-size: 11px; font-family: 'JetBrains Mono', monospace;">
        <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">MMSI:</span> <span style="color: #cbd5e1;">${mmsiText}</span></div>
        <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">Speed:</span> <span style="color: #00e5ff;">${sogText}</span></div>
        <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">Lat:</span> <span style="color: #cbd5e1;">${latText}</span></div>
        <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">Course:</span> <span style="color: #cbd5e1;">${cogText}</span></div>
        <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">Lon:</span> <span style="color: #cbd5e1;">${lonText}</span></div>
        <div><span style="color: #94a3b8; font-family: 'Inter', sans-serif;">Time:</span> <span style="color: #94a3b8; font-size: 10px;">${timeText}</span></div>
      </div>
    `;

    card.addEventListener('mouseenter', () => {
      if (!isSelected) {
        card.style.background = 'rgba(0, 229, 255, 0.08)';
        card.style.borderColor = 'rgba(0, 229, 255, 0.35)';
      }
    });

    card.addEventListener('mouseleave', () => {
      if (!isSelected) {
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      }
    });

    card.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('live-ais-card-click', { detail: vessel }));
    });

    listEl.appendChild(card);
  });
}
