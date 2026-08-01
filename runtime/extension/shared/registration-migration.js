export async function shouldAllowRuntimeLeaseMigration({
  existing,
  incomingTab,
  getTab
} = {}) {
  if (!existing || !Number.isInteger(existing.tabId)) return true;
  if (!incomingTab || !Number.isInteger(incomingTab.id)) return false;
  if (existing.tabId === incomingTab.id) return true;

  let existingTab;
  try {
    existingTab = await getTab(existing.tabId);
  } catch {
    return true;
  }
  if (!existingTab) return true;
  return Boolean(incomingTab.active && !existingTab.active);
}
