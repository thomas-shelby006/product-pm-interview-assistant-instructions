export function launchIsReady({ roles = [], hasBoot = false, boot = null } = {}) {
  if (!hasBoot) return true;
  const answerRoles = roles.filter(role => role === 'receiver' || role === 'comparison');
  return answerRoles.length > 0 && answerRoles.every(role => boot?.[role]?.stage === 'rendered');
}
