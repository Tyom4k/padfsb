(function () {
  'use strict';
  let bridgeBound = false;
  let visible = false;
  let settingsVisible = false;
  let confirmation = '';
  let card, settings, afkTime;
  let openedAt = 0;

  function emit(action) {
    if (window.cef && typeof window.cef.emit === 'function') {
      window.cef.emit('esc:action', action);
    }
  }

  function render() {
    if (card) return;
    const root = document.createElement('div');
    root.id = 'sliv-esc';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Меню паузы');
    root.innerHTML = `<div class="sliv-esc-card">
      <div class="sliv-esc-head"><img class="sliv-esc-logo" src="assets/esc/logo.svg" alt="Амазинг Онлайн"><div class="sliv-esc-afk">AFK<small id="sliv-esc-afk-time">00:00</small></div></div>
      <nav class="sliv-esc-nav" aria-label="Действия">
        <button type="button" data-esc-action="resume" class="active">ПРОДОЛЖИТЬ</button>
        <button type="button" data-esc-action="settings">НАСТРОЙКИ</button>
        <button type="button" data-esc-action="reconnect">ПЕРЕПОДКЛЮЧИТЬСЯ</button>
        <button type="button" data-esc-action="quit">ВЫЙТИ ИЗ ИГРЫ</button>
      </nav></div>
      <section class="sliv-esc-settings" aria-label="Настройки"><h2 id="sliv-esc-panel-title">Настройки</h2><p id="sliv-esc-panel-text">Откроются игровые настройки CEF. Изменения сохраняются штатным меню F2.</p><button type="button" class="sliv-esc-back" data-esc-action="open-settings">ОТКРЫТЬ НАСТРОЙКИ</button><button type="button" class="sliv-esc-back" data-esc-action="back">НАЗАД</button></section>
      <footer class="sliv-esc-footer"><span>AMAZING ONLINE</span><span>ESC — закрыть</span></footer>`;
    document.body.appendChild(root);
    card = root;
    settings = root.querySelector('.sliv-esc-settings');
    afkTime = root.querySelector('#sliv-esc-afk-time');
    root.addEventListener('click', function (event) {
      const button = event.target.closest('[data-esc-action]');
      if (!button) return;
      const action = button.dataset.escAction;
      if (action === 'settings') {
        confirmation = '';
        root.querySelector('#sliv-esc-panel-title').textContent = 'Настройки';
        root.querySelector('#sliv-esc-panel-text').textContent = 'Откроются игровые настройки CEF. Изменения сохраняются штатным меню F2.';
        root.querySelector('[data-esc-action="open-settings"]').textContent = 'ОТКРЫТЬ НАСТРОЙКИ';
        settingsVisible = true; settings.classList.add('is-open'); return;
      }
      if (action === 'reconnect' || action === 'quit') {
        confirmation = action;
        root.querySelector('#sliv-esc-panel-title').textContent = action === 'quit' ? 'Выйти из игры?' : 'Переподключиться?';
        root.querySelector('#sliv-esc-panel-text').textContent = 'Эта кнопка пока отключена: безопасная работа в SA-MP 0.3.7-R3 ещё не проверена. Для выхода используйте штатную команду /q.';
        root.querySelector('[data-esc-action="open-settings"]').textContent = 'НАЗАД';
        settingsVisible = true; settings.classList.add('is-open'); return;
      }
      if (action === 'back') { confirmation = ''; settingsVisible = false; settings.classList.remove('is-open'); return; }
      if (action === 'open-settings' && confirmation) {
        confirmation = '';
        settingsVisible = false;
        settings.classList.remove('is-open');
        return;
      }
      emit(action);
    });
    document.addEventListener('keydown', function (event) {
      if (!visible || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (settingsVisible) {
        settingsVisible = false;
        settings.classList.remove('is-open');
      } else emit('resume');
    }, true);
  }

  function show() {
    render();
    visible = true;
    settingsVisible = false;
    confirmation = '';
    settings.classList.remove('is-open');
    openedAt = Date.now();
    card.classList.add('is-open');
    document.body.classList.add('sliv-esc-active');
  }
  function hide() {
    visible = false;
    if (!card) return;
    card.classList.remove('is-open');
    document.body.classList.remove('sliv-esc-active');
  }
  function bind() {
    if (bridgeBound || !window.cef || typeof window.cef.on !== 'function') return false;
    bridgeBound = true;
    window.cef.on('esc:show', show);
    window.cef.on('esc:hide', hide);
    return true;
  }
  setInterval(function () {
    if (visible && afkTime) {
      const seconds = Math.floor((Date.now() - openedAt) / 1000);
      afkTime.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    if (!bridgeBound) bind();
  }, 250);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
  if (window.location.search.indexOf('escPreview=1') !== -1) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
    else show();
  }
  bind();
})();
