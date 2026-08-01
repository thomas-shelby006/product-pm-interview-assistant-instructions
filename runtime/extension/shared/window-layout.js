const OFFSCREEN = { left: 3840, top: 0, width: 600, height: 1032 };
const DASHBOARD = { left: 1424, top: 0, width: 496, height: 1032 };

const LAYOUTS = {
  layout_both: {
    mode: 'three_window',
    sender: { left: 0, top: 0, width: 480, height: 1032 },
    receiver: { left: 464, top: 0, width: 976, height: 1032 },
    dashboard: DASHBOARD
  },
  layout_sender: {
    mode: 'sender_dashboard',
    sender: { left: 0, top: 0, width: 1424, height: 1032 },
    receiver: OFFSCREEN,
    dashboard: DASHBOARD
  },
  layout_receiver: {
    mode: 'receiver_dashboard',
    sender: OFFSCREEN,
    receiver: { left: 0, top: 0, width: 1424, height: 1032 },
    dashboard: DASHBOARD
  },
  layout_dashboard: {
    mode: 'dashboard_only',
    sender: OFFSCREEN,
    receiver: OFFSCREEN,
    dashboard: { left: 0, top: 0, width: 1920, height: 1032 }
  }
};

export function getRuntimeWindowLayout(command) {
  const layout = LAYOUTS[command];
  if (!layout) return null;
  return {
    mode: layout.mode,
    sender: { ...layout.sender },
    receiver: { ...layout.receiver },
    dashboard: { ...layout.dashboard }
  };
}

export function windowUpdateForBounds(bounds, { focused = false } = {}) {
  if (!bounds) return null;
  return {
    left: Math.round(bounds.left),
    top: Math.round(bounds.top),
    width: Math.max(320, Math.round(bounds.width)),
    height: Math.max(240, Math.round(bounds.height)),
    focused,
    state: 'normal'
  };
}
