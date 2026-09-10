/**
 * Generates synthetic timestamps for vessel trajectories.
 * This is done to demonstrate the concept of temporal correlation for the hackathon demo
 * when real timestamps are not available in the case001 prototype dataset.
 */

export function generateSyntheticTimestamps(vessels, spillDetectionTimeISO) {
  if (!spillDetectionTimeISO) return vessels;
  const detectionTime = new Date(spillDetectionTimeISO).getTime();

  return vessels.map(vessel => {
    // Deep clone the vessel to avoid mutating source data
    const clonedVessel = JSON.parse(JSON.stringify(vessel));
    
    // Deterministically generate a time offset based on MMSI
    const seed = clonedVessel.mmsi || 123456789;
    
    // Time per trajectory segment in milliseconds (between 15 and 45 minutes)
    const minutesPerSegment = 15 + (seed % 30);
    const msPerSegment = minutesPerSegment * 60 * 1000;
    
    // An overall time shift for this vessel relative to the spill.
    // e.g., shift from -12 hours to +12 hours to spread them out around the detection time
    // For V001 (which is the true polluter in Case001), let's ensure it has a very close temporal match.
    let shiftHours = ((seed % 24) - 12);
    if (clonedVessel.id === 'V001') {
      shiftHours = -2; // Passed by origin 2 hours before detection
    }

    // The base time is the time of the last point in the trajectory
    const baseTime = detectionTime + (shiftHours * 60 * 60 * 1000);

    if (clonedVessel.trajectory && clonedVessel.trajectory.length > 0) {
      // Trajectory goes from older to newer (index 0 is oldest, last is newest)
      for (let i = 0; i < clonedVessel.trajectory.length; i++) {
        const timeOffset = (clonedVessel.trajectory.length - 1 - i) * msPerSegment;
        const pointTime = baseTime - timeOffset;
        clonedVessel.trajectory[i].timestamp = new Date(pointTime).toISOString();
      }
    }
    
    clonedVessel.temporalSource = 'synthetic';
    return clonedVessel;
  });
}
