export async function probeRegistrationOwner({
  registration,
  getTab,
  sendToTab
} = {}) {
  const tabId = registration?.tabId;
  if (!Number.isInteger(tabId)) {
    return { responsive: false, reason: 'invalid_registration' };
  }

  try {
    const tab = await getTab(tabId);
    if (!tab) return { responsive: false, reason: 'tab_missing' };
  } catch {
    return { responsive: false, reason: 'tab_missing' };
  }

  try {
    const response = await sendToTab(tabId, {
      type: 'PMIA_PREFLIGHT_PING',
      sessionId: registration.sessionId,
      requesterRole: 'registration_probe'
    });
    const matches = response?.ok === true
      && response.sessionId === registration.sessionId
      && response.role === registration.role
      && response.provider === registration.provider
      && (!registration.instanceId || response.instanceId === registration.instanceId);
    return matches
      ? { responsive: true, reason: 'healthy' }
      : { responsive: false, reason: 'invalid_runtime_response' };
  } catch {
    return { responsive: false, reason: 'runtime_unreachable' };
  }
}
