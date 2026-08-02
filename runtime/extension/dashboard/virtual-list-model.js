export function deriveVirtualList({ count=0,scrollTop=0,viewportHeight=0,rowHeight=48,overscan=6 }={}) {
  const total=Math.max(0,Math.floor(Number(count)||0)),height=Math.max(1,Number(rowHeight)||48),extra=Math.max(0,Math.floor(Number(overscan)||0));
  const rawStart=Math.floor(Math.max(0,Number(scrollTop)||0)/height)-extra; const start=Math.min(total,Math.max(0,rawStart));
  const visible=Math.max(0,Math.ceil(Math.max(0,Number(viewportHeight)||0)/height)+(extra*2)); const end=Math.min(total,start+visible);
  return { start,end,count:Math.max(0,end-start),top:start*height,bottom:Math.max(0,(total-end)*height),totalHeight:total*height };
}
export function virtualItems(items=[],options={}){ const list=Array.isArray(items)?items:[];const model=deriveVirtualList({ ...options,count:list.length });return { ...model,items:list.slice(model.start,model.end) }; }
