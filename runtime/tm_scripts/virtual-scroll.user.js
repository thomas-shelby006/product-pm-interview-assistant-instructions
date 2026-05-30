// ==UserScript==
// @name         ChatGPT Virtual Scroll (PWA Scroll-Relative Fix)
// @namespace    https://github.com/9ghtX/ChatGPT-Virtual-Scroll
// @version      2.8.1-pwa
// @description  Optimizes long ChatGPT threads. Uses scroll-relative anchor detection for PWA/app-mode windows.
// @author       9ghtX + True Fix
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    http://127.0.0.1:8123/tm_scripts/virtual-scroll.user.js
// @downloadURL  http://127.0.0.1:8123/tm_scripts/virtual-scroll.user.js
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // Verification after enabling only this virtual-scroll script:
  // Run in DevTools:
  // document.querySelectorAll('section[data-testid^="conversation-turn"]').length
  // Expected:
  // - Near MAX_TURNS when at bottom.
  // - Increases when scrolling up.
  // - Drops again when scrolling down.

  // ---------------- settings ----------------
  const MAX_TURNS = 6;
  const MIN_TURNS = 4;
  const PRUNE_BATCH = 3;
  const RESTORE_BATCH = 3;

  const RESTORE_ANCHOR_INDEX = 1;
  const PRUNE_ANCHOR_INDEX = 3;

  const INIT_TO_BOTTOM = true;

  const SUPPRESS_DIR_AFTER_PRUNE_MS = 120;
  const SUPPRESS_DIR_AFTER_RESTORE_MS = 140;
  const PRUNE_LOCK_AFTER_RESTORE_MS = 220;
  const RESTORE_LOCK_AFTER_PRUNE_MS = 120;

  // ---------------- state ----------------
  let scroller = null;
  let root = null;
  let mo = null;
  let ticking = false;
  let internalMutation = false;
  let initialized = false;
  let lastScrollTop = 0;
  let moTimeout = null;

  let suppressDirectionUntil = 0;
  let pruneLockUntil = 0;
  let restoreLockUntil = 0;

  let userIntent = "idle";
  let userIntentUntil = 0;

  const topBuffer = [];

  // ---------------- utils ----------------
  function now() { return performance.now(); }

  function isElement(node) { return node && node.nodeType === Node.ELEMENT_NODE; }

  function isTurn(node) { return isElement(node) && node.matches("section[data-testid^='conversation-turn']"); }

  function isScrollable(el) {
    if (!el || el === document.documentElement) return false;
    const cs = getComputedStyle(el);
    return cs.overflowY === "auto" || cs.overflowY === "scroll";
  }

  function findScrollerFromTurn(turn) {
    let el = turn;
    while (el && el !== document.documentElement) {
      if (isScrollable(el)) return el;
      el = el.parentElement;
    }
    return document.querySelector('div[class*="scrollbar-gutter"]') || document.scrollingElement;
  }

  function getTurns() {
    if (!root || !root.isConnected) {
      const anyTurn = document.querySelector("section[data-testid^='conversation-turn']");
      if (anyTurn) {
        root = findRoot(anyTurn);
        if (root) observeRoot();
      }
    }
    if (!root) return [];
    return [...root.children].filter(isTurn);
  }

  function getOffsetTopByChain(el) {
    let top = 0;
    let node = el;

    while (node && node instanceof HTMLElement) {
      top += node.offsetTop || 0;
      node = node.offsetParent;
    }

    return top;
  }

  function isDocumentScroller(el) {
    return el === document.scrollingElement ||
      el === document.documentElement ||
      el === document.body;
  }

  function getScrollerScrollTop() {
    if (!scroller) return 0;
    if (isDocumentScroller(scroller)) {
      return window.scrollY || document.documentElement.scrollTop ||
        document.body.scrollTop || scroller.scrollTop || 0;
    }
    return scroller.scrollTop || 0;
  }

  function getTurnTopInScroller(turn) {
    if (!turn) return 0;

    const turnTop = getOffsetTopByChain(turn);
    if (!scroller || isDocumentScroller(scroller)) return turnTop;

    return turnTop - getOffsetTopByChain(scroller);
  }

  function getAnchorTurn() {
    const turns = getTurns();
    if (!turns.length) return null;

    const scrollTop = getScrollerScrollTop();

    for (const t of turns) {
      const top = getTurnTopInScroller(t);
      const bottom = top + (t.offsetHeight || 0);
      if (bottom > scrollTop + 1) return t;
    }
    return turns[turns.length - 1];
  }

  function getAnchorInfo() {
    const turns = getTurns();
    if (!turns.length) return null;

    const anchor = getAnchorTurn();
    if (!anchor) return null;

    return { anchor, turns, index: turns.indexOf(anchor) };
  }

  function captureAnchor() {
    const anchor = getAnchorTurn();
    if (!anchor) return null;
    return { el: anchor, top: getTurnTopInScroller(anchor) };
  }

  function restoreAnchor(snapshot) {
    if (!snapshot || !snapshot.el || !snapshot.el.isConnected) return;
    const delta = getTurnTopInScroller(snapshot.el) - snapshot.top;
    if (Math.abs(delta) > 0.5) scroller.scrollTop += delta;
  }

  function withInternalMutation(fn) {
    internalMutation = true;
    try { return fn(); } finally { internalMutation = false; }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
      lastScrollTop = scroller.scrollTop;
    });
  }

  function setUserIntent(dir, ttl = 220) {
    userIntent = dir;
    userIntentUntil = now() + ttl;
  }

  function getUserIntent() { return now() < userIntentUntil ? userIntent : "idle"; }

  function suppressDirection(ms) {
    suppressDirectionUntil = now() + ms;
    lastScrollTop = scroller.scrollTop;
  }

  function lockPrune(ms) { pruneLockUntil = now() + ms; }
  function lockRestore(ms) { restoreLockUntil = now() + ms; }
  function isPruneLocked() { return now() < pruneLockUntil; }
  function isRestoreLocked() { return now() < restoreLockUntil; }

  function getDirection() {
    const intent = getUserIntent();
    if (intent !== "idle") {
      lastScrollTop = scroller.scrollTop;
      return intent;
    }
    if (now() < suppressDirectionUntil) {
      lastScrollTop = scroller.scrollTop;
      return "idle";
    }
    const current = scroller.scrollTop;
    const dir = current < lastScrollTop ? "up" : current > lastScrollTop ? "down" : "idle";
    lastScrollTop = current;
    return dir;
  }

  function findRoot(anyTurn) {
    if (!anyTurn) return null;
    let node = anyTurn.parentElement;
    let best = node;
    while (node && node !== document.body) {
      const directTurnChildren = [...node.children].filter(isTurn).length;
      if (directTurnChildren >= 1) best = node;
      const parent = node.parentElement;
      if (!parent) break;
      const parentDirectTurnChildren = [...parent.children].filter(isTurn).length;
      if (parentDirectTurnChildren >= directTurnChildren && parentDirectTurnChildren > 0) {
        node = parent;
      } else { break; }
    }
    return best;
  }

  function shouldRestoreTop() {
    if (!topBuffer.length || isRestoreLocked()) return false;
    const info = getAnchorInfo();
    return info && info.index <= RESTORE_ANCHOR_INDEX;
  }

  function shouldPruneTop() {
    if (isPruneLocked()) return false;
    const info = getAnchorInfo();
    return info && info.turns.length > MAX_TURNS && info.index >= PRUNE_ANCHOR_INDEX;
  }

  function pruneTop() {
    if (!shouldPruneTop()) return false;
    const info = getAnchorInfo();
    if (!info) return false;

    const turns = info.turns;
    const anchor = info.anchor;
    const anchorIndex = info.index;

    const maxRemovableBeforeAnchor = Math.max(0, anchorIndex - RESTORE_ANCHOR_INDEX);
    const excess = turns.length - MIN_TURNS;
    const count = Math.min(PRUNE_BATCH, maxRemovableBeforeAnchor, excess);

    if (count <= 0) return false;

    const anchorSnapshot = captureAnchor();
    const removed = [];

    withInternalMutation(() => {
      for (let i = 0; i < count; i++) {
        const t = turns[i];
        if (!t || t === anchor) break;
        removed.push(t);
        t.remove();
      }
    });

    if (!removed.length) return false;
    for (const t of removed) topBuffer.push(t);

    restoreAnchor(anchorSnapshot);
    suppressDirection(SUPPRESS_DIR_AFTER_PRUNE_MS);
    lockRestore(RESTORE_LOCK_AFTER_PRUNE_MS);
    return true;
  }

  function restoreTop() {
    if (!shouldRestoreTop()) return false;
    const info = getAnchorInfo();
    if (!info) return false;

    const count = Math.min(RESTORE_BATCH, topBuffer.length);
    if (count <= 0) return false;

    const anchorSnapshot = captureAnchor();
    const toInsert = [];

    for (let i = 0; i < count; i++) {
      const node = topBuffer.pop();
      if (!node) break;
      toInsert.push(node);
    }

    if (!toInsert.length) return false;
    toInsert.reverse();

    withInternalMutation(() => {
      let insertBeforeNode = getTurns()[0] || null;
      for (const node of toInsert) root.insertBefore(node, insertBeforeNode);
    });

    restoreAnchor(anchorSnapshot);
    suppressDirection(SUPPRESS_DIR_AFTER_RESTORE_MS);
    lockPrune(PRUNE_LOCK_AFTER_RESTORE_MS);
    return true;
  }

  // FIX 1: The "Lazy Janitor" loop. Now loops until the backlog is completely cleared.
  function trimToWindowImmediately() {
    let guard = 0;
    while (guard < 100 && shouldPruneTop()) {
      if (!pruneTop()) break;
      guard++;
    }
  }

  function sync() {
    if (!initialized) return;
    if (!scroller || !scroller.isConnected) {
       initialized = false;
       init();
       return;
    }
    const direction = getDirection();
    const turns = getTurns();
    if (!turns.length) return;

    if (direction === "up") { restoreTop(); return; }

    // Aggressive prune while scrolling down or sitting idle
    if (direction === "down" || turns.length > MAX_TURNS + 2) {
        trimToWindowImmediately();
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      try { sync(); } finally { ticking = false; }
    });
  }

  function observeRoot() {
    if (mo) mo.disconnect();
    mo = new MutationObserver((mutations) => {
      if (internalMutation) return;

      let rootChanged = false;
      // FIX 2: CPU Shield. Only process mutations if a direct child (a chat message)
      // is added or removed. Ignore the syntax highlighting changes entirely.
      for (const m of mutations) {
        if (m.target === root) {
            rootChanged = true;
            break;
        }
      }

      if (!rootChanged) return;

      if (moTimeout) clearTimeout(moTimeout);
      moTimeout = setTimeout(() => {
          requestAnimationFrame(() => trimToWindowImmediately());
      }, 200);
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  function injectCSS() {
    const st = document.createElement("style");
    st.textContent = `
      section[data-testid^="conversation-turn"] {
        content-visibility: auto;
        contain-intrinsic-size: 800px;
      }
    `;
    document.head.appendChild(st);
  }

  function init() {
    const anyTurn = document.querySelector("section[data-testid^='conversation-turn']");
    if (!anyTurn) return false;

    scroller = findScrollerFromTurn(anyTurn);
    root = findRoot(anyTurn);

    if (!scroller || !root || scroller === document.documentElement) return false;

    injectCSS();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", (e) => {
      if (e.deltaY < 0) setUserIntent("up");
      else if (e.deltaY > 0) setUserIntent("down");
    }, { passive: true });

    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowUp" || k === "PageUp" || k === "Home") setUserIntent("up", 300);
      else if (k === "ArrowDown" || k === "PageDown" || k === "End" || k === " ") setUserIntent("down", 300);
    }, { passive: true });

    observeRoot();
    initialized = true;
    lastScrollTop = scroller.scrollTop;

    setTimeout(() => {
      scrollToBottom();
      requestAnimationFrame(() => trimToWindowImmediately());
    }, 400);

    return true;
  }

  const timer = setInterval(() => {
    if (init()) clearInterval(timer);
  }, 400);
})();
