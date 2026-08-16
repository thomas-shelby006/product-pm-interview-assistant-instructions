async function waitForAsync(check, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    if (await check()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (true);
}

export async function deliverTurn({
  adapter,
  turn,
  onStage = () => {},
  writeTimeoutMs = 10000,
  submitTimeoutMs = 60000,
  renderTimeoutMs = 12000,
  retryIntervalMs = 25
} = {}) {
  const started = performance.now?.() ?? Date.now();
  const fail = reason => ({ stage:'failed', reason, elapsedMs:Math.max(0,(performance.now?.() ?? Date.now()) - started) });

  if (!adapter || !turn?.text) return fail('invalid_delivery');

  const written = await waitForAsync(async () => {
    if (!(await adapter.write(turn.text))) return false;
    return Boolean(adapter.verifyComposer(turn.text));
  }, { timeoutMs:writeTimeoutMs, intervalMs:retryIntervalMs });
  if (!written) return fail('composer_write_failed');
  onStage({ stage:'composer_written', turnId:turn.turnId });

  const submitted = await waitForAsync(
    () => adapter.submit(),
    { timeoutMs:submitTimeoutMs, intervalMs:retryIntervalMs }
  );
  if (!submitted) return fail('submit_unavailable');
  onStage({ stage:'submitted', turnId:turn.turnId });

  const rendered = await adapter.verifyRenderedTurn(turn.text, {
    timeoutMs:renderTimeoutMs,
    intervalMs:retryIntervalMs
  });
  if (!rendered) return fail('render_not_verified');
  const result = { stage:'rendered', elapsedMs:Math.max(0,(performance.now?.() ?? Date.now()) - started) };
  onStage({ ...result, turnId:turn.turnId });
  return result;
}
