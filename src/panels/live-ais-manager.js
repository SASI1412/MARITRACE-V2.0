/**
 * Live AIS Manager — Manages the persistent global AIS feed, freezes the 20-vessel
 * display snapshot, handles Name/MMSI and Turf.js Location searches, and coordinates
 * vessel selection with the 3D globe.
 */

import { updateLiveAISDashboard, renderLiveAISDashboard } from './live-ais-dashboard.js';
import { updateLiveAISData } from '../map/layers/live-ais-layer.js';
import { updateSelectedVesselOnGlobe, closeSelectedVessel } from '../map/globe-controller.js';
import { getMap } from '../map/map-init.js';

let wsLiveAIS = null;
let dashboardOpen = false;

// Explicit callback registration for module-to-module communication
const aisCallbacks = {
    onVesselSelect: null,
    onVesselDeselect: null
};

// Authoritative State Model
export const globalAISState = {
    allReceivedVessels: new Map(), // Key: MMSI or lat_lon, Value: normalized vessel object
    displayVessels: [],            // Frozen snapshot of up to 20 real vessels
    selectedVessel: null,          // Authoritative selected vessel
    searchMode: 'name',            // 'name' | 'location'
    searchNameQuery: '',
    searchLocation: null,          // { lat, lon, radius }
    isFrozen: false
};

if (typeof window !== 'undefined') {
    window.globalAISState = globalAISState;
}

export function initLiveAIManager(options = {}) {
    // Register caller callbacks if provided
    if (options && typeof options.onVesselSelect === 'function') {
        aisCallbacks.onVesselSelect = options.onVesselSelect;
    }
    if (options && typeof options.onVesselDeselect === 'function') {
        aisCallbacks.onVesselDeselect = options.onVesselDeselect;
    }

    // 1. Setup Toggle Button and Sliding Drawer on the LEFT edge
    const toggleBtn = document.getElementById('btn-live-ais-toggle');
    const panel = document.getElementById('live-ais-panel');
    const content = document.getElementById('live-ais-content');
    
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            dashboardOpen = !dashboardOpen;
            if (dashboardOpen) {
                panel.style.left = '0px';
                toggleBtn.style.left = '360px';
                // Render initial dashboard layout if not already mounted
                if (!content.innerHTML.includes('ais-search-name')) {
                    content.innerHTML = renderLiveAISDashboard();
                    attachSearchListeners(content);
                }
                updateDashboardUI();
            } else {
                panel.style.left = '-360px';
                toggleBtn.style.left = '0px';
            }
        });
    }

    // 2. Handle Vessel Click from Drawer List
    window.addEventListener('live-ais-card-click', (e) => {
        const vessel = e.detail;
        if (!vessel) return;

        // If clicking the currently selected vessel, deselect / close cleanly
        if (globalAISState.selectedVessel && (
            (vessel.mmsi && globalAISState.selectedVessel.mmsi && String(vessel.mmsi) === String(globalAISState.selectedVessel.mmsi)) ||
            (vessel === globalAISState.selectedVessel)
        )) {
            closeSelectedVessel(true);
            return;
        }

        globalAISState.selectedVessel = vessel;
        updateDashboardUI();

        // Report vessel selection via explicit callback dependency
        if (typeof aisCallbacks.onVesselSelect === 'function') {
            try {
                aisCallbacks.onVesselSelect(vessel);
            } catch (err) {
                console.error('[Live AIS] Error in onVesselSelect callback:', err);
            }
        }

        // Also dispatch selection event for any other system listeners
        window.dispatchEvent(new CustomEvent('live-ais-selected', { detail: vessel }));
    });

    // 3. Handle Vessel Deselection
    window.addEventListener('live-ais-deselected', () => {
        if (globalAISState.selectedVessel === null) return;
        globalAISState.selectedVessel = null;
        updateDashboardUI();

        if (typeof aisCallbacks.onVesselDeselect === 'function') {
            try {
                aisCallbacks.onVesselDeselect();
            } catch (err) {
                console.error('[Live AIS] Error in onVesselDeselect callback:', err);
            }
        }
    });

    // 4. Initial HTTP fetch to instantly grab real vessels from backend
    fetchInitialLiveAIS();

    // 5. Connect single persistent global WebSocket connection to backend
    connectWebSocket();
}

// Architecture alias
export const initializeLiveAIS = initLiveAIManager;

async function fetchInitialLiveAIS() {
    try {
        const host = window.location.hostname || 'localhost';
        const res = await fetch(`http://${host}:8000/api/live-ais`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.vessels) && data.vessels.length > 0) {
                data.vessels.forEach(v => {
                    const key = v.mmsi ? String(v.mmsi).trim() : `${v.lat}_${v.lon}`;
                    globalAISState.allReceivedVessels.set(key, v);
                });

                if (!globalAISState.isFrozen || globalAISState.displayVessels.length === 0) {
                    globalAISState.displayVessels = data.vessels.slice(0, 20);
                    globalAISState.isFrozen = true;
                    updateDashboardUI();
                }
            }
        }
    } catch (err) {
        console.warn("[Live AIS] Initial fetch failed, relying on WebSocket stream:", err);
    }
}

function connectWebSocket() {
    if (wsLiveAIS && (wsLiveAIS.readyState === WebSocket.OPEN || wsLiveAIS.readyState === WebSocket.CONNECTING)) {
        return;
    }
    
    const host = window.location.hostname || 'localhost';
    wsLiveAIS = new WebSocket(`ws://${host}:8000/ws/ais`);
    
    wsLiveAIS.onopen = () => {
        console.log("[Live AIS] Connected to backend AISStream feed.");
    };

    wsLiveAIS.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Handle snapshot array from backend
            if (data.type === "snapshot" && Array.isArray(data.vessels)) {
                data.vessels.forEach(v => {
                    if (v && typeof v === 'object') {
                        const key = v.mmsi ? String(v.mmsi).trim() : (v.lat && v.lon ? `${v.lat}_${v.lon}` : null);
                        if (key) {
                            globalAISState.allReceivedVessels.set(key, v);
                        }
                    }
                });

                // If not frozen yet, freeze this snapshot
                if (!globalAISState.isFrozen || globalAISState.displayVessels.length === 0) {
                    globalAISState.displayVessels = data.vessels.slice(0, 20);
                    globalAISState.isFrozen = true;
                    updateDashboardUI();
                }
                return;
            }

            // Handle individual normalized real vessel report
            if (data && typeof data === 'object') {
                const mmsi = data.mmsi ? String(data.mmsi).trim() : null;
                const key = mmsi || (data.lat !== undefined && data.lon !== undefined ? `${data.lat}_${data.lon}` : null);
                if (!key) return;

                const lat = typeof data.lat === 'number' ? data.lat : (data.lat ? parseFloat(data.lat) : null);
                const lon = typeof data.lon === 'number' ? data.lon : (data.lng !== undefined && data.lng !== null ? parseFloat(data.lng) : null);
                const sog = typeof data.sog === 'number' ? data.sog : (data.sog ? parseFloat(data.sog) : null);
                const cog = typeof data.cog === 'number' ? data.cog : (data.cog ? parseFloat(data.cog) : null);

                const normalized = {
                    mmsi: mmsi,
                    shipName: data.shipName ? String(data.shipName).trim() : (mmsi ? `VESSEL ${mmsi}` : 'UNKNOWN VESSEL'),
                    lat: lat,
                    lon: lon,
                    lng: lon,
                    sog: sog,
                    cog: cog,
                    timestamp: data.timestamp ? String(data.timestamp) : new Date().toISOString(),
                    source: "AISSTREAM_LIVE"
                };

                // 1. Always update background collection
                globalAISState.allReceivedVessels.set(key, normalized);
                if (globalAISState.allReceivedVessels.size > 500) {
                    const firstKey = globalAISState.allReceivedVessels.keys().next().value;
                    globalAISState.allReceivedVessels.delete(firstKey);
                }

                // 2. Initial freeze check if fewer than 20 vessels were loaded
                if (!globalAISState.isFrozen && globalAISState.displayVessels.length < 20) {
                    const exists = globalAISState.displayVessels.some(v => v.mmsi && normalized.mmsi && String(v.mmsi) === String(normalized.mmsi));
                    if (!exists) {
                        globalAISState.displayVessels.push(normalized);
                        if (globalAISState.displayVessels.length >= 20) {
                            globalAISState.isFrozen = true;
                        }
                        updateDashboardUI();
                    }
                    return;
                }

                // 3. IMPORTANT AIS UPDATE RULE (Requirement 19):
                // If this incoming message is for a vessel ALREADY in displayVessels,
                // update its parameters in-place, but NEVER replace the vessel or change membership!
                const existingIdx = globalAISState.displayVessels.findIndex(v =>
                    (v.mmsi && normalized.mmsi && String(v.mmsi) === String(normalized.mmsi)) ||
                    (!v.mmsi && !normalized.mmsi && Math.abs(v.lat - normalized.lat) < 0.0001 && Math.abs(v.lon - normalized.lon) < 0.0001)
                );

                if (existingIdx !== -1) {
                    globalAISState.displayVessels[existingIdx] = {
                        ...globalAISState.displayVessels[existingIdx],
                        lat: normalized.lat,
                        lon: normalized.lon,
                        lng: normalized.lon,
                        sog: normalized.sog,
                        cog: normalized.cog,
                        timestamp: normalized.timestamp
                    };

                    // If currently selected on globe, update HUD/marker live as well
                    if (globalAISState.selectedVessel &&
                        globalAISState.selectedVessel.mmsi &&
                        String(globalAISState.selectedVessel.mmsi) === String(normalized.mmsi)) {
                        globalAISState.selectedVessel = globalAISState.displayVessels[existingIdx];
                        updateSelectedVesselOnGlobe(globalAISState.selectedVessel);
                    }

                    updateDashboardUI();
                }

                // Also update MapLibre layer if active
                const map = getMap();
                if (map && map.getSource('live-ais-source')) {
                    updateLiveAISData(map, globalAISState.allReceivedVessels);
                }
            }
        } catch (err) {
            console.error("[Live AIS] Error parsing WebSocket message:", err);
        }
    };
    
    wsLiveAIS.onclose = () => {
        console.warn("[Live AIS] Backend WebSocket disconnected. Reconnecting in 5s...");
        setTimeout(connectWebSocket, 5000);
    };

    wsLiveAIS.onerror = () => {
        // Handled by onclose
    };
}

export function refreshDisplayVessels() {
    const all = Array.from(globalAISState.allReceivedVessels.values());
    if (all.length > 0) {
        globalAISState.displayVessels = sampleRandomRealVessels(all, 20);
        globalAISState.isFrozen = true;
        updateDashboardUI();
    } else if (wsLiveAIS && wsLiveAIS.readyState === WebSocket.OPEN) {
        wsLiveAIS.send(JSON.stringify({ action: 'refresh' }));
    }
}

function sampleRandomRealVessels(vesselsList, maxCount = 20) {
    if (vesselsList.length <= maxCount) {
        return [...vesselsList];
    }
    const shuffled = [...vesselsList];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, maxCount);
}

function getFilteredVessels() {
    const dataset = globalAISState.displayVessels;

    if (globalAISState.searchMode === 'name') {
        const query = (globalAISState.searchNameQuery || '').toLowerCase().trim();
        if (!query) return dataset;

        return dataset.filter(ship => {
            const mmsiText = ship.mmsi == null ? "" : String(ship.mmsi).trim();
            const nameText = ship.shipName == null ? "" : String(ship.shipName).trim();
            return nameText.toLowerCase().includes(query) || mmsiText.includes(query);
        });
    }

    if (globalAISState.searchMode === 'location') {
        const loc = globalAISState.searchLocation;
        if (!loc || !window.turf) return dataset;

        const centerPt = window.turf.point([loc.lon, loc.lat]);
        return dataset.filter(ship => {
            const vLat = ship.lat;
            const vLon = ship.lon !== undefined && ship.lon !== null ? ship.lon : ship.lng;
            if (vLat == null || vLon == null || isNaN(vLat) || isNaN(vLon)) return false;

            try {
                const vPt = window.turf.point([vLon, vLat]);
                const distKm = window.turf.distance(centerPt, vPt, { units: 'kilometers' });
                return distKm <= loc.radius;
            } catch {
                return false;
            }
        });
    }

    return dataset;
}

export function updateDashboardUI() {
    const content = document.getElementById('live-ais-content');
    if (!content || !dashboardOpen) return;

    const filtered = getFilteredVessels();
    const isLocation = globalAISState.searchMode === 'location' && globalAISState.searchLocation !== null;
    const rad = isLocation ? globalAISState.searchLocation.radius : null;

    updateLiveAISDashboard(
        content,
        filtered,
        globalAISState.displayVessels.length,
        isLocation,
        rad,
        globalAISState.selectedVessel
    );
}

export function attachSearchListeners(container) {
    // Tabs
    const tabName = container.querySelector('#tab-search-name');
    const tabLoc = container.querySelector('#tab-search-loc');
    const paneName = container.querySelector('#pane-search-name');
    const paneLoc = container.querySelector('#pane-search-loc');

    // Controls
    const searchNameInput = container.querySelector('#ais-search-name');
    const clearNameBtn = container.querySelector('#btn-clear-name');

    const searchLatInput = container.querySelector('#ais-search-lat');
    const searchLonInput = container.querySelector('#ais-search-lon');
    const searchRadInput = container.querySelector('#ais-search-rad');
    const searchLocBtn = container.querySelector('#btn-search-loc');
    const clearLocBtn = container.querySelector('#btn-clear-loc');

    const refreshBtn = container.querySelector('#btn-refresh-vessels');

    // Refresh Action
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshDisplayVessels();
        });
    }

    // Switch Tabs
    if (tabName && tabLoc) {
        tabName.addEventListener('click', () => {
            globalAISState.searchMode = 'name';
            tabName.classList.add('active');
            tabName.style.background = 'rgba(0, 229, 255, 0.15)';
            tabName.style.borderColor = 'rgba(0, 229, 255, 0.4)';
            tabName.style.color = 'white';

            tabLoc.classList.remove('active');
            tabLoc.style.background = 'transparent';
            tabLoc.style.borderColor = 'rgba(255,255,255,0.12)';
            tabLoc.style.color = 'var(--text-secondary)';

            paneName.style.display = 'block';
            paneLoc.style.display = 'none';

            if (searchNameInput) {
                globalAISState.searchNameQuery = searchNameInput.value;
            }
            updateDashboardUI();
        });

        tabLoc.addEventListener('click', () => {
            globalAISState.searchMode = 'location';
            tabLoc.classList.add('active');
            tabLoc.style.background = 'rgba(0, 229, 255, 0.15)';
            tabLoc.style.borderColor = 'rgba(0, 229, 255, 0.4)';
            tabLoc.style.color = 'white';

            tabName.classList.remove('active');
            tabName.style.background = 'transparent';
            tabName.style.borderColor = 'rgba(255,255,255,0.12)';
            tabName.style.color = 'var(--text-secondary)';

            paneLoc.style.display = 'block';
            paneName.style.display = 'none';

            updateDashboardUI();
        });
    }

    // Name/MMSI Live Typing Search
    if (searchNameInput) {
        searchNameInput.addEventListener('input', (e) => {
            globalAISState.searchNameQuery = e.target.value;
            updateDashboardUI();
        });
    }

    // Name Clear Button
    if (clearNameBtn) {
        clearNameBtn.addEventListener('click', () => {
            if (searchNameInput) searchNameInput.value = '';
            globalAISState.searchNameQuery = '';
            updateDashboardUI();
        });
    }

    // Location Search Button
    if (searchLocBtn && searchLatInput && searchLonInput && searchRadInput) {
        searchLocBtn.addEventListener('click', () => {
            const lat = parseFloat(searchLatInput.value);
            const lon = parseFloat(searchLonInput.value);
            const rad = parseFloat(searchRadInput.value);

            if (!isNaN(lat) && lat >= -90 && lat <= 90 &&
                !isNaN(lon) && lon >= -180 && lon <= 180 &&
                !isNaN(rad) && rad > 0) {
                globalAISState.searchLocation = { lat, lon, radius: rad };
                updateDashboardUI();
            } else {
                alert("Please enter valid coordinates (-90 to 90 lat, -180 to 180 lon) and radius > 0.");
            }
        });
    }

    // Location Clear Button
    if (clearLocBtn) {
        clearLocBtn.addEventListener('click', () => {
            if (searchLatInput) searchLatInput.value = '';
            if (searchLonInput) searchLonInput.value = '';
            if (searchRadInput) searchRadInput.value = '';
            globalAISState.searchLocation = null;
            updateDashboardUI();
        });
    }
}
