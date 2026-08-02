import { deriveOperationsLab } from './operations-lab-model.js';
import { createOperationsLabLocalState } from './operations-lab-controller.js';

function node(document,id){return document.getElementById(id);}
function set(document,id,value){const target=node(document,id);if(target)target.textContent=String(value??'');}
function button(document,label,dataset={}){const value=document.createElement('button');value.type='button';value.textContent=label;Object.assign(value.dataset,dataset);return value;}
function option(document,label,value){const item=document.createElement('option');item.textContent=label;item.value=value;return item;}

export function renderOperationsLab({document,snapshot,state,now=Date.now()}={}){
  const local=createOperationsLabLocalState(state||{});
  const model=deriveOperationsLab(snapshot||{},{view:local.view,scenario:local.scenario,now});
  const root=node(document,'operationsLab');if(!root)return model;
  root.dataset.view=model.view;root.dataset.scenario=model.scenario;root.dataset.privacy=model.privacy.safe?'safe':'blocked';
  set(document,'operationsLabSummary',model.summary);set(document,'operationsLabScenarioDetail',model.scenarioDetail);
  const privacy=node(document,'operationsLabPrivacy');if(privacy){privacy.textContent=model.privacy.safe?'Metadata-only':'Privacy check blocked';privacy.dataset.tone=model.privacy.safe?'good':'danger';}
  const tabs=node(document,'operationsLabTabs');if(tabs){tabs.replaceChildren();for(const view of model.views){const control=button(document,`${view.label} ${view.count}`,{operationsLabView:view.id});control.id=`operationsLabTab-${view.id}`;control.setAttribute('role','tab');control.setAttribute('aria-selected',String(view.id===model.view));control.setAttribute('aria-controls','operationsLabPanel');control.tabIndex=view.id===model.view?0:-1;tabs.append(control);}}
  const scenario=node(document,'operationsLabScenario');if(scenario){const current=scenario.value;scenario.replaceChildren();for(const entry of model.scenarios)scenario.append(option(document,entry.label,entry.id));scenario.value=model.scenario||current;}
  const panel=node(document,'operationsLabPanel');if(panel){panel.setAttribute('aria-labelledby',`operationsLabTab-${model.view}`);panel.replaceChildren();for(const entry of model.visibleItems){const card=document.createElement('article');card.className='operations-lab-item';card.dataset.tone=entry.tone;card.dataset.state=entry.state;card.dataset.operationsLabItem=entry.id;const header=document.createElement('div');header.className='operations-lab-item-head';const title=document.createElement('h4');title.textContent=entry.label;const metric=document.createElement('b');metric.textContent=entry.metric||entry.state.replaceAll('_',' ');header.append(title,metric);const status=document.createElement('span');status.className='operations-lab-state';status.textContent=entry.state.replaceAll('_',' ');const detail=document.createElement('p');detail.textContent=entry.detail;card.append(header,status,detail);panel.append(card);}}
  return model;
}
