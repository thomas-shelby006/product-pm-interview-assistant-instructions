export function deriveMemoryGuard(snapshot) {
  const pressure = snapshot?.storagePressure || {};
  const breakdown = pressure.breakdown || {};
  const actionable = Number(breakdown.actionable || 0);
  const reclaimable = Number(breakdown.telemetry || 0) + Number(breakdown.proven || 0);
  return {
    level: String(pressure.level || 'normal'),
    percent: Number(pressure.percent || 0),
    actionableBytes: actionable,
    provenBytes: Number(breakdown.proven || 0),
    telemetryBytes: Number(breakdown.telemetry || 0),
    snapshotBytes: Number(breakdown.snapshots || 0),
    reclaimableBytes: reclaimable,
    blocked: pressure.level === 'critical'
  };
}
