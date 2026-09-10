export function renderDriftVerificationPanel(vesselName: string, forwardDriftCompatibility?: number | null): string {
  const driftScore = forwardDriftCompatibility != null ? forwardDriftCompatibility : 94;
  const driftLabel = forwardDriftCompatibility != null ? 'FORWARD DRIFT COMPATIBILITY' : 'DRIFT AGREEMENT';
  const labelNote = forwardDriftCompatibility != null ? 'Synthetic Forward Drift' : '';

  return `
    <div class="card anim-fade-in">
      <div class="card-header">
        <div>
          <div class="card-title">🔀 Drift Analysis View</div>
          <div class="card-subtitle">Source Vessel: ${vesselName}</div>
        </div>
        <span class="badge badge-info">Step 7</span>
      </div>

      <div style="text-align:center; padding:16px 0; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:16px;">
        <div style="font-size:12px; font-weight:700; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px;">
          OBSERVED SLICK vs SIMULATED SLICK
        </div>
        <div style="font-size:32px; font-weight:900; color:var(--accent-cyan); font-family:var(--font-mono);">
          ${driftScore} <span style="font-size:16px; color:rgba(255,255,255,0.4);">/ 100</span>
        </div>
        <div style="font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; margin-top:4px;">
          ${driftLabel}
        </div>
        ${labelNote ? `<div style="font-size:9px; color:var(--text-muted); margin-top:4px; font-style:italic;">${labelNote}</div>` : ''}
      </div>

      <div style="font-size:13px; color:var(--text-secondary); font-style:italic; border-left:3px solid var(--accent-cyan); padding-left:12px; margin-bottom:24px; line-height:1.5;">
        "Forward drift verification tests whether the candidate vessel's trajectory can plausibly reproduce the observed slick pattern."
      </div>

      <div style="display:flex; justify-content:space-between; gap:8px;">
        <button class="btn btn-primary" id="btn-drift-play" style="flex:1;">
          ▶ PLAY
        </button>
        <button class="btn btn-ghost" id="btn-drift-pause" style="flex:1;">
          ⏸ PAUSE
        </button>
        <button class="btn btn-ghost" id="btn-drift-reset" style="flex:1;">
          ↺ RESET
        </button>
      </div>
    </div>
  `;
}

export function initDriftVerificationListeners(
  container: HTMLElement, 
  onPlay: () => void, 
  onPause: () => void, 
  onReset: () => void
) {
  const btnPlay = container.querySelector('#btn-drift-play');
  const btnPause = container.querySelector('#btn-drift-pause');
  const btnReset = container.querySelector('#btn-drift-reset');

  if (btnPlay) btnPlay.addEventListener('click', onPlay);
  if (btnPause) btnPause.addEventListener('click', onPause);
  if (btnReset) btnReset.addEventListener('click', onReset);
}
