function managedAlarm(name) { return /^pmia-(?:recovery|outbox):/.test(String(name || '')); }
export function normalizeAlarmSchedule(value, now = Date.now()) {
  const alarmName=String(value?.alarmName || value?.name || '').trim();
  const originalDueAt=Math.max(0,Number(value?.dueAt || value?.scheduledTime)||0);
  if(!alarmName||!managedAlarm(alarmName)||!originalDueAt) return null;
  return { alarmName, originalDueAt, dueAt:Math.max(Number(now)+50,originalDueAt), overdue:originalDueAt<=Number(now), generation:Math.max(0,Number(value?.generation||0)), source:String(value?.source||'persisted') };
}
export async function auditAndRehydrateAlarms({ schedules=[], existingAlarms=[], now=Date.now(), create=async()=>{}, clear=async()=>{} }={}) {
  const normalized=(Array.isArray(schedules)?schedules:[]).map(value=>normalizeAlarmSchedule(value,now)).filter(Boolean).sort((a,b)=>a.alarmName.localeCompare(b.alarmName)||b.generation-a.generation||a.originalDueAt-b.originalDueAt);
  const expected=new Map();
  for(const item of normalized){ const current=expected.get(item.alarmName); if(!current||item.generation>current.generation||(item.generation===current.generation&&item.originalDueAt<current.originalDueAt)) expected.set(item.alarmName,item); }
  const existing=new Map((Array.isArray(existingAlarms)?existingAlarms:[]).filter(value=>managedAlarm(value?.name)).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(value=>[String(value.name),value]));
  let restored=0,unchanged=0,cleared=0; const overdue=[];
  for(const [name,schedule] of expected){ const current=existing.get(name); if(schedule.overdue) overdue.push({ name, dueAt:schedule.originalDueAt, generation:schedule.generation }); if(current&&Math.abs(Number(current.scheduledTime||0)-schedule.dueAt)<1000){ unchanged+=1; continue; } await create(name,{ when:schedule.dueAt }); restored+=1; }
  for(const name of [...existing.keys()].sort()){ if(expected.has(name)) continue; await clear(name); cleared+=1; }
  return { restored,unchanged,cleared,expected:expected.size,overdue,auditedAt:Number(now) };
}
export function outboxAlarmName(sessionId){ return `pmia-outbox:${String(sessionId||'')}`; }
