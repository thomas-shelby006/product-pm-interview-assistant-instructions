const CHECKS = ['handshake','direct','fallback','reconnect','selective_nack','alarm_audit','invariant_audit'];
export async function runTransportDrill(operations = {}) {
  const now = typeof operations.now === 'function' ? operations.now : Date.now; const startedAt = Number(now()); const checks = [];
  for (const name of CHECKS) { const operation = operations[name === 'selective_nack' ? 'selectiveNack' : name === 'alarm_audit' ? 'alarmAudit' : name === 'invariant_audit' ? 'invariantAudit' : name]; const checkStarted = Number(now()); let result;
    try { result = typeof operation === 'function' ? await operation() : { ok:false,error:'check_unavailable' }; } catch (error) { result = { ok:false,error:String(error?.message||error) }; }
    const check = { name, ok: result?.ok === true, error: result?.ok === true ? '' : String(result?.error || 'check_failed'), durationMs: Math.max(0, Number(now()) - checkStarted), data: result && typeof result === 'object' ? Object.fromEntries(Object.entries(result).filter(([key])=>!['text','prompt','answer'].includes(key))) : {} };
    checks.push(check); try { operations.onCheck?.(check); } catch {}
  }
  return { ok: checks.every(check=>check.ok), checks, startedAt, completedAt: Number(now()), elapsedMs: Math.max(0, Number(now()) - startedAt), contentAccessed: false };
}