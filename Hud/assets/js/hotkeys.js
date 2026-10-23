(function () {
  'use strict';
  // Tab / Esc -> server. The HUD browser must be created with
  // cef_always_listen_keys(playerid, <HUD browser>, true) on the server,
  // otherwise it does not receive keys while the game has focus.
  var last = 0;

  function emit(name) {
    if (window.cef && typeof window.cef.emit === 'function') window.cef.emit(name, '');
  }
  function typing(e) {
    var t = e.target || document.activeElement;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
  function overlayOpen() {
    if (document.body.classList.contains('sliv-esc-active')) return true;          // pause menu
    if (document.querySelector('.f2-open')) return true;                           // F2 settings
    try { if (typeof currentDialog !== 'undefined' && currentDialog) return true; } catch (e) {} // CEF dialog
    return false;
  }

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    // F13 is what tabremap.asi sends instead of Tab (so the SA-MP scoreboard never opens).
    var isTab = e.key === 'Tab' || e.key === 'F13';
    if (!isTab && e.key !== 'Escape') return;
    if (typing(e) || overlayOpen()) return;
    var now = Date.now();
    if (now - last < 250) return;
    last = now;
    e.preventDefault();
    emit(isTab ? 'hotkey:tab' : 'hotkey:esc');
  }, false);
})();
