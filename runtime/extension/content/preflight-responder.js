import { describeAdapterCapabilities } from './adapter-health.js';

export function createPreflightResponder({
  runtimeConfig,
  adapter,
  version = '',
  instanceId = ''
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
      instanceId: String(instanceId || ''),
      composerAvailable,
      capabilities: describeAdapterCapabilities(adapter, runtimeConfig?.role)
    };
  };
}
