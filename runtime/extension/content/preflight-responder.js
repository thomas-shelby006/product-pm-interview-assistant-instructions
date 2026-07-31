export function createPreflightResponder({
  runtimeConfig,
  adapter,
  version = ''
}) {
  return function respondToPreflight() {
    let composerAvailable = false;
    try {
      composerAvailable = Boolean(adapter?.findComposer?.());
    } catch {
      composerAvailable = false;
    }
    return {
      ok: true,
      sessionId: String(runtimeConfig?.sessionId || ''),
      role: String(runtimeConfig?.role || ''),
      provider: String(runtimeConfig?.provider || ''),
      version: String(version || ''),
      composerAvailable
    };
  };
}
