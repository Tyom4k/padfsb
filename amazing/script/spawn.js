(() => {
  const options = document.getElementById('options');
  const start = document.getElementById('start');
  const view = document.getElementById('map-view');
  const world = document.getElementById('map-world');
  const markerLast = document.getElementById('marker-last');
  const markerOrg = document.getElementById('marker-org');
  const markerDefault = document.getElementById('marker-default');
  const emit = (event, value) => window.cef && typeof window.cef.emit === 'function' && window.cef.emit(event, String(value));

  const mapImg = document.getElementById('sa-map-img');

  // КАЛИБРОВКА: какие игровые координаты соответствуют краям картинки sa-map.png.
  // Сейчас считается, что картинка целиком = весь мир (-3000..3000 по обеим осям).
  // Если метки стоят не там, подправьте эти 4 числа.
  const BOUNDS = { minX: -3000, maxX: 3000, minY: -3000, maxY: 3000 };

  const map = { x: 0, y: 0, scale: 1 };

  function layoutWorld() {
    const rect = view.getBoundingClientRect();
    const ok = mapImg && mapImg.complete && mapImg.naturalWidth > 0 && mapImg.style.display !== 'none';
    const aspect = ok ? mapImg.naturalWidth / mapImg.naturalHeight : 1;
    const width = Math.max(rect.width, rect.height * aspect);
    world.style.width = `${width}px`;
    world.style.height = `${width / aspect}px`;
  }
  // Точки, которые реально лежат на карте мира. Приходят с сервера событием spawn:points.
  let points = { lastOk: true, orgOk: true, defX: 1916.393, defY: 2147.636 };
  let selected = 1;
  let state = { hasLast: false, lastX: 0, lastY: 0, hasOrg: false, orgX: 0, orgY: 0 };
  let dragging = false;
  let lastPointer = { x: 0, y: 0 };

  function worldToPercent(x, y) {
    return {
      left: Math.max(0, Math.min(100, ((Number(x) - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX)) * 100)),
      top: Math.max(0, Math.min(100, (1 - ((Number(y) - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY))) * 100))
    };
  }

  function placeMarker(el, visible, x, y) {
    if (!visible) {
      el.hidden = true;
      return;
    }
    const pos = worldToPercent(x, y);
    el.style.left = `${pos.left}%`;
    el.style.top = `${pos.top}%`;
    el.hidden = false;
  }

  function clampMap() {
    // карта всегда закрывает весь экран, пустых краёв нет
    const rect = view.getBoundingClientRect();
    map.x = Math.min(0, Math.max(rect.width - world.offsetWidth * map.scale, map.x));
    map.y = Math.min(0, Math.max(rect.height - world.offsetHeight * map.scale, map.y));
  }

  function applyTransform() {
    clampMap();
    world.style.transform = `translate(${map.x}px, ${map.y}px) scale(${map.scale})`;
  }

  function focusWorld(x, y) {
    const pos = worldToPercent(x, y);
    const rect = view.getBoundingClientRect();
    map.scale = Math.max(map.scale, 1.45);
    map.x = rect.width / 2 - (pos.left / 100) * world.offsetWidth * map.scale;
    map.y = rect.height / 2 - (pos.top / 100) * world.offsetHeight * map.scale;
    applyTransform();
  }

  function focusSelection() {
    markerLast.classList.toggle('active', selected === 0);
    markerOrg.classList.toggle('active', selected === 2);
    markerDefault.classList.toggle('active', selected === 1);
    if (selected === 0 && state.hasLast && points.lastOk) focusWorld(state.lastX, state.lastY);
    else if (selected === 2 && state.hasOrg && points.orgOk) focusWorld(state.orgX, state.orgY);
    else if (selected === 1) focusWorld(points.defX, points.defY);
  }

  function render() {
    const entries = [
      { id: 0, title: 'Последнее место', sub: 'Продолжить с места выхода', disabled: !state.hasLast },
      { id: 1, title: 'Место по умолчанию', sub: 'Безопасная стартовая точка' },
      { id: 2, title: 'Спавн на организации', sub: 'База вашей фракции', disabled: !state.hasOrg }
    ];
    if (entries.find(item => item.id === selected && item.disabled)) {
      selected = state.hasLast ? 0 : 1;
    }
    options.innerHTML = '';
    entries.forEach(item => {
      const button = document.createElement('button');
      button.className = `option${item.id === selected ? ' selected' : ''}`;
      button.disabled = item.disabled;
      button.innerHTML = `${item.title}<small>${item.sub}</small>`;
      button.onclick = () => {
        selected = item.id;
        render();
        focusSelection();
      };
      options.appendChild(button);
    });
  }

  function updatePoints(lastOk, orgOk, defX, defY) {
    points = {
      lastOk: Boolean(Number(lastOk)),
      orgOk: Boolean(Number(orgOk)),
      defX: Number(defX) || points.defX,
      defY: Number(defY) || points.defY
    };
  }

  function updateFromServer(hasLast, lastX, lastY, hasOrg, orgX, orgY) {
    state = {
      hasLast: Boolean(Number(hasLast)),
      lastX: Number(lastX) || 0,
      lastY: Number(lastY) || 0,
      hasOrg: Boolean(Number(hasOrg)),
      orgX: Number(orgX) || 0,
      orgY: Number(orgY) || 0
    };
    placeMarker(markerLast, state.hasLast && points.lastOk, state.lastX, state.lastY);
    placeMarker(markerOrg, state.hasOrg && points.orgOk, state.orgX, state.orgY);
    placeMarker(markerDefault, true, points.defX, points.defY);
    selected = state.hasLast ? 0 : (state.hasOrg ? 2 : 1);
    start.disabled = false;
    render();
    focusSelection();
  }

  markerLast.onclick = () => { if (!state.hasLast) return; selected = 0; render(); focusSelection(); };
  markerOrg.onclick = () => { if (!state.hasOrg) return; selected = 2; render(); focusSelection(); };

  view.addEventListener('pointerdown', event => {
    if (event.target.closest('.marker')) return;
    dragging = true;
    view.classList.add('dragging');
    lastPointer = { x: event.clientX, y: event.clientY };
    view.setPointerCapture(event.pointerId);
  });
  view.addEventListener('pointermove', event => {
    if (!dragging) return;
    map.x += event.clientX - lastPointer.x;
    map.y += event.clientY - lastPointer.y;
    lastPointer = { x: event.clientX, y: event.clientY };
    applyTransform();
  });
  view.addEventListener('pointerup', () => {
    dragging = false;
    view.classList.remove('dragging');
  });
  view.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = view.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - map.x) / map.scale;
    const worldY = (cursorY - map.y) / map.scale;
    const next = Math.min(3.2, Math.max(1, map.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
    map.scale = next;
    map.x = cursorX - worldX * map.scale;
    map.y = cursorY - worldY * map.scale;
    applyTransform();
  }, { passive: false });

  start.onclick = () => {
    start.disabled = true;
    emit('spawn:select', selected);
    // If the bridge drops the click, allow a retry instead of leaving the
    // selector permanently disabled.
    setTimeout(() => {
      if (document.visibilityState !== 'hidden') start.disabled = false;
    }, 2500);
  };

  let bridgeBound = false;
  function bindSpawnBridge() {
    if (bridgeBound || !window.cef || typeof window.cef.on !== 'function') return false;
    window.cef.on('spawn:points', updatePoints);
    window.cef.on('spawn:show', updateFromServer);
    bridgeBound = true;
    emit('spawn:ready', 'ready');
    return true;
  }
  bindSpawnBridge();
  const bridgeRetry = setInterval(() => {
    if (bindSpawnBridge()) clearInterval(bridgeRetry);
  }, 100);
  setTimeout(() => clearInterval(bridgeRetry), 15000);
  const relayout = () => { layoutWorld(); focusSelection(); };
  window.addEventListener('resize', relayout);
  if (mapImg) {
    mapImg.addEventListener('load', relayout);
    mapImg.addEventListener('error', relayout);
  }
  layoutWorld();
  applyTransform();
  render();
})();
