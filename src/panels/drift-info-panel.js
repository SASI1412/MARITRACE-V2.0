/**
 * Drift info panel — backward drift reconstruction details
 */
import { case001 } from '../data/case001.ts';
import { formatTimestamp } from '../utils/format-utils.js';
import { formatCoord } from '../utils/geo-utils.js';

export function renderDriftInfoPanel() {
  const origin = case001.origin;

  return `
    <div class="card anim-fade-in" style="animation-delay:0ms">
      <div class="card-header">
        <div>
          <div class="card-title">🔄 Backward Drift Reconstruction</div>
          <div class="card-subtitle">Lagrangian particle backtracking</div>
        </div>
        <span class="badge badge-info">Step 2–3</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Est. Window Start</span>
          <span class="info-value">${formatTimestamp(origin.estimatedWindow.start)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Est. Window End</span>
          <span class="info-value">${formatTimestamp(origin.estimatedWindow.end)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Origin Center</span>
          <span class="info-value" style="font-size:10px">${formatCoord(origin.center.lat, origin.center.lng)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Zone Area</span>
          <span class="info-value">${origin.zoneDimensions.widthKm}km × ${origin.zoneDimensions.heightKm}km</span>
        </div>
        <div class="info-item">
          <span class="info-label">Confidence</span>
          <span class="info-value">${origin.confidence}</span>
        </div>
      </div>
    </div>
  `;
}
