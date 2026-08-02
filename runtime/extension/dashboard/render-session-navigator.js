function byId(document, id) {
  return document.getElementById(id);
}

function setText(document, id, value) {
  const node = byId(document, id);
  if (node) node.textContent = String(value ?? '');
}

function clear(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}

function renderRail(document, rail = []) {
  const root = byId(document, 'sessionNavigatorRail');
  if (!root) return;
  clear(root);
  for (const item of rail) {
    const article = document.createElement('article');
    article.dataset.tone = item.tone || 'info';
    const label = document.createElement('span'); label.className = 'eyebrow'; label.textContent = item.label;
    const value = document.createElement('strong'); value.textContent = item.value;
    const detail = document.createElement('p'); detail.textContent = item.detail;
    article.append(label, value, detail);
    root.append(article);
  }
}

function renderBreadcrumbs(document, breadcrumbs = []) {
  const root = byId(document, 'sessionNavigatorBreadcrumbs');
  if (!root) return;
  clear(root);
  for (const item of breadcrumbs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.navigatorPhase = item.id;
    button.dataset.state = item.state;
    button.textContent = item.label;
    button.disabled = item.available === false;
    button.setAttribute('aria-current', item.state === 'current' ? 'step' : 'false');
    root.append(button);
  }
}

function renderTabs(document, activeTab = 'now') {
  document.querySelectorAll('[data-navigator-tab]').forEach(node => {
    const active = node.dataset.navigatorTab === activeTab;
    node.classList.toggle('active', active);
    node.setAttribute('aria-selected', String(active));
    node.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-navigator-panel]').forEach(node => {
    const active = node.dataset.navigatorPanel === activeTab;
    node.hidden = !active;
    node.classList.toggle('active', active);
  });
}

export function renderSessionNavigator({ document, model = {}, localState = {} } = {}) {
  if (!document) return;
  renderTabs(document, localState.activeTab || model.selectedTab || 'now');
  renderRail(document, model.rail || []);
  renderBreadcrumbs(document, model.breadcrumbs || []);
  setText(document, 'sessionNavigatorPhase', model.phase || 'prelaunch');
  const action = model.primaryAction || {};
  const actionButton = byId(document, 'sessionNavigatorPrimaryAction');
  if (actionButton) {
    actionButton.textContent = action.label || 'No action required';
    actionButton.hidden = !action.id;
    actionButton.disabled = action.available === false;
    actionButton.dataset.command = action.command || '';
    actionButton.dataset.view = action.view || '';
    actionButton.dataset.anchor = action.anchor || '';
    actionButton.dataset.actionId = action.id || '';
  }
  const quickOpen = byId(document, 'sessionNavigatorQuickOpen');
  if (quickOpen) {
    clear(quickOpen);
    for (const item of model.quickOpen || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.navigatorTabTarget = item.tab;
      button.textContent = item.label;
      quickOpen.append(button);
    }
  }
}
