export function computeSimpleLayout(bounds, providerCount, { cockpitHeight = 120 } = {}) {
  const count = providerCount === 3 ? 3 : 2;
  const left = Math.round(Number(bounds?.left || 0));
  const top = Math.round(Number(bounds?.top || 0));
  const width = Math.max(count, Math.round(Number(bounds?.width || 0)));
  const height = Math.max(cockpitHeight + 100, Math.round(Number(bounds?.height || 0)));
  const providerHeight = height - cockpitHeight;
  const baseWidth = Math.floor(width / count);
  const providers = [];
  let x = left;
  for (let index = 0; index < count; index += 1) {
    const providerWidth = index === count - 1 ? left + width - x : baseWidth;
    providers.push({ left:x, top, width:providerWidth, height:providerHeight });
    x += providerWidth;
  }
  return {
    providers,
    cockpit:{ left, top:top + providerHeight, width, height:cockpitHeight }
  };
}
