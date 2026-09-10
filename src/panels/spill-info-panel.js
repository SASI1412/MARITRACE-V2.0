/**
 * Spill info panel — displays detected spill details
 */
import { case001 } from '../data/case001.ts';
import { formatTimestamp, formatArea } from '../utils/format-utils.js';
import { formatCoord } from '../utils/geo-utils.js';
import { globalState } from '../engine/investigation-workflow.js';

export function renderSpillInfoPanel(aiSpillState = null) {
  const spill = case001.spill;
  const gemini = globalState?.geminiResult;
  
  if (aiSpillState) {
    const rawConf = gemini?.confidence !== undefined ? gemini.confidence : (aiSpillState.confidence || 0);
    const conf = Math.round(Number(rawConf));
    const classification = gemini?.classification || 'OIL_SPILL';
    const oilIndicators = gemini?.oil_indicators || [];
    const lookAlikeIndicators = gemini?.look_alike_indicators || [];
    const altExplanation = gemini?.alternative_explanation || '';

    return `
      <div style="margin-bottom: 12px; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #00e5ff;">
        CASE MODE • AI INVESTIGATION
      </div>
      <div class="card anim-fade-in" style="animation-delay:0ms; border: 1px solid #00e5ff33;">
        <div class="card-header">
          <div>
            <div class="card-title">AI SAR VALIDATION</div>
            <div class="card-subtitle">Source: User-provided Sentinel-1 SAR</div>
          </div>
          <span class="badge" style="background: rgba(0, 229, 255, 0.2); color: #00e5ff; border: 1px solid rgba(0, 229, 255, 0.4);">
            INVESTIGATION ELIGIBLE (&gt;70%)
          </span>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">AI Classification</span>
            <span class="info-value" style="color: #60a5fa; font-weight: 700;">AI SAR Analysis</span>
          </div>
          <div class="info-item">
            <span class="info-label">SAR Assessment</span>
            <span class="info-value" style="color: #00e5ff; font-weight: 700;">${classification.replace('_', ' ')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Classification Confidence</span>
            <span class="info-value" style="color: #00e5ff; font-weight: 800; font-family: 'JetBrains Mono', monospace;">${conf}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">Investigation Status</span>
            <span class="info-value" style="color: #34d399; font-size: 11px; font-weight: 700;">INVESTIGATION ELIGIBLE (&gt;70%)</span>
          </div>
        </div>

        ${gemini?.reasoning ? `
          <div style="margin-top: 12px; padding: 10px; background: rgba(0, 0, 0, 0.25); border-radius: 4px; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
            <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 4px;">Forensic Reasoning:</strong>
            ${gemini.reasoning}
          </div>
        ` : ''}

        ${altExplanation ? `
          <div style="margin-top: 8px; padding: 8px 10px; background: rgba(255, 171, 0, 0.08); border-left: 2px solid #ffab00; border-radius: 2px; font-size: 11px; color: #ffab00;">
            <strong>Alternative Explanation:</strong> ${altExplanation}
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
          <div>
            <div style="font-size: 10px; font-weight: 700; color: #00e5ff; text-transform: uppercase; margin-bottom: 4px;">Oil Indicators</div>
            <ul style="margin: 0; padding-left: 14px; font-size: 11px; color: #94a3b8; line-height: 1.4;">
              ${oilIndicators.length > 0 
                ? oilIndicators.map(i => `<li>${i}</li>`).join('') 
                : '<li style="list-style:none; margin-left:-14px; color:#64748b;">None listed</li>'}
            </ul>
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 700; color: #ffab00; text-transform: uppercase; margin-bottom: 4px;">Look-Alike Indicators</div>
            <ul style="margin: 0; padding-left: 14px; font-size: 11px; color: #94a3b8; line-height: 1.4;">
              ${lookAlikeIndicators.length > 0 
                ? lookAlikeIndicators.map(i => `<li>${i}</li>`).join('') 
                : '<li style="list-style:none; margin-left:-14px; color:#64748b;">None observed</li>'}
            </ul>
          </div>
        </div>
      </div>

      <div class="card anim-fade-in" style="animation-delay:80ms; border: 1px solid #00e5ff33;">
        <div class="card-header">
          <div>
            <div class="card-title">🛢️ Spill Characteristics</div>
            <div class="card-subtitle">AI-derived geographic metrics</div>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Centroid</span>
            <span class="info-value" style="font-size:10px">${formatCoord(aiSpillState.centroid.lat, aiSpillState.centroid.lng)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Estimated Extent</span>
            <span class="info-value">${aiSpillState.approxWidthKm.toFixed(1)} km × ${aiSpillState.approxHeightKm.toFixed(1)} km</span>
          </div>
          <div class="info-item">
            <span class="info-label">Estimated Area</span>
            <span class="info-value" style="color: #00e5ff">${formatArea(aiSpillState.areaKm2)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Curated demo fallback
  return `
    <div style="margin-bottom: 12px; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #ff9800;">
      CASE MODE • CURATED DEMO
    </div>
    <div class="card anim-fade-in" style="animation-delay:0ms">
      <div class="card-header">
        <div>
          <div class="card-title">🛰️ Satellite Detection</div>
          <div class="card-subtitle">Sentinel-1 SAR Anomaly</div>
        </div>
        <span class="badge badge-info">Step 1</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Detected</span>
          <span class="info-value">${formatTimestamp(spill.detectionTimestamp)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Confidence</span>
          <span class="info-value" style="color:var(--color-success)">${spill.detectionConfidence}%</span>
        </div>
        <div class="info-item">
          <span class="info-label">Location</span>
          <span class="info-value" style="font-size:10px">${spill.location}</span>
        </div>
      </div>
    </div>

    <div class="card anim-fade-in" style="animation-delay:80ms">
      <div class="card-header">
        <div>
          <div class="card-title">🛢️ Spill Characteristics</div>
          <div class="card-subtitle">Observed slick parameters</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Area</span>
          <span class="info-value">${formatArea(spill.areaKm2)}</span>
        </div>
      </div>
    </div>
  `;
}
