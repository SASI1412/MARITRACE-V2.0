/**
 * Investigation summary / report panel
 * Accepts optional dynamic data. Falls back to case001 when not provided.
 */
import { case001 } from '../data/case001.ts';
import { getConfidenceColor, getScoreColor } from '../utils/format-utils.js';

/**
 * @param {Object} [opts] - Optional dynamic overrides for AI Investigation mode.
 * @param {Array}  [opts.candidates] - Dynamic ranked candidates.
 * @param {Object} [opts.spillState] - { areaKm2, confidence, centroid, ... }
 * @param {number} [opts.forwardDriftCompatibility] - 0–100 forward drift overlap.
 */
export function renderSummaryPanel(opts) {
  const candidates = opts?.candidates;
  const spillState = opts?.spillState;
  const forwardDriftCompat = opts?.forwardDriftCompatibility;

  const vessels = candidates
    ? [...candidates].sort((a, b) => b.scores.overall - a.scores.overall)
    : [...case001.vessels].sort((a, b) => b.scores.overall - a.scores.overall);
  const topVessel = vessels[0];
  const color = getConfidenceColor(topVessel.confidence);

  const caseId = candidates ? 'AI INVESTIGATION' : case001.id;
  const spillExtent = spillState ? spillState.approxWidthKm?.toFixed(1) + ' × ' + spillState.approxHeightKm?.toFixed(1) + ' km' : case001.spill.areaKm2 + ' km²';
  const detectionConf = spillState ? Math.round(Number(spillState.confidence || 0)) + '%' : case001.spill.detectionConfidence + '%';
  const originConf = topVessel.confidence;

  // Build evidence icons dynamically from actual scores
  const evidenceDims = [
    { key: 'spatial', label: 'Spatial' },
    { key: 'temporal', label: 'Temporal' },
    { key: 'trajectory', label: 'Trajectory' },
    { key: 'drift', label: 'Drift' },
    { key: 'aisQuality', label: 'AIS' }
  ];

  let evidenceHtml = '';
  evidenceDims.forEach(dim => {
    const s = topVessel.scores[dim.key];
    const icon = s >= 60 ? '✓' : s >= 30 ? '~' : '✗';
    const iconColor = s >= 60 ? 'var(--color-success)' : s >= 30 ? 'var(--color-warning)' : '#ff5252';
    evidenceHtml += `<span>${dim.label} <span style="color:${iconColor}">${icon}</span></span>\n`;
  });

  // Forward drift compatibility row
  let forwardDriftHtml = '';
  if (forwardDriftCompat != null) {
    const fdColor = getScoreColor(forwardDriftCompat);
    forwardDriftHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-top:1px solid rgba(255,255,255,0.05); margin-top:8px;">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Forward Drift Compatibility</div>
        <div style="font-size:16px; font-weight:900; color:${fdColor}; font-family:var(--font-mono);">${forwardDriftCompat}%</div>
      </div>
    `;
  }

  const spillArea = spillState ? spillState.areaKm2?.toFixed(1) + ' km²' : case001.spill.areaKm2 + ' km²';

  // Compact Evidence Chain
  const chainSteps = [
    { label: 'SAR Detection', desc: detectionConf + ' Conf.', active: true },
    { label: 'Spill Geometry', desc: spillArea, active: true },
    { label: 'Origin Zone', desc: 'Synthesized', active: true },
    { label: 'AIS Correlation', desc: vessels.length + ' candidates', active: true },
    { label: 'Candidate Rank', desc: 'Rank #1', active: true },
    { label: 'Drift Verification', desc: forwardDriftCompat ? forwardDriftCompat + '%' : 'N/A', active: forwardDriftCompat != null }
  ];

  let chainHtml = '<div style="display:flex; flex-direction:column; gap:0; position:relative; padding-left:12px; margin-top:16px;">';
  chainHtml += '<div style="position:absolute; left:16px; top:8px; bottom:8px; width:1px; background:rgba(255,255,255,0.1);"></div>';
  
  chainSteps.forEach((step, i) => {
    const dotColor = step.active ? 'var(--color-success)' : 'rgba(255,255,255,0.2)';
    chainHtml += `
      <div style="display:flex; align-items:center; margin-bottom:8px; position:relative; z-index:1;">
        <div style="width:9px; height:9px; border-radius:50%; background:${dotColor}; box-shadow:0 0 5px ${dotColor};"></div>
        <div style="margin-left:16px; display:flex; justify-content:space-between; width:100%; align-items:center;">
          <div style="font-size:11px; font-weight:700; color:#fff; letter-spacing:0.05em; text-transform:uppercase;">${step.label}</div>
          <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted);">${step.desc}</div>
        </div>
      </div>
    `;
  });
  chainHtml += '</div>';

  return `
    <div class="card anim-fade-in" style="animation-delay:0ms; border: 1px solid var(--color-success); background: rgba(35,134,54,0.1); padding: 24px; position: relative;">
      
      <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 24px; text-transform: uppercase; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
        Final Summary
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom: 24px;">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">CASE</div>
          <div style="font-size: 14px; font-weight: 600; color: #fff; font-family:var(--font-mono);">${caseId}</div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Spill extent</div>
          <div style="font-size: 14px; font-weight: 600; color: #fff; font-family:var(--font-mono);">${spillExtent}</div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Detection confidence</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--color-success); font-family:var(--font-mono);">${detectionConf}</div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Origin confidence</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--color-warning); font-family:var(--font-mono);">${originConf}</div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Candidates</div>
          <div style="font-size: 14px; font-weight: 600; color: #fff; font-family:var(--font-mono);">${vessels.length}</div>
        </div>
      </div>
      
      <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 16px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Top candidate</div>
        <div style="font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 12px; letter-spacing: 0.05em;">
          ${topVessel.name.toUpperCase()}
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom: 12px;">
          <div>
            <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Attribution Compatibility</div>
            <div style="font-size: 24px; font-weight: 900; color: ${color}; font-family:var(--font-mono);">
              ${topVessel.scores.overall} <span style="font-size: 14px; color:rgba(255,255,255,0.4);">/ 100</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Confidence</div>
            <div class="badge" style="font-size: 12px; padding: 4px 8px; background: ${color}30; color: ${color}; border: 1px solid ${color};">
              ${topVessel.confidence}
            </div>
          </div>
        </div>
        
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Attribution Dimensions</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:12px; color:#fff; font-family:var(--font-mono);">
          ${evidenceHtml}
        </div>

        ${forwardDriftHtml}
        
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 16px; margin-bottom: 4px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">Evidence Chain</div>
        ${chainHtml}
      </div>
      
      <div style="font-size: 11px; color: var(--color-warning); font-style: italic; background: rgba(255,171,0,0.1); padding: 12px; border-radius: 4px; border-left: 3px solid var(--color-warning); margin-bottom: 24px; line-height: 1.5;">
        Disclaimer: MARITRACE provides an evidence-based compatibility ranking, not a legal determination of responsibility.
      </div>
      
      <div style="display:flex; justify-content:center;">
        <button class="btn btn-primary" id="btn-replay-summary" style="width: 100%; padding: 12px; justify-content: center;">
          REPLAY INVESTIGATION
        </button>
      </div>
    </div>
  `;
}
