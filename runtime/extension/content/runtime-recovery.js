import { createPageLifecycleCoordinator } from './page-lifecycle-coordinator.js';

export function createRuntimeRecovery({
  window,
  document,
  recover,
  scheduleMicrotask = globalThis.queueMicrotask
}) {
  return createPageLifecycleCoordinator({
    window,
    document,
    reconcile: recover,
    scheduleMicrotask
  });
}