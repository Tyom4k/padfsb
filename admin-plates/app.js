(() => {
  const input = document.querySelector('#plate-input');
  const previewMain = document.querySelector('#preview-main');
  const previewRegion = document.querySelector('#preview-region');
  const error = document.querySelector('.error');
  const allowedLetters = 'ABEKMHOPCTYX';
  const defaultRegion = '58';
  const regions = ['52', '58', '66', '77', '96'];
  let opened = false;
  let lastFrame = performance.now();
  let lastRestoreRequest = 0;
  const cyrillicMap = {
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
    'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X'
  };

  const emit = (event, value = '') => {
    if (window.cef && typeof window.cef.emit === 'function') window.cef.emit(event, value);
  };

  const normalize = (value) => value
    .toUpperCase()
    .split('')
    .map((char) => cyrillicMap[char] || char)
    .join('')
    .replace(new RegExp(`[^${allowedLetters}0-9]`, 'g'), '')
    .slice(0, 9);

  const splitPlate = (value) => {
    const normalized = normalize(value);
    const full = normalized.match(/^([ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2})(\d{2,3})$/);
    if (full) return { main: full[1], region: full[2], complete: normalized };

    const withoutRegion = normalized.match(/^([ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2})$/);
    if (withoutRegion) {
      return { main: withoutRegion[1], region: defaultRegion, complete: `${withoutRegion[1]}${defaultRegion}` };
    }
    return { main: normalized, region: defaultRegion, complete: '' };
  };

  const updatePreview = () => {
    const value = normalize(input.value);
    if (input.value !== value) input.value = value;

    const plate = splitPlate(value);
    previewMain.textContent = plate.main || 'T437YY';
    previewRegion.textContent = plate.region;
    error.textContent = '';
  };

  const randomItem = (value) => value[Math.floor(Math.random() * value.length)];
  const makeRandomPlate = () => `${randomItem(allowedLetters)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}${randomItem(allowedLetters)}${randomItem(allowedLetters)}${randomItem(regions)}`;

  const apply = () => {
    const plate = splitPlate(input.value);
    if (!plate.complete) {
      error.textContent = 'Формат: T437YY или T437YY58.';
      input.focus();
      return;
    }
    input.value = plate.complete;
    updatePreview();
    opened = false;
    emit('admin:plates:apply', plate.complete);
  };

  const repaint = () => {
    const panel = document.querySelector('.panel');
    if (!panel) return;
    const previous = panel.style.transform;
    panel.style.transform = `${previous || ''} translateZ(0.01px)`;
    void panel.offsetHeight;
    panel.style.transform = previous;
  };

  const requestRestore = () => {
    if (!opened) return;
    const now = performance.now();
    if (now - lastRestoreRequest < 400) return;
    lastRestoreRequest = now;
    repaint();
    emit('admin:plates:resume');
  };

  const watchFrames = (now) => {
    // requestAnimationFrame pauses while GTA is minimized. A long gap means
    // the game has just returned to the foreground even when Chromium did not
    // dispatch visibilitychange for its transparent window.
    if (opened && now - lastFrame > 700) requestRestore();
    lastFrame = now;
    requestAnimationFrame(watchFrames);
  };

  const show = () => {
    opened = true;
    lastRestoreRequest = performance.now();
    error.textContent = '';
    updatePreview();
    // Focus only after the server has received OnCefBrowserCreated and made
    // this cached browser visible. Focusing during page creation could steal
    // the game window and leave gta_sa.exe unresponsive.
    setTimeout(() => input.focus(), 50);
  };

  const restore = () => {
    if (!opened) return;
    repaint();
    setTimeout(() => input.focus(), 25);
  };

  const close = () => {
    opened = false;
    emit('admin:plates:close');
  };

  input.addEventListener('input', updatePreview);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') apply();
  });
  document.querySelector('.random').addEventListener('click', () => {
    input.value = makeRandomPlate();
    updatePreview();
  });
  document.querySelector('.apply').addEventListener('click', apply);
  document.querySelector('.cancel').addEventListener('click', close);
  document.querySelector('.close').addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.addEventListener('focus', requestRestore);
  window.addEventListener('pageshow', requestRestore);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) requestRestore();
  });

  if (window.cef && typeof window.cef.on === 'function') {
    window.cef.on('admin:plates:show', show);
    window.cef.on('admin:plates:restore', restore);
  }

  updatePreview();
  requestAnimationFrame(watchFrames);
})();
