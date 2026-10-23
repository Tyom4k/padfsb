(function () {
  'use strict';
  /* Absolute Online: Tab -> TAB-меню, Esc -> меню паузы (события обрабатывает мод) */
  var last = 0;
  function send(name) {
    var now = Date.now();
    if (now - last < 300) return;
    last = now;
    if (window.cef && typeof window.cef.emit === 'function') window.cef.emit(name, '');
  }
  function typing(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
  document.addEventListener('keydown', function (e) {
    if (e.repeat || typing(e.target)) return;
    if (document.body.classList.contains('sliv-esc-active')) return;
    if (e.key === 'Tab') { e.preventDefault(); send('key:tab'); }
    else if (e.key === 'Escape') { send('key:esc'); }
  }, true);
}());
