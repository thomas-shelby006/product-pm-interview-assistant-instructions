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
  renderNavigatorDetails(document, model);
}

function renderList(document, id, items = [], map = item => ({ label: String(item) })) {
  const root = byId(document, id); if (!root) return; clear(root);
  for (const [index, source] of items.entries()) {
    const value = map(source, index) || {}; const row = document.createElement('li');
    if (value.id) row.dataset.entityId = value.id;
    if (value.action) row.dataset.navigatorAction = value.action;
    const button = value.selectable ? document.createElement('button') : null;
    const owner = button || row; if (button) { button.type = 'button'; button.dataset.navigatorResultIndex = String(index); }
    const strong = document.createElement('strong'); strong.textContent = value.label || 'Untitled'; owner.append(strong);
    if (value.detail) { const detail = document.createElement('span'); detail.textContent = value.detail; owner.append(detail); }
    if (button) row.append(button);
    if (value.removeId) { const remove = document.createElement('button'); remove.type='button'; remove.dataset.removeBookmark=value.removeId; remove.textContent='Remove'; row.append(remove); }
    if (value.scenarioId) { const mark = document.createElement('button'); mark.type='button'; mark.dataset.completeScenario=value.scenarioId; mark.textContent=value.complete?'Completed':'Mark complete'; mark.disabled=value.complete; row.append(mark); }
    if (value.workspaceId) { const apply = document.createElement('button'); apply.type='button'; apply.dataset.applyWorkspace=value.workspaceId; apply.textContent=value.active?'Active':'Apply'; apply.disabled=value.active; row.append(apply); }
    root.append(row);
  }
  if (!items.length) { const empty=document.createElement('li'); empty.textContent='Nothing to show.'; root.append(empty); }
}

function renderSearch(document, model = {}) {
  const search=model.search||{}; const input=byId(document,'sessionNavigatorSearchInput'); if(input && input.value!==search.query) input.value=search.query||'';
  renderList(document,'sessionNavigatorSearchResults',search.results||[],item=>({id:item.id,label:item.label,detail:`${item.type} · ${item.detail}`,selectable:true}));
  setText(document,'sessionNavigatorSearchPreviewTitle',search.preview?.title||'No result selected'); setText(document,'sessionNavigatorSearchPreviewDetail',search.preview?.detail||'Search the current session.');
  const jump=byId(document,'sessionNavigatorJump'); if(jump){jump.disabled=!search.preview?.jump;jump.dataset.jump=search.preview?.jump?JSON.stringify(search.preview.jump):'';}
  renderList(document,'navigatorRecentVisits',search.recent||[],item=>({label:item.reason||item.tab,detail:`${item.entityType||'view'} ${item.entityId||''}`}));
}

function renderThreads(document, model = {}) {
  const threads=model.threads||{},graph=threads.graph||{nodes:{},roots:[]};
  renderList(document,'sessionNavigatorThreadRoots',(graph.roots||[]).map(id=>graph.nodes[id]),item=>({id:item.id,label:item.text||item.id,detail:`${item.children?.length||0} follow-up(s)`,selectable:true}));
  renderList(document,'sessionNavigatorThreadChain',threads.chain||[],item=>({label:item.text||item.id,detail:`${item.state} · seq ${item.seq}`}));
  setText(document,'sessionNavigatorThreadState',threads.completion?`${threads.completion.count} question(s) · ${threads.completion.unresolved} unresolved · ${threads.completion.complete?'complete':'open'}`:'Select a question thread.');
  const select=byId(document,'sessionNavigatorThreadParent'); if(select){clear(select);for(const node of Object.values(graph.nodes||{})){const option=document.createElement('option');option.value=node.id;option.textContent=node.text||node.id;select.append(option);}}
}

function seconds(ms){return `${Math.round(Number(ms||0)/1000)}s`;}
function renderPace(document, model = {}) {
  const pace=model.pace||{};setText(document,'navigatorPaceBaseline',seconds(pace.baseline?.baselineMs));setText(document,'navigatorPaceSource',`${pace.baseline?.source||'unknown'} · ${pace.baseline?.sampleCount||0} sample(s)`);
  setText(document,'navigatorSegmentRemaining',pace.segment?.durationMs?seconds(pace.segment.remainingMs):'Unplanned');setText(document,'navigatorSegmentProgress',pace.segment?.durationMs?`${pace.segment.progress}% · ${pace.segment.label||'segment'}`:'No active segment duration.');
  setText(document,'navigatorSilenceState',pace.silence?.state||'normal');setText(document,'navigatorSilenceDetail',`${seconds(pace.silence?.silenceMs)} since interviewer activity`);
  setText(document,'navigatorPaceGuidance',pace.guidance?.label||'No guidance');setText(document,'navigatorPaceDetail',pace.guidance?.detail||'');
  renderList(document,'navigatorAnswerBands',pace.bands||[],item=>({label:`Answer ${item.index+1}: ${seconds(item.valueMs)}`,detail:item.band}));
}

function renderHandoff(document, model = {}) {
  const value=model.handoff||{};setText(document,'navigatorHandoffCurrent',value.currentLabel||'No active batch');setText(document,'navigatorHandoffNext',value.nextLabel||'No next batch');setText(document,'navigatorHandoffState',value.label||'Waiting');setText(document,'navigatorHandoffDetail',`${value.unresolvedCount||0} unresolved final(s)`);
  renderList(document,'navigatorHandoffBlockers',value.blockers||[],item=>({label:item.code?.replaceAll('_',' ')||'Blocker',detail:item.owner||''}));
  const button=byId(document,'navigatorHandoffAction');if(button){button.hidden=!value.action;button.textContent=value.action?.label||'';button.dataset.command=value.action?.command||'';button.dataset.view=value.action?.view||'';}
}

function renderWorkspaces(document, model = {}) {
  const value=model.workspaces||{};renderList(document,'navigatorWorkspaceList',value.items||[],item=>({label:item.label,detail:`${item.visiblePanels.length} panels · ${item.focus} focus`,workspaceId:item.id,active:item.id===value.activeId}));
}

function renderScenarios(document, model = {}) {
  renderList(document,'navigatorScenarioList',model.scenarios||[],item=>({label:item.scenario?.label||item.scenario?.id,detail:`${item.passed||0}/${item.total||0} current checks · ${item.state}`,scenarioId:item.scenario?.id,complete:item.recordedComplete}));
  const selected=(model.scenarios||[]).find(item=>!item.recordedComplete)||(model.scenarios||[])[0]; const detail=byId(document,'navigatorScenarioDetail'); if(detail){clear(detail);const title=document.createElement('strong');title.textContent=selected?.scenario?.label||'No scenario';const summary=document.createElement('p');summary.textContent=selected?`${selected.passed||0}/${selected.total||0} checks · ${(selected.missing||[]).join(', ')||'all checks satisfied'}`:'No scenario data.';detail.append(title,summary);}
}

function renderBookmarks(document, model = {}) {
  const value=model.bookmarks||{};renderList(document,'navigatorBookmarkList',value.items||[],item=>({label:item.label||item.category,detail:`${item.targetType} · ${item.targetId}${item.validation?.ok?'':' · stale'}`,removeId:item.id}));
  renderList(document,'navigatorBookmarkReview',value.reviewQueue||[],item=>({label:item.label||item.category,detail:`${item.targetType} · ${item.targetId}`}));
}

function renderGoals(document, model = {}) {
  const value=model.goals||{};renderList(document,'navigatorGoalList',value.matrix?.goals||[],item=>({label:item.label,detail:`${item.coveredCount}/${item.targetCount} · ${item.percent}% · ${item.priority}`}));
  renderList(document,'navigatorGoalGaps',value.gaps||[],item=>({label:`${item.rank}. ${item.label}`,detail:`${item.remaining} target(s) remain · ${item.priority}`}));
  setText(document,'navigatorPhaseCoverage',`Phase coverage: ${value.phaseCoverage?.covered||0}/${value.phaseCoverage?.total||0} (${value.phaseCoverage?.percent||0}%)`);
  const question=byId(document,'navigatorCoverageQuestion');if(question){clear(question);for(const item of model.search?.results?.filter(value=>value.type==='question')||[]){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;question.append(option);}} const goal=byId(document,'navigatorCoverageGoal');if(goal){clear(goal);for(const item of value.matrix?.goals||[]){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;goal.append(option);}}
}

function renderDebrief(document, model = {}) {
  const value=model.debrief||{};const post=model.postInterview||{};
  setText(document,'navigatorDebriefState',value.exportReady?'Ready to export':'Resolve blockers first');
  setText(document,'navigatorDebriefDetail',`${value.coverage?.percent||0}% goal coverage · ${value.phaseCoverage?.percent||0}% phase coverage · ${value.markers?.length||0} marker(s)`);
  setText(document,'navigatorRoleExportState',post.exportComplete?'Both managed role records were exported successfully.':'Export both managed role records before opening Review.');
  renderList(document,'navigatorDebriefDecisions',value.decisions?.items||[],item=>({label:item.code?.replaceAll('_',' ')||'Decision',detail:`Open ${item.view||'session'}`}));
  renderList(document,'navigatorPracticePlan',value.practice?.steps||[],item=>({label:item.label,detail:item.reason}));
  const exportButton=byId(document,'navigatorExportDebrief');if(exportButton)exportButton.disabled=!value.exportReady;
  const reviewButton=byId(document,'navigatorOpenReview');if(reviewButton)reviewButton.disabled=!post.reviewReady;
}

function renderNavigatorDetails(document, model = {}) {
  renderSearch(document,model);renderThreads(document,model);renderPace(document,model);renderHandoff(document,model);renderWorkspaces(document,model);renderScenarios(document,model);renderBookmarks(document,model);renderGoals(document,model);renderDebrief(document,model);
  setText(document,'navigatorNowSummary',`${model.phase||'prelaunch'} · ${model.primaryAction?.label||'No action required'}`);
}
