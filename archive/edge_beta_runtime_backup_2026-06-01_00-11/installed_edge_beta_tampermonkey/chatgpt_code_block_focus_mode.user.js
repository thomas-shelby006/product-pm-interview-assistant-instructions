// ==UserScript==
// @name         ChatGPT Code Block Focus Mode
// @namespace    vb-code-focus
// @version      10.9
// @description  Focus button on code blocks. Win2: publishes with full inlined visual styles. Win1: auto-opens mirrored overlay with syntax highlighting.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    http://127.0.0.1:8123/focus.user.js
// @downloadURL  http://127.0.0.1:8123/focus.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const READY_ATTR  = 'data-vb-focus-ready';
  const STYLE_ID    = 'vb-focus-style';
  const OVERLAY_ID  = 'vb-focus-overlay';
  const PAYLOAD_KEY = 'vb_focus_payload';
  const FOCUS_OPEN_KEY = 'vb_focus_open';

  // ── Resilient role resolution ────────────────────────────
  // Bridge script sets sessionStorage after URL param redirect.
  // Focus script may run before bridge on some page loads, so we
  // re-resolve role lazily at init and again at each click.
  function resolveRole() {
    // 1. URL param (present before bridge redirects it away)
    const urlRole = new URLSearchParams(window.location.search).get('vb_role');
    if (urlRole) return urlRole;
    // 2. sessionStorage (set by bridge after load)
    return sessionStorage.getItem('vb_role') || null;
  }

  // Resolved once at module load; re-checked inside click handlers.
  let resolvedRole = resolveRole();

  // ── Styles ───────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .vb-focus-btn-inline {
        border: 1px solid rgba(255,255,255,0.14) !important;
        background: rgba(20,20,20,0.92) !important;
        color: #fff !important;
        border-radius: 8px !important;
        padding: 4px 10px !important;
        font-size: 12px !important;
        line-height: 1.2 !important;
        cursor: pointer !important;
        user-select: none !important;
        margin-left: 6px !important;
        flex: 0 0 auto !important;
      }
      .vb-focus-btn-inline:hover {
        background: rgba(40,40,40,0.98) !important;
      }
      #${OVERLAY_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: none !important;
        flex-direction: column !important;
        background: rgba(10,10,10,0.985) !important;
      }
      #${OVERLAY_ID}.vb-open {
        display: flex !important;
      }
      #${OVERLAY_ID} .vb-toolbar {
        position: sticky !important;
        top: 0 !important;
        z-index: 5 !important;
        flex: 0 0 auto !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 12px 16px !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        background: rgba(0,0,0,0.55) !important;
        backdrop-filter: blur(8px) !important;
      }
      #${OVERLAY_ID} .vb-title {
        color: rgba(255,255,255,0.92) !important;
        font-size: 13px !important;
        line-height: 1.2 !important;
        font-weight: 600 !important;
      }
      #${OVERLAY_ID} .vb-toolbar button {
        border: 1px solid rgba(255,255,255,0.16) !important;
        background: rgba(28,28,28,0.96) !important;
        color: #fff !important;
        border-radius: 10px !important;
        padding: 6px 12px !important;
        font-size: 13px !important;
        cursor: pointer !important;
      }
      #${OVERLAY_ID} .vb-toolbar button:hover {
        background: rgba(48,48,48,0.98) !important;
      }
      #${OVERLAY_ID} .vb-body {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        min-width: 0 !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        padding: 18px !important;
      }
      #${OVERLAY_ID} .vb-card {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 100% !important;
        box-sizing: border-box !important;
        border-radius: 16px !important;
        overflow: visible !important;
        overflow-wrap: anywhere !important;
        background: rgb(24,24,27) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
      }
      #${OVERLAY_ID} .vb-card-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        padding: 12px 16px !important;
        border-bottom: 1px solid rgba(255,255,255,0.06) !important;
        background: rgba(255,255,255,0.02) !important;
      }
      #${OVERLAY_ID} .vb-card-lang {
        color: rgba(255,255,255,0.92) !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        line-height: 1.2 !important;
      }
      #${OVERLAY_ID} .vb-card-body {
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        box-sizing: border-box !important;
      }
      #${OVERLAY_ID} .vb-card-body pre {
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        box-sizing: border-box !important;
        border-radius: 0 !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
        white-space: pre-wrap !important;
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
      }
      #${OVERLAY_ID} .vb-card-body code {
        overflow-x: visible !important;
        overflow-y: visible !important;
        max-height: none !important;
        height: auto !important;
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
        white-space: pre-wrap !important;
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
      }
      #${OVERLAY_ID} .vb-card-body code * {
        white-space: inherit !important;
        word-break: inherit !important;
        overflow-wrap: inherit !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
      #${OVERLAY_ID} .vb-body.vb-horizontal-overflow .vb-card {
        width: max-content !important;
        max-width: none !important;
        min-width: 100% !important;
      }
      #${OVERLAY_ID} .vb-body.vb-horizontal-overflow .vb-card-body {
        width: max-content !important;
        max-width: none !important;
        min-width: 100% !important;
        overflow-x: visible !important;
      }
      #${OVERLAY_ID} .vb-body.vb-horizontal-overflow pre,
      #${OVERLAY_ID} .vb-body.vb-horizontal-overflow code {
        width: max-content !important;
        max-width: none !important;
        min-width: 100% !important;
        white-space: pre !important;
        overflow-x: visible !important;
      }
      body.vb-focus-open {
        overflow-y: hidden !important;
        overflow-x: visible !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Overlay shell ────────────────────────────────────────
  function getOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="vb-toolbar">
        <div class="vb-title">Code Focus</div>
        <button type="button" data-vb-close>Minimize</button>
      </div>
      <div class="vb-body" data-vb-body></div>
    `;
    overlay.querySelector('[data-vb-close]').addEventListener('click', closeOverlay);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('vb-open')) {
        e.preventDefault();
        closeOverlay();
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const body = overlay.querySelector('[data-vb-body]');
    if (body) { body.innerHTML = ''; body.scrollTop = 0; }
    overlay.classList.remove('vb-open');
    document.body.classList.remove('vb-focus-open');
    localStorage.setItem(FOCUS_OPEN_KEY, '0');
  }

  function isOverlayOpen() {
    const overlay = document.getElementById(OVERLAY_ID);
    return overlay ? overlay.classList.contains('vb-open') : false;
  }

  // ── Clone pipeline ───────────────────────────────────────
  function getLanguageLabel(pre) {
    const area = pre.closest('[class*="group"]') || pre.parentElement || pre;
    const texts = [...area.querySelectorAll('*')]
      .map((el) => el.textContent?.trim()).filter(Boolean);
    const known = ['JavaScript','TypeScript','JSX','TSX','HTML','CSS','JSON','Python','Bash'];
    for (const label of known) {
      if (texts.includes(label)) return label;
    }
    return 'Code';
  }

  const UNWANTED_UI_SELECTORS = [
    'button','svg','[role="button"]',
    '[aria-label*="Copy"]','[aria-label*="copy"]',
    '[aria-label*="Edit"]','[aria-label*="edit"]',
    '[aria-label*="Run"]','[aria-label*="run"]'
  ];

  function removeUnwantedUi(root) {
    for (const sel of UNWANTED_UI_SELECTORS) {
      root.querySelectorAll(sel).forEach((node) => node.remove());
    }
  }

  function setImportantStyle(el, prop, value) {
    el.style.setProperty(prop, value, 'important');
  }

  function forceCloneWrapping(root) {
    const all = [root, ...root.querySelectorAll('*')];
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      setImportantStyle(el, 'max-width', '100%');
      setImportantStyle(el, 'min-width', '0');
      setImportantStyle(el, 'box-sizing', 'border-box');
    }

    const wrapTargets = [root, ...root.querySelectorAll('pre, code')];
    for (const el of wrapTargets) {
      if (!(el instanceof HTMLElement)) continue;
      setImportantStyle(el, 'width', '100%');
      setImportantStyle(el, 'max-width', '100%');
      setImportantStyle(el, 'min-width', '0');
      setImportantStyle(el, 'white-space', 'pre-wrap');
      setImportantStyle(el, 'overflow-wrap', 'anywhere');
      setImportantStyle(el, 'word-break', 'break-all');
      setImportantStyle(el, 'overflow-x', 'visible');
      setImportantStyle(el, 'overflow-y', 'visible');
    }

    root.querySelectorAll('code *').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'white-space', 'inherit');
      setImportantStyle(el, 'overflow-wrap', 'inherit');
      setImportantStyle(el, 'word-break', 'inherit');
    });
  }

  function normalizeClone(root) {
    const all = [root, ...root.querySelectorAll('*')];
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      el.style.maxHeight = 'none';
      el.style.height = 'auto';
      el.style.minHeight = '0';
      el.style.maxWidth = '100%';
      el.style.minWidth = '0';
      el.style.boxSizing = 'border-box';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
      const cs = getComputedStyle(el);
      if (cs.position === 'sticky' || cs.position === 'fixed') el.style.position = 'static';
      if (cs.transform && cs.transform !== 'none') el.style.transform = 'none';
      if (cs.mask && cs.mask !== 'none') el.style.mask = 'none';
      if (cs.webkitMask && cs.webkitMask !== 'none') el.style.webkitMask = 'none';
    }
    const pre  = root.matches('pre')  ? root : root.querySelector('pre');
    const code = root.matches('code') ? root : root.querySelector('code');
    if (pre instanceof HTMLElement) {
      pre.style.width = '100%'; pre.style.maxWidth = '100%'; pre.style.margin = '0';
      pre.style.whiteSpace = 'pre-wrap'; pre.style.overflowWrap = 'anywhere';
      pre.style.wordBreak = 'break-all'; pre.style.overflowX = 'visible';
    }
    if (code instanceof HTMLElement) {
      code.style.display = 'block'; code.style.width = '100%'; code.style.maxWidth = '100%';
      code.style.whiteSpace = 'pre-wrap'; code.style.overflowWrap = 'anywhere';
      code.style.wordBreak = 'break-all'; code.style.overflowX = 'visible';
    }
  }

  function buildNormalizedClone(pre) {
    const clone = pre.cloneNode(true);
    removeUnwantedUi(clone);
    normalizeClone(clone);
    return clone;
  }

  // ── Card builder ─────────────────────────────────────────
  function buildCardFromElement(cloneEl, lang) {
    const card = document.createElement('div');
    card.className = 'vb-card';

    const header = document.createElement('div');
    header.className = 'vb-card-header';
    const label = document.createElement('div');
    label.className = 'vb-card-lang';
    label.textContent = lang;
    header.appendChild(label);

    const body = document.createElement('div');
    body.className = 'vb-card-body';
    body.appendChild(cloneEl);

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  // Build card from serialized HTML payload (used in Win1).
  function buildCardFromPayload(payload) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = payload.html;
    const cloneEl = wrapper.firstElementChild || wrapper;
    normalizeClone(cloneEl);
    forceCloneWrapping(cloneEl);
    return buildCardFromElement(cloneEl, payload.language || 'Code');
  }

  const FOCUS_OVERFLOW_THRESHOLD = 18;

  function applyFocusWrapDefaults(body) {
    if (!(body instanceof HTMLElement)) return;

    body.classList.remove('vb-horizontal-overflow');
    setImportantStyle(body, 'overflow-x', 'auto');
    setImportantStyle(body, 'overflow-y', 'auto');
    setImportantStyle(body, 'min-width', '0');

    const targets = [
      body,
      ...body.querySelectorAll('.vb-card, .vb-card-body, pre, code, code *')
    ].filter((el) => el instanceof HTMLElement);

    body.querySelectorAll('.vb-card').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'width', '100%');
      setImportantStyle(el, 'max-width', '100%');
      setImportantStyle(el, 'min-width', '100%');
    });

    body.querySelectorAll('.vb-card-body').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'width', '100%');
      setImportantStyle(el, 'max-width', '100%');
      setImportantStyle(el, 'min-width', '0');
      setImportantStyle(el, 'overflow-x', 'visible');
      setImportantStyle(el, 'overflow-y', 'visible');
    });

    for (const el of targets) {
      setImportantStyle(el, 'max-width', '100%');
      setImportantStyle(el, 'min-width', '0');
      setImportantStyle(el, 'box-sizing', 'border-box');
    }

    body.querySelectorAll('.vb-card').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'width', '100%');
      setImportantStyle(el, 'max-width', '100%');
      setImportantStyle(el, 'min-width', '100%');
    });

    body.querySelectorAll('pre, code').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'white-space', 'pre-wrap');
      setImportantStyle(el, 'overflow-wrap', 'anywhere');
      setImportantStyle(el, 'word-break', 'break-all');
      setImportantStyle(el, 'overflow-x', 'visible');
    });

    body.querySelectorAll('code *').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'white-space', 'inherit');
      setImportantStyle(el, 'overflow-wrap', 'inherit');
      setImportantStyle(el, 'word-break', 'inherit');
    });
  }

  function hasRealFocusOverflow(body) {
    if (!(body instanceof HTMLElement)) return false;

    const bodyRect = body.getBoundingClientRect();
    const targets = [
      body,
      ...body.querySelectorAll('.vb-card, .vb-card-body, pre, code')
    ].filter((el) => el instanceof HTMLElement);

    return targets.some((el) => {
      const rect = el.getBoundingClientRect();
      const hasScrollOverflow =
        el.scrollWidth > el.clientWidth + FOCUS_OVERFLOW_THRESHOLD;
      const leaksRight =
        rect.right > bodyRect.right + FOCUS_OVERFLOW_THRESHOLD;
      const leaksLeft =
        rect.left < bodyRect.left - FOCUS_OVERFLOW_THRESHOLD;
      return hasScrollOverflow || leaksRight || leaksLeft;
    });
  }

  function enableFocusOverflowFallback(body) {
    if (!(body instanceof HTMLElement)) return;

    body.classList.add('vb-horizontal-overflow');
    setImportantStyle(body, 'overflow-x', 'auto');
    setImportantStyle(body, 'overflow-y', 'auto');

    body.querySelectorAll('.vb-card, .vb-card-body, pre, code')
      .forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        setImportantStyle(el, 'width', 'max-content');
        setImportantStyle(el, 'max-width', 'none');
        setImportantStyle(el, 'min-width', '100%');
        setImportantStyle(el, 'overflow-x', 'visible');
      });

    body.querySelectorAll('pre, code').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      setImportantStyle(el, 'white-space', 'pre');
    });
  }

  function ensureNoHiddenCodeOverflow(body) {
    applyFocusWrapDefaults(body);
    if (hasRealFocusOverflow(body)) {
      enableFocusOverflowFallback(body);
    }
  }

  function scheduleOverflowAudit(body) {
    requestAnimationFrame(() => {
      applyFocusWrapDefaults(body);
      requestAnimationFrame(() => ensureNoHiddenCodeOverflow(body));
    });
    setTimeout(() => ensureNoHiddenCodeOverflow(body), 240);
  }

  // ── Syntax highlighting preservation ────────────────────
  // ChatGPT applies token colors, weights, and styles via CSS classes.
  // outerHTML only captures already-inlined styles, so class-driven
  // computed styles are lost when the HTML is inserted into Win1's DOM.
  //
  // Fix: walk every element in the clone and bake all visually relevant
  // computed styles into inline style attributes before serialization.
  // This makes the exported HTML self-contained and visually faithful.
  //
  // Properties preserved per element:
  //   color, background-color       — token/block coloring
  //   font-weight, font-style       — bold/italic tokens
  //   text-decoration               — underline if used
  //   opacity                       — dimmed tokens in some themes
  //
  // Applied to: pre, code, and all descendants (spans, etc.)
  // Does NOT filter out any color — black and white are valid token colors.
  const VISUAL_PROPS = [
    'color',
    'background-color',
    'font-weight',
    'font-style',
    'text-decoration',
    'opacity',
    'font-family',
    'font-size',
    'line-height',
  ];

  // ══════════════════════════════════════════════════════════
  //  RECEIVER (Win2) — publish payload, no local overlay
  // ══════════════════════════════════════════════════════════
  function copyVisualStylesFromOriginal(originalRoot, clonedRoot) {
    if (
      !(originalRoot instanceof HTMLElement) ||
      !(clonedRoot instanceof HTMLElement)
    ) {
      return;
    }

    const copyOne = (originalEl, clonedEl) => {
      if (
        !(originalEl instanceof HTMLElement) ||
        !(clonedEl instanceof HTMLElement)
      ) {
        return;
      }

      const cs = getComputedStyle(originalEl);
      for (const prop of VISUAL_PROPS) {
        const val = cs.getPropertyValue(prop);
        if (!val) continue;
        setImportantStyle(clonedEl, prop, val);
      }
    };

    const pairChildren = (originalEl, clonedEl) => {
      copyOne(originalEl, clonedEl);

      const originalKids = Array.from(originalEl.children)
        .filter((el) => el instanceof HTMLElement);
      const clonedKids = Array.from(clonedEl.children)
        .filter((el) => el instanceof HTMLElement);
      const count = Math.min(originalKids.length, clonedKids.length);

      for (let i = 0; i < count; i++) {
        pairChildren(originalKids[i], clonedKids[i]);
      }
    };

    pairChildren(originalRoot, clonedRoot);
  }

  function buildFocusPayloadClone(pre) {
    const clone = pre.cloneNode(true);
    copyVisualStylesFromOriginal(pre, clone);
    removeUnwantedUi(clone);
    normalizeClone(clone);
    forceCloneWrapping(clone);
    return clone;
  }

  function handleFocusClickReceiver(pre) {
    const lang  = getLanguageLabel(pre);
    const clone = buildFocusPayloadClone(pre);

    // Bake all computed visual styles into inline attributes before
    // serializing so Win1 can render the same highlighted appearance
    // without access to Win2's CSS context.

    const html  = clone.outerHTML;
    const preId = pre.getAttribute('data-vb-pre-id') || '';

    const payload = {
      id:        `focus-${Date.now()}`,
      updatedAt: Date.now(),
      language:  lang,
      html:      html,
      sourceId:  preId,
    };

    try {
      localStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[VB Focus] Failed to publish payload:', err);
    }
    // No local overlay opened — Win1 handles display.
  }

  // ══════════════════════════════════════════════════════════
  //  SENDER (Win1) — listen, cache, render overlay
  // ══════════════════════════════════════════════════════════
  let cachedPayload = null;

  function renderOverlayContent(payload) {
    if (!payload) return;
    const overlay = getOverlay();
    const body = overlay.querySelector('[data-vb-body]');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(buildCardFromPayload(payload));
    scheduleOverflowAudit(body);
    body.scrollTop = 0;
    const title = overlay.querySelector('.vb-title');
    if (title) title.textContent = `Code Focus — ${payload.language || 'Code'}`;
  }

  function openSenderOverlay(payload) {
    if (!payload) return;
    renderOverlayContent(payload);
    const overlay = getOverlay();
    overlay.classList.add('vb-open');
    document.body.classList.add('vb-focus-open');
    localStorage.setItem(FOCUS_OPEN_KEY, '1');
  }

  function toggleSenderOverlay() {
    if (isOverlayOpen()) {
      closeOverlay();
    } else if (cachedPayload) {
      openSenderOverlay(cachedPayload);
    }
    // If no cached payload yet, do nothing (no block focused in Win2 yet).
  }

  function initSender() {
    localStorage.setItem(FOCUS_OPEN_KEY, '0');

    // Seed cache from any existing payload so first Alt+1 works immediately.
    try {
      const raw = localStorage.getItem(PAYLOAD_KEY);
      if (raw) cachedPayload = JSON.parse(raw);
    } catch (_) {}

    // Listen for payloads published by Win2.
    // Always auto-open overlay on every new payload — even if closed.
    window.addEventListener('storage', (e) => {
      if (e.key !== PAYLOAD_KEY) return;
      try {
        const payload = JSON.parse(e.newValue);
        if (!payload?.id) return;
        cachedPayload = payload;
        // Always open/update: auto-opens if closed, replaces content if open.
        openSenderOverlay(cachedPayload);
      } catch (_) {}
    });

    // Ctrl+Shift+F11 — manual visibility toggle (AHK Alt+1).
    // If open → close. If closed → open latest cached payload.
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F11') {
        e.preventDefault();
        toggleSenderOverlay();
      }
    });

    getOverlay(); // Ensure shell exists at startup.
  }

  // ══════════════════════════════════════════════════════════
  //  BUTTON ATTACHMENT
  // ══════════════════════════════════════════════════════════
  function buttonLabel(btn) {
    return ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).trim();
  }

  function isCodeActionButton(btn) {
    return /copy|edit|run/i.test(buttonLabel(btn));
  }

  function visibleRect(el) {
    const r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0) ? r : null;
  }

  function distanceScore(preRect, btnRect) {
    return Math.min(
      Math.abs(btnRect.top - preRect.top),
      Math.abs(btnRect.bottom - preRect.top)
    ) * 3 + Math.min(
      Math.abs(btnRect.right - preRect.right),
      Math.abs(btnRect.left  - preRect.left)
    );
  }

  function findBestActionBar(pre) {
    const preRect = visibleRect(pre);
    if (!preRect) return null;

    const buttons = [...document.querySelectorAll('button')]
      .filter((btn) => isCodeActionButton(btn))
      .filter((btn) =>
        pre.closest('[data-message-author-role]') ===
        btn.closest('[data-message-author-role]')
      );

    let best = null;
    for (const btn of buttons) {
      const btnRect = visibleRect(btn);
      if (!btnRect) continue;
      const isNearPre =
        btnRect.bottom >= preRect.top    - 80 &&
        btnRect.top    <= preRect.bottom + 80 &&
        btnRect.left   >= preRect.left   - 120 &&
        btnRect.right  <= preRect.right  + 180;
      if (!isNearPre) continue;

      let row = btn.parentElement;
      while (row && row !== document.body) {
        if (!(row instanceof HTMLElement)) { row = row.parentElement; continue; }
        const directButtons = [...row.querySelectorAll(':scope > button')]
          .filter((b) => isCodeActionButton(b));
        if (directButtons.length) {
          const rowRect = visibleRect(row);
          if (!rowRect) break;
          const score = distanceScore(preRect, rowRect);
          if (!best || score < best.score) best = { row, buttons: directButtons, score };
          break;
        }
        row = row.parentElement;
      }
    }
    return best;
  }

  function findBestInsertTarget(actionBarInfo) {
    if (!actionBarInfo) return null;
    const copyBtn = actionBarInfo.buttons.find((btn) => /copy/i.test(buttonLabel(btn)));
    if (copyBtn) return { type: 'after-copy', node: copyBtn };
    const lastBtn = actionBarInfo.buttons[actionBarInfo.buttons.length - 1];
    if (lastBtn) return { type: 'after-last', node: lastBtn };
    return { type: 'append', node: actionBarInfo.row };
  }

  function attachButton(pre) {
    if (!pre || pre.hasAttribute(READY_ATTR)) return;
    pre.setAttribute(READY_ATTR, '1');

    const actionBarInfo = findBestActionBar(pre);
    if (!actionBarInfo) return;
    const target = findBestInsertTarget(actionBarInfo);
    if (!target) return;

    const existingIds = new Set(
      [...actionBarInfo.row.querySelectorAll('.vb-focus-btn-inline')]
        .map((btn) => btn.getAttribute('data-vb-pre-id')).filter(Boolean)
    );

    const preId =
      pre.getAttribute('data-vb-pre-id') ||
      `vb-pre-${Math.random().toString(36).slice(2)}`;
    pre.setAttribute('data-vb-pre-id', preId);
    if (existingIds.has(preId)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vb-focus-btn-inline';
    btn.textContent = 'Focus';
    btn.setAttribute('data-vb-pre-id', preId);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Re-resolve role at click time in case bridge initialized after Focus.
      const currentRole = resolveRole() || resolvedRole;
      if (currentRole === 'receiver') {
        // Win2: publish to shared storage, do NOT open local overlay.
        handleFocusClickReceiver(pre);
      } else {
        // Win1 or unregistered tab: open local overlay directly.
        openLocalOverlay(pre);
      }
    });

    if (target.type === 'after-copy' || target.type === 'after-last') {
      target.node.insertAdjacentElement('afterend', btn);
    } else {
      target.node.appendChild(btn);
    }
  }

  // Local overlay for Win1 direct click or unregistered tabs.
  function openLocalOverlay(pre) {
    if (!pre || !(pre instanceof HTMLElement)) return;
    const lang  = getLanguageLabel(pre);
    const clone = buildFocusPayloadClone(pre);
    const overlay = getOverlay();
    const body = overlay.querySelector('[data-vb-body]');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(buildCardFromElement(clone, lang));
    scheduleOverflowAudit(body);
    overlay.classList.add('vb-open');
    document.body.classList.add('vb-focus-open');
    localStorage.setItem(FOCUS_OPEN_KEY, '1');
    body.scrollTop = 0;
    const title = overlay.querySelector('.vb-title');
    if (title) title.textContent = `Code Focus — ${lang}`;
  }

  // ── Rescan / observe ─────────────────────────────────────
  function rescanAll() {
    document.querySelectorAll('.vb-focus-btn-inline').forEach((btn) => btn.remove());
    document.querySelectorAll('pre').forEach((pre) => pre.removeAttribute(READY_ATTR));
    scan(document);
  }

  let rescanTimer = null;
  function scheduleRescan() {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(rescanAll, 250);
  }

  function scan(root = document) {
    root.querySelectorAll('pre').forEach((pre) => attachButton(pre));
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      let shouldRescan = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (
            node.matches('pre') || node.querySelector('pre') ||
            node.matches('button') || node.querySelector('button')
          ) { shouldRescan = true; break; }
        }
        if (shouldRescan) break;
      }
      if (shouldRescan) scheduleRescan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Entry point ──────────────────────────────────────────
  function init() {
    // Re-resolve role at init time — bridge may have set sessionStorage
    // between module load and DOMContentLoaded.
    resolvedRole = resolveRole();

    injectStyles();
    getOverlay();
    if (resolvedRole === 'sender') initSender();
    rescanAll();
    observe();
    window.addEventListener('resize', scheduleRescan);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
