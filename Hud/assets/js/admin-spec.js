(() => {
  'use strict';

  const host = document.getElementById('admin-spec-root');
  const template = document.getElementById('admin-spec-template');
  if (!host || !template || !host.attachShadow) return;

  // Keep the supplied full mockup's CSS inside its own tree. The game HUD,
  // dialogs and map must not inherit generic selectors such as .row or .blue.
  const root = host.attachShadow({ mode: 'open' });
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'assets/css/admin-spec.css?v=3';
  root.appendChild(stylesheet);
  root.appendChild(template.content.cloneNode(true));

  const $ = id => root.getElementById(id);
  const panel = $('infoPanel');
  const dock = $('commandDock');
  const grid = $('buttonGrid');
  const toast = $('toast');
  const reopen = $('reopenButton');
  const chatFrame = document.getElementById('spec-chat-frame');
  let chatFrameReady = false;
  let pendingChatOpen = false;
  function openSpecChat() {
    if (!chatFrame) return;
    if (!chatFrameReady) { pendingChatOpen = true; return; }
    chatFrame.contentWindow.postMessage({ type: 'spec-chat-open' }, '*');
  }
  const details = document.createElement('div');
  details.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.65);align-items:center;justify-content:center;font-family:Arial,sans-serif;pointer-events:auto';
  details.innerHTML = '<div style="width:min(760px,90vw);max-height:80vh;overflow:auto;background:#17191e;color:#fff;border:1px solid #6c717b;border-radius:12px;padding:24px;box-shadow:0 12px 40px #000"><button type="button" style="float:right;background:#c33;color:white;border:0;border-radius:6px;padding:8px 14px;cursor:pointer">Закрыть</button><h2 style="margin:0 0 18px">Информация о наказаниях</h2><pre style="white-space:pre-wrap;font:15px/1.6 Arial,sans-serif;margin:0"></pre></div>';
  root.appendChild(details);
  details.querySelector('button').addEventListener('click', () => { details.style.display = 'none'; });
  document.addEventListener('keydown', event => {
    if (!visible) return;
    if (details.style.display === 'flex') {
      if (event.key === 'Escape') { event.preventDefault(); details.style.display = 'none'; }
      return;
    }
    if ((event.keyCode === 84 || event.keyCode === 117) && chatFrame) {
      event.preventDefault();
      event.stopPropagation();
      openSpecChat();
    }
  }, true);
  window.addEventListener('message', event => {
    if (!chatFrame || event.source !== chatFrame.contentWindow) return;
    const data = event.data || {};
    if (data.type === 'spec-chat-ready') {
      chatFrameReady = true;
      if (pendingChatOpen && visible) { pendingChatOpen = false; openSpecChat(); }
    } else if (data.type === 'spec-chat-submit' && typeof data.message === 'string' && window.cef)
      window.cef.emit('aspec:chat', data.message);
    else if (data.type === 'spec-chat-input' && window.cef) {
      chatFrame.style.pointerEvents = data.active ? 'auto' : 'none';
      window.cef.emit('aspec:chatfocus', data.active ? '1' : '0');
    }
  });
  const stats = {
    id: 0, name: 'Игрок', role: 'Игрок', hp: 0, armor: 0, lvl: 0,
    fraction: 'Гражданский', family: 'Нет', veh: 'Нет', wanted: 0,
    greenZone: 'Нет', virtualWorld: 0, speed: 0, fps: 0, ping: 0
  };
  let toastTimer;
  let visible = false;

  function update(data) {
    if (!data || typeof data !== 'object') return;
    Object.assign(stats, data);
    $('playerName').textContent = String(stats.name ?? 'Игрок');
    $('playerId').textContent = String(stats.id ?? 0);
    const role = String(stats.role ?? 'Игрок');
    const roleKey = role.toLocaleLowerCase('ru');
    const roleNode = $('playerRole');
    roleNode.textContent = role;
    roleNode.className = 'role-badge ' +
      (roleKey.includes('админ') || roleKey === 'admin' ? 'role-admin' :
        roleKey.includes('ютуб') || roleKey.includes('youtube') ? 'role-youtuber' : 'role-player');
    $('hp').textContent = String(stats.hp ?? 0);
    $('armor').textContent = String(stats.armor ?? 0);
    $('level').textContent = String(stats.lvl ?? 0);
    $('fraction').textContent = String(stats.fraction ?? 'Нет');
    $('family').textContent = String(stats.family ?? 'Нет');
    $('vehicle').textContent = String(stats.veh ?? 'Нет');
    $('wanted').textContent = String(stats.wanted ?? 0);
    $('greenZone').textContent = String(stats.greenZone ?? 'Нет');
    $('virtualWorld').textContent = String(stats.virtualWorld ?? 0);
    $('speed').textContent = String(stats.speed ?? 0);
    $('fps').textContent = String(stats.fps ?? 0);
    $('ping').textContent = String(stats.ping ?? 0);
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1500);
  }

  function sendAction(action) {
    if (!visible || !window.cef || typeof window.cef.emit !== 'function') return;
    window.cef.emit('aspec:action', action);
  }
  root.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => sendAction(button.dataset.action));
  });
  $('expandButton').addEventListener('click', () => {
    const expanded = grid.classList.toggle('expanded');
    dock.classList.toggle('with-name', expanded);
  });
  $('hideInfo').addEventListener('click', () => panel.classList.toggle('is-hidden'));
  $('closeButton').addEventListener('click', () => {
    sendAction('exit');
  });
  reopen.addEventListener('click', () => {
    dock.classList.remove('is-closed');
    panel.classList.remove('is-hidden');
    reopen.classList.remove('visible');
  });
  document.addEventListener('keydown', event => {
    if (visible && event.key === 'Control' && !event.repeat) panel.classList.toggle('is-hidden');
  });

  function clampPanel(left, top) {
    const margin = 8;
    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, innerWidth - panel.offsetWidth - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, innerHeight - panel.offsetHeight - margin))
    };
  }
  try {
    const saved = JSON.parse(localStorage.getItem('aspec-info-position-v2') || 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      const point = clampPanel(saved.left, saved.top);
      panel.style.left = `${point.left}px`;
      panel.style.top = `${point.top}px`;
      panel.style.bottom = 'auto';
    }
  } catch (_) { /* Local storage can be disabled in game CEF. */ }
  const dragHandle = panel.querySelector('h1');
  let dragState = null;
  dragHandle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    dragState = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    panel.classList.add('is-dragging');
    dragHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  dragHandle.addEventListener('pointermove', event => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const point = clampPanel(event.clientX - dragState.dx, event.clientY - dragState.dy);
    panel.style.left = `${point.left}px`;
    panel.style.top = `${point.top}px`;
    panel.style.bottom = 'auto';
  });
  const finishDrag = event => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState = null;
    panel.classList.remove('is-dragging');
    try {
      const rect = panel.getBoundingClientRect();
      localStorage.setItem('aspec-info-position-v2', JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (_) { /* Position still works for this session. */ }
  };
  dragHandle.addEventListener('pointerup', finishDrag);
  dragHandle.addEventListener('pointercancel', finishDrag);

  update(stats);
  let frames = 0;
  let lastFrame = performance.now();
  function frame(now) {
    if (visible) {
      frames++;
      if (now - lastFrame >= 1000) {
        update({ fps: Math.round(frames * 1000 / (now - lastFrame)) });
        frames = 0;
        lastFrame = now;
      }
    } else {
      frames = 0;
      lastFrame = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function onShow() {
    if (visible) return;
    visible = true;
    host.style.display = 'block';
    dock.classList.remove('is-closed');
    panel.classList.remove('is-hidden');
    reopen.classList.remove('visible');
    if (chatFrame) { chatFrame.style.display = 'block'; chatFrame.style.pointerEvents = 'none'; }
  }
  function onHide() {
    visible = false;
    host.style.display = 'none';
    details.style.display = 'none';
    if (chatFrame) { chatFrame.style.display = 'none'; chatFrame.style.pointerEvents = 'none'; }
  }
  function bindBridge() {
    if (!window.cef || typeof window.cef.on !== 'function') return false;
    window.cef.on('aspec:show', onShow);
    window.cef.on('aspec:hide', onHide);
    window.cef.on('aspec:chat-open', () => {
      if (visible) openSpecChat();
    });
    window.cef.on('send:chat:message', (color, message, category) => {
      if (chatFrame && visible)
        chatFrame.contentWindow.postMessage({ type: 'spec-chat-message', color, message, category }, '*');
    });
    window.cef.on('aspec:status', message => notify(String(message ?? '')));
    window.cef.on('aspec:details-title', title => {
      details.querySelector('h2').textContent = String(title ?? 'Информация');
    });
    window.cef.on('aspec:details', message => {
      details.querySelector('pre').textContent = String(message ?? '');
      details.style.display = 'flex';
    });
    window.cef.on('aspec:title', value => {
      const title = String(value ?? '');
      const match = title.match(/^(.*) \[(\d+)\]$/);
      update(match ? { name: match[1], id: Number(match[2]) } : { name: title });
    });
    window.cef.on('aspec:role', value => update({ role: Number(value) ? 'Администратор' : 'Игрок' }));
    const fields = {
      hp: 'hp', armour: 'armor', level: 'lvl', faction: 'fraction',
      family: 'family', vehicle: 'veh', wanted: 'wanted', world: 'virtualWorld',
      speed: 'speed', ping: 'ping'
    };
    Object.keys(fields).forEach(key => {
      window.cef.on('aspec:' + key, value => update({ [fields[key]]: value }));
    });
    window.cef.on('aspec:green', value => update({ greenZone: Number(value) ? 'Да' : 'Нет' }));
    return true;
  }
  if (!bindBridge()) {
    const retry = setInterval(() => { if (bindBridge()) clearInterval(retry); }, 250);
  }
})();
