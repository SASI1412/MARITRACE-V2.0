/**
 * Data formatting utilities
 */

/** Format ISO timestamp to readable string */
export function formatTimestamp(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

/** Format date only */
export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format time only */
export function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC';
}

/** Format number with specified decimals */
export function formatNumber(n, decimals = 1) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(decimals);
}

/** Format area */
export function formatArea(km2) {
  return `${formatNumber(km2)} km²`;
}

/** Format distance */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${formatNumber(km)} km`;
}

/** Format speed */
export function formatSpeed(kn) {
  return `${formatNumber(kn)} kn`;
}

/** Format heading */
export function formatHeading(deg) {
  return `${Math.round(deg)}°`;
}

/** Get confidence color */
export function getConfidenceColor(level) {
  switch (level) {
    case 'HIGH':   return '#ff1744';
    case 'MEDIUM': return '#ffab00';
    case 'LOW':    return '#78909c';
    default:       return '#5c6bc0';
  }
}

/** Get score color (gradient from red → yellow → green) */
export function getScoreColor(score) {
  if (score >= 75) return '#00e676';
  if (score >= 50) return '#ffab00';
  if (score >= 25) return '#ff9100';
  return '#78909c';
}

/** Get badge HTML */
export function getBadgeHTML(level) {
  const cls = level === 'HIGH' ? 'badge-high' :
              level === 'MEDIUM' ? 'badge-medium' : 'badge-low';
  return `<span class="badge ${cls}">${level}</span>`;
}

/** Format duration in minutes to human readable */
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Get current time display string */
export function getCurrentTimeDisplay() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
