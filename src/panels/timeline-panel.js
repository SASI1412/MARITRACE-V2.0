/**
 * Investigation timeline panel — visually connected vertical timeline
 */

export const baseTimelineSteps = [
  { id: 'step-1', title: '1. SAR DETECTION', evidence: 'Oil detected — 35% confidence' },
  { id: 'step-2', title: '2. SPILL ESTIMATION', evidence: 'Area — 12.4 km²' },
  { id: 'step-3', title: '3. BACKWARD DRIFT', evidence: '5 trajectories generated' },
  { id: 'step-4', title: '4. ORIGIN ZONE', evidence: 'Probability zone generated' },
  { id: 'step-5', title: '5. AIS CORRELATION', evidence: '7 candidates evaluated' },
  { id: 'step-6', title: '6. CANDIDATE RANKING', evidence: 'Top candidate ranked' },
  { id: 'step-7', title: '7. FORWARD DRIFT', evidence: 'Verification simulated' },
  { id: 'step-8', title: '8. FINAL EVIDENCE', evidence: 'Investigation complete' },
];

function buildDynamicSteps(globalState, activeStepIndex) {
  const steps = JSON.parse(JSON.stringify(baseTimelineSteps));
  
  if (globalState && globalState.aiSpillState) {
    const ai = globalState.aiSpillState;
    steps[0].evidence = `AI verified — ${Math.round(ai.confidence)}% confidence`;
    steps[1].evidence = `Area — ${ai.areaKm2.toFixed(1)} km²`;
    if (globalState.customBackwardPaths) {
      steps[2].evidence = `${globalState.customBackwardPaths.length} trajectories generated`;
    }
    if (globalState.currentCandidates) {
      steps[4].evidence = `${globalState.currentCandidates.length} candidates evaluated`;
    }
    if (globalState.topCandidate) {
      steps[5].evidence = `Top candidate — ${globalState.topCandidate.name}`;
    }
  }
  return steps;
}

export function renderTimelinePanel(activeStepIndex = -1, globalState = null) {
  let html = '<div class="professional-pipeline" style="display:flex; flex-direction:column; padding-left: 12px; position:relative; margin-bottom: 24px;">';
  
  // Vertical connected line background
  html += '<div style="position:absolute; left:21px; top:16px; bottom:16px; width:2px; background:rgba(255,255,255,0.1); z-index:0;"></div>';

  const steps = buildDynamicSteps(globalState, activeStepIndex);

  steps.forEach((step, idx) => {
    const logicalIdx = idx + 1;
    const isComplete = logicalIdx < activeStepIndex;
    const isActive = logicalIdx === activeStepIndex;
    const isPending = logicalIdx > activeStepIndex;

    let iconHtml = '';
    let titleColor = '#94a3b8'; // default grey
    let evidenceColor = '#64748b'; // default grey
    
    if (isComplete) {
      iconHtml = `<div style="width:20px; height:20px; border-radius:50%; background:var(--color-success); display:flex; align-items:center; justify-content:center; z-index:1; position:relative;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>`;
      titleColor = '#cbd5e1';
      evidenceColor = '#94a3b8';
    } else if (isActive) {
      iconHtml = `<div style="width:20px; height:20px; border-radius:50%; border:2px solid #60a5fa; background:transparent; display:flex; align-items:center; justify-content:center; z-index:1; position:relative;">
        <div style="width:8px; height:8px; background:#60a5fa; border-radius:50%;"></div>
      </div>`;
      titleColor = '#f1f5f9';
      evidenceColor = '#cbd5e1';
    } else {
      iconHtml = `<div style="width:20px; height:20px; border-radius:50%; background:#1e293b; display:flex; align-items:center; justify-content:center; z-index:1; position:relative;">
      </div>`;
    }

    const showEvidence = isComplete || isActive;
    const evidenceHtml = showEvidence ? `<div style="font-size:11px; color:${evidenceColor}; margin-top:2px;">${step.evidence}</div>` : '';

    html += `
      <div class="timeline-card" style="display:flex; align-items:flex-start; position:relative; margin-bottom:12px; z-index:1;">
        ${iconHtml}
        <div style="display:flex; flex-direction:column; margin-left:16px; flex:1;">
          <div style="font-size:12px; font-weight:700; color:${titleColor}; letter-spacing:0.05em;">${step.title}</div>
          ${evidenceHtml}
        </div>
      </div>
    `;
  });

  html += '</div>';

  // Add the CURRENT STAGE and metrics
  if (activeStepIndex > 0) {
    const activeStep = steps[activeStepIndex - 1];
    
    let description = '';
    if (activeStepIndex === 4) description = 'Based on backward drift trajectories, the probable origin region has been calculated.';
    else description = activeStep.evidence;

    const areaVal = globalState?.aiSpillState ? globalState.aiSpillState.areaKm2.toFixed(1) : '12.4';
    const extentW = globalState?.aiSpillState ? globalState.aiSpillState.approxWidthKm.toFixed(1) : '18.6';
    const extentH = globalState?.aiSpillState ? globalState.aiSpillState.approxHeightKm.toFixed(1) : '14.2';
    const confVal = globalState?.aiSpillState ? Math.round(globalState.aiSpillState.confidence) : '85';
    const candidateCount = globalState?.currentCandidates ? globalState.currentCandidates.length : '7';

    html += `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
        <div style="color:#60a5fa; font-size:10px; font-weight:700; letter-spacing:1px; margin-bottom:8px;">CURRENT STAGE</div>
        <div style="font-size:14px; font-weight:700; color:#f8fafc; margin-bottom:8px;">${activeStep.title.replace(/^[0-9]+\.\s*/, '')}</div>
        <div style="font-size:12px; color:#94a3b8; line-height:1.4; margin-bottom:24px;">${description}</div>
        
        <div style="color:#60a5fa; font-size:10px; font-weight:700; letter-spacing:1px; margin-bottom:12px;">KEY METRICS</div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
            <span style="color:#94a3b8;">Spill Area</span>
            <span style="color:#f8fafc; font-family:'JetBrains Mono', monospace;">${areaVal} km²</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
            <span style="color:#94a3b8;">Spill Extent</span>
            <span style="color:#f8fafc; font-family:'JetBrains Mono', monospace;">${extentW} × ${extentH} km</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
            <span style="color:#94a3b8;">Detection Confidence</span>
            <span style="color:#f8fafc; font-family:'JetBrains Mono', monospace;">${confVal}%</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
            <span style="color:#94a3b8;">Origin Confidence</span>
            <span style="color:#ffab00; font-weight:700;">MEDIUM</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94a3b8;">AIS Candidates</span>
            <span style="color:#f8fafc; font-family:'JetBrains Mono', monospace;">${candidateCount}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Continue button
  html += `
    <button id="btn-continue-investigation" style="width:100%; margin-top:24px; padding:12px; background:#1d4ed8; color:white; border:none; border-radius:4px; font-weight:600; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:8px;">
      Continue Investigation →
    </button>
  `;

  return html;
}

export function updateTimelineStep(container, stepIndex, globalState = null) {
  if (!container) return;
  const pipelineEl = container.querySelector('.professional-pipeline');
  if (pipelineEl) {
    pipelineEl.outerHTML = renderTimelinePanel(stepIndex, globalState);
  }
}
