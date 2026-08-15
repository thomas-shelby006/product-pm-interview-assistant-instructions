function hasFunction(adapter, name) {
  return typeof adapter?.[name] === 'function';
}

export function describeAdapterCapabilities(adapter, role = '') {
  const capabilities = {
    composerFinder: hasFunction(adapter, 'findComposer'),
    messageReader: hasFunction(adapter, 'getConversationMessages'),
    composerWriter: hasFunction(adapter, 'setComposerText'),
    composerReader: hasFunction(adapter, 'getComposerText'),
    submit: hasFunction(adapter, 'submit'),
    generationState: hasFunction(adapter, 'isGenerating'),
    stopGeneration: hasFunction(adapter, 'stopGenerating'),
    microphoneToggle: hasFunction(adapter, 'toggleMute'),
    voiceState: hasFunction(adapter, 'isVoiceActive')
  };
  const required = ['receiver', 'comparison'].includes(role)
    ? ['composerFinder', 'messageReader', 'composerWriter', 'composerReader', 'submit', 'generationState']
    : ['composerFinder', 'messageReader'];
  const missingRequired = required.filter(name => !capabilities[name]);
  return {
    ...capabilities,
    required,
    missingRequired,
    complete: missingRequired.length === 0
  };
}
