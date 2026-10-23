(() => {
    'use strict';

    const LEGACY_PLAYLIST_KEY = 'slivVehicleAudioTracks';
    const LEGACY_REPEAT_KEY = 'slivVehicleAudioRepeatMode';
    const PLAYLIST_KEY_PREFIX = 'slivVehicleAudioTracks:account:';
    const REPEAT_KEY_PREFIX = 'slivVehicleAudioRepeatMode:account:';
    const MAX_TRACKS = 30;
    const sources = new Map();

    let playlist = [];
    let libraryAccount = 0;
    let panelVehicle = 0;
    let worldPanel = false;
    let panelOpen = false;
    let panelUrl = '';
    let panelPlaying = false;
    let panelEnded = false;
    let panelPositionMs = 0;
    let panelVolume = 80;
    let panelDuration = 0;
    let repeatMode = 0;
    let volumeTimer = 0;
    let messageTimer = 0;
    let metadataToken = 0;
    let metadataAudio = null;
    let dragIndex = -1;
    let scrubbing = false;
    let scrubPositionMs = 0;
    let endedHandled = false;

    const icons = {
        play: '<path d="M8 5v14l11-7z"/>',
        playCircle: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14.5v-9l7 4.5-7 4.5z"/>',
        pauseCircle: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM11 16H8V8h3v8zm5 0h-3V8h3v8z"/>',
        previous: '<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>',
        next: '<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/>',
        repeat: '<path d="M7 7h9v3l4-4-4-4v3H7a5 5 0 0 0-5 5v2h2v-2a3 3 0 0 1 3-3zm10 10H8v-3l-4 4 4 4v-3h9a5 5 0 0 0 5-5v-2h-2v2a3 3 0 0 1-3 3z"/>',
        shuffle: '<path d="M16 3h5v5l-2-2-3.7 3.7-1.4-1.4L17.6 5H16V3zM3 6h3.6l10.9 10.9L16 18.4 5.8 8H3V6zm14.5 9.1 1.4 1.4L21 14.4V19h-5v-2h1.6l-2.1-2.1zM3 16h3.6l3.1-3.1 1.4 1.4L7.4 18H3v-2z"/>',
        volume: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>',
        power: '<path d="M11 2h2v10h-2V2zm5.7 3.3-1.4 1.4A7 7 0 1 1 8.7 6.7L7.3 5.3A9 9 0 1 0 16.7 5.3z"/>',
        cloud: '<path d="M19.35 10.04A7.49 7.49 0 0 0 5.3 8.04 6 6 0 0 0 6 20h13a5 5 0 0 0 .35-9.96zM13 12h3l-4 4-4-4h3V8h2v4z"/>'
    };

    const icon = name => `<svg class="va-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
    const validUrl = url => /^https?:\/\/\S+$/i.test(url) && !url.includes('|');
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);

    const emit = (event, value = '') => {
        if (worldPanel && String(event).startsWith('vehicleAudio:'))
            event = String(event).replace('vehicleAudio:', 'worldAudio:');
        if (window.cef && typeof window.cef.emit === 'function') window.cef.emit(event, String(value));
    };

    const formatTime = seconds => {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
        const whole = Math.floor(seconds);
        const minutes = Math.floor(whole / 60);
        return `${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    };

    const trackName = url => {
        if (!url) return 'Выберите';
        try {
            const parsed = new URL(url);
            const raw = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname);
            return raw.replace(/\.(mp3|ogg|wav|flac|m4a|aac|opus)(\?.*)?$/i, '') || parsed.hostname;
        } catch (_) {
            return 'Музыка из автомобиля';
        }
    };

    const trackArtist = url => {
        try { return new URL(url).hostname.replace(/^www\./, '').toUpperCase(); }
        catch (_) { return 'АВТОМОБИЛЬНАЯ АУДИОСИСТЕМА'; }
    };

    const normaliseTrack = value => {
        const url = typeof value === 'string' ? value : String(value && value.url || '');
        if (!validUrl(url)) return null;
        return {
            url,
            title: String(value && value.title || trackName(url)).slice(0, 96),
            subtitle: String(value && value.subtitle || trackArtist(url)).slice(0, 96),
            duration: clamp(value && value.duration, 0, 86400)
        };
    };

    const playlistStorageKey = () => `${PLAYLIST_KEY_PREFIX}${libraryAccount}`;
    const repeatStorageKey = () => `${REPEAT_KEY_PREFIX}${libraryAccount}`;
    const loadAccountLibrary = accountId => {
        accountId = Math.max(0, Math.trunc(Number(accountId) || 0));
        if (!accountId || accountId === libraryAccount) return;
        libraryAccount = accountId;
        playlist = [];
        repeatMode = 0;
        try {
            let storedText = localStorage.getItem(playlistStorageKey());
            // The first account opening the updated player receives the old
            // unscoped library once. It is then removed so another account on
            // the same PC can never inherit or browse it.
            if (storedText === null) {
                storedText = localStorage.getItem(LEGACY_PLAYLIST_KEY);
                if (storedText !== null) {
                    localStorage.setItem(playlistStorageKey(), storedText);
                    localStorage.removeItem(LEGACY_PLAYLIST_KEY);
                }
            }
            const stored = JSON.parse(storedText || '[]');
            if (Array.isArray(stored)) playlist = stored.map(normaliseTrack).filter(Boolean);
            let storedRepeat = localStorage.getItem(repeatStorageKey());
            if (storedRepeat === null) {
                storedRepeat = localStorage.getItem(LEGACY_REPEAT_KEY);
                if (storedRepeat !== null) {
                    localStorage.setItem(repeatStorageKey(), storedRepeat);
                    localStorage.removeItem(LEGACY_REPEAT_KEY);
                }
            }
            repeatMode = clamp(storedRepeat, 0, 2);
        } catch (_) {
            playlist = [];
            repeatMode = 0;
        }
        playlist = playlist.filter((track, index, all) => all.findIndex(item => item.url === track.url) === index).slice(-MAX_TRACKS);
    };

    const root = document.createElement('div');
    root.id = 'vehicle-audio-root';
    root.innerHTML = `
        <div class="va-backdrop"></div>
        <section class="va-player" aria-label="Автомобильная аудиосистема">
            <div class="va-playlist-wrap">
                <div class="va-playlist"></div>
            </div>
            <div class="va-console">
                <div class="va-now">
                    <span class="va-bars"><i></i><i></i><i></i></span>
                    <div class="va-now-copy"><strong class="va-track">Выберите</strong><span class="va-now-separator">—</span><small class="va-state">песню из списка</small></div>
                </div>
                <div class="va-timeline">
                    <span class="va-time va-current">00:00</span>
                    <input class="va-progress" type="range" min="0" max="1000" value="0" aria-label="Позиция трека">
                    <span class="va-time va-duration">ПОТОК</span>
                </div>
                <div class="va-media">
                    <button class="va-media-side va-repeat" type="button" title="Режим повтора">${icon('repeat')}</button>
                    <div class="va-center-controls">
                        <button class="va-skip va-prev" type="button" title="Предыдущий трек">${icon('previous')}</button>
                        <button class="va-play" type="button" title="Пауза / продолжить">${icon('playCircle')}</button>
                        <button class="va-skip va-next" type="button" title="Следующий трек">${icon('next')}</button>
                    </div>
                    <button class="va-media-side va-shuffle" type="button" title="Перемешать">${icon('shuffle')}</button>
                </div>
                <div class="va-mixer">
                    <div class="va-mix-row">
                        <span class="va-mix-icon">${icon('volume')}</span>
                        <input class="va-volume" type="range" min="0" max="100" value="80" aria-label="Громкость">
                        <span class="va-mix-value va-volume-value">80%</span>
                    </div>
                </div>
            </div>
            <div class="va-footer">
                <button class="va-stop" type="button">${icon('power')}<span>Выключить</span></button>
                <button class="va-add-toggle" type="button" title="Добавить прямую ссылку">${icon('cloud')}</button>
            </div>
            <div class="va-url-panel">
                <div class="va-url-head"><strong>Добавить аудиозапись</strong><button class="va-url-close" type="button" title="Закрыть">×</button></div>
                <label for="vehicle-audio-url">Вставьте прямую ссылку на MP3, OGG, AAC или интернет-радио. Ссылка сохранится в этом плеере.</label>
                <input id="vehicle-audio-url" class="va-url-input" type="text" maxlength="511" spellcheck="false" placeholder="https://site.ru/music.mp3">
                <button class="va-load" type="button">Добавить и включить</button>
            </div>
            <div class="va-message"></div>
        </section>`;
    document.body.appendChild(root);

    const ui = {
        backdrop: root.querySelector('.va-backdrop'),
        playlist: root.querySelector('.va-playlist'),
        track: root.querySelector('.va-track'),
        state: root.querySelector('.va-state'),
        current: root.querySelector('.va-current'),
        duration: root.querySelector('.va-duration'),
        progress: root.querySelector('.va-progress'),
        repeat: root.querySelector('.va-repeat'),
        previous: root.querySelector('.va-prev'),
        play: root.querySelector('.va-play'),
        next: root.querySelector('.va-next'),
        shuffle: root.querySelector('.va-shuffle'),
        volume: root.querySelector('.va-volume'),
        volumeValue: root.querySelector('.va-volume-value'),
        stop: root.querySelector('.va-stop'),
        addToggle: root.querySelector('.va-add-toggle'),
        urlPanel: root.querySelector('.va-url-panel'),
        urlClose: root.querySelector('.va-url-close'),
        url: root.querySelector('.va-url-input'),
        load: root.querySelector('.va-load'),
        message: root.querySelector('.va-message')
    };

    const setRangeFill = (input, percent) => input.style.setProperty('--va-fill', `${clamp(percent, 0, 100)}%`);
    const savePlaylist = () => {
        playlist = playlist.filter((track, index, all) => validUrl(track.url) && all.findIndex(item => item.url === track.url) === index).slice(-MAX_TRACKS);
        if (libraryAccount) localStorage.setItem(playlistStorageKey(), JSON.stringify(playlist));
    };

    const getTrack = url => playlist.find(track => track.url === url);
    const upsertTrack = (url, moveToEnd = false) => {
        if (!validUrl(url)) return null;
        let track = getTrack(url);
        if (!track) {
            track = normaliseTrack(url);
            playlist.push(track);
        } else if (moveToEnd) {
            playlist = playlist.filter(item => item !== track);
            playlist.push(track);
        }
        savePlaylist();
        return track;
    };

    const setMessage = (text, ok = false, timeout = 3200) => {
        clearTimeout(messageTimer);
        ui.message.textContent = String(text || '');
        ui.message.classList.toggle('va-ok', !!ok);
        ui.message.classList.toggle('va-visible', !!text);
        if (text && timeout > 0) messageTimer = setTimeout(() => ui.message.classList.remove('va-visible'), timeout);
    };

    const renderRepeat = () => {
        ui.repeat.classList.toggle('va-enabled', repeatMode !== 0);
        ui.repeat.classList.toggle('va-repeat-one', repeatMode === 1);
        ui.repeat.title = ['Повтор выключен', 'Повтор одного трека', 'Повтор всего списка'][repeatMode];
    };

    const renderPlaylist = (scrollActive = false) => {
        if (!playlist.length) {
            ui.playlist.innerHTML = '<div class="va-empty"><strong>Нет аудиозаписей</strong><span>Добавьте прямую ссылку на музыку. История сохранится на этом компьютере.</span><button class="va-empty-add" type="button">ДОБАВИТЬ</button></div>';
            return;
        }
        ui.playlist.innerHTML = playlist.map((track, index) => {
            const active = track.url === panelUrl;
            const duration = track.duration > 0 ? formatTime(track.duration) : 'ПОТОК';
            return `<div class="va-song${active ? ' va-active' : ''}" draggable="true" data-track="${index}">
                <button class="va-song-main" type="button" aria-pressed="${active}">
                    <span class="va-song-index"><span class="va-song-number">${index + 1}</span>${icon('playCircle')}</span>
                    <span class="va-song-copy"><strong class="va-song-title">${escapeHtml(track.title)}</strong><small class="va-song-subtitle">${escapeHtml(track.subtitle)}</small></span>
                    <span class="va-song-duration">${duration}</span>
                </button>
                <button class="va-song-remove" type="button" title="Удалить из списка" aria-label="Удалить ${escapeHtml(track.title)}">×</button>
            </div>`;
        }).join('');
        if (scrollActive) {
            const active = ui.playlist.querySelector('.va-active');
            if (active) active.scrollIntoView({ block: 'nearest' });
        }
    };

    const updateNowPlaying = () => {
        const track = getTrack(panelUrl);
        panelDuration = track ? track.duration : 0;
        ui.track.textContent = panelUrl ? (track ? track.title : 'Трек автомобиля') : 'Выберите';
        ui.state.textContent = panelUrl ? (panelEnded ? 'не работает' : (panelPlaying ? 'сейчас играет' : 'на паузе')) : 'песню из списка';
        ui.play.innerHTML = icon(panelPlaying ? 'pauseCircle' : 'playCircle');
        root.classList.toggle('va-playing', panelPlaying);
        root.classList.toggle('va-paused', !!panelUrl && !panelPlaying);
        ui.volume.value = String(panelVolume);
        ui.volumeValue.textContent = `${panelVolume}%`;
        setRangeFill(ui.volume, panelVolume);
    };

    const stopMetadataProbe = () => {
        metadataToken += 1;
        if (!metadataAudio) return;
        metadataAudio.removeAttribute('src');
        try { metadataAudio.load(); } catch (_) {}
        metadataAudio = null;
    };

    const probeDuration = (url, vehicleId = panelVehicle) => {
        stopMetadataProbe();
        const track = getTrack(url);
        const targetVehicle = Number(vehicleId) || 0;
        const reportDuration = duration => {
            if (!targetVehicle || !Number.isFinite(duration) || duration <= 0) return;
            const source = sources.get(targetVehicle);
            if (!source || source.url !== url) return;
            source.durationMs = Math.round(duration * 1000);
            emit('vehicleAudio:duration', `${targetVehicle}|${source.durationMs}`);
        };
        if (track && track.duration > 0) {
            reportDuration(track.duration);
            updateNowPlaying();
            return;
        }
        if (!track || typeof Audio !== 'function') {
            updateNowPlaying();
            return;
        }
        const token = metadataToken;
        const audio = new Audio();
        metadataAudio = audio;
        audio.preload = 'metadata';
        audio.muted = true;
        const finish = duration => {
            if (token !== metadataToken || metadataAudio !== audio) return;
            if (Number.isFinite(duration) && duration > 0 && duration <= 86400) {
                track.duration = duration;
                savePlaylist();
                renderPlaylist(false);
                updateNowPlaying();
                reportDuration(duration);
            }
            metadataAudio = null;
            audio.removeAttribute('src');
        };
        audio.addEventListener('loadedmetadata', () => finish(audio.duration), { once: true });
        audio.addEventListener('error', () => finish(0), { once: true });
        audio.src = url;
        try { audio.load(); } catch (_) { finish(0); }
        setTimeout(() => finish(0), 8000);
    };

    const createSource = vehicleId => {
        const source = { vehicleId, url: '', playing: false, ended: false, positionMs: 0, durationMs: 0, receivedAt: performance.now(), spatial: 0, volume: 80, bass: 0, revision: 0 };
        sources.set(vehicleId, source);
        return source;
    };

    const expectedPositionMs = source => {
        let position = source.positionMs;
        if (source.playing) position += performance.now() - source.receivedAt;
        return Math.max(0, position);
    };

    const renderPanelFromSource = source => {
        if (!source) return;
        const urlChanged = panelUrl !== source.url;
        panelUrl = source.url;
        panelPlaying = source.playing;
        panelEnded = source.ended;
        panelPositionMs = source.positionMs;
        panelVolume = source.volume;
        updateNowPlaying();
        renderPlaylist(urlChanged);
        if (urlChanged) probeDuration(panelUrl);
        if (panelDuration <= 0 || panelPositionMs < panelDuration * 1000 - 1000) endedHandled = false;
    };

    const updateSource = (vehicleId, url, playing, positionMs, spatial, volume, bass, revision, ended) => {
        vehicleId = Number(vehicleId) || 0;
        if (!vehicleId) return;
        const source = sources.get(vehicleId) || createSource(vehicleId);
        const urlChanged = source.url !== String(url || '');
        source.url = String(url || '');
        source.playing = !!Number(playing);
        source.ended = !!Number(ended);
        source.positionMs = Math.max(0, Number(positionMs) || 0);
        source.receivedAt = performance.now();
        source.spatial = clamp(spatial, 0, 100);
        source.volume = clamp(volume, 0, 100);
        source.bass = clamp(bass, -12, 12);
        source.revision = Number(revision) || 0;
        if (urlChanged) source.durationMs = 0;
        if (panelOpen && panelVehicle === vehicleId) renderPanelFromSource(source);
    };

    const openPanel = (vehicleId, url, playing, positionMs, volume, bass, accountId, ended) => {
        loadAccountLibrary(accountId);
        panelVehicle = Number(vehicleId) || 0;
        panelUrl = String(url || '');
        panelPlaying = !!Number(playing);
        panelEnded = !!Number(ended);
        panelPositionMs = Math.max(0, Number(positionMs) || 0);
        panelVolume = clamp(volume, 0, 100);
        panelOpen = true;
        endedHandled = false;
        root.classList.add('va-open');
        root.classList.remove('va-url-open');
        let source = sources.get(panelVehicle);
        if (!source) source = createSource(panelVehicle);
        source.url = panelUrl;
        source.playing = panelPlaying;
        source.ended = panelEnded;
        source.positionMs = panelPositionMs;
        source.receivedAt = performance.now();
        source.volume = panelVolume;
        updateNowPlaying();
        renderRepeat();
        renderPlaylist(true);
        probeDuration(panelUrl);
        // Restore the account's saved repeat mode on the server as soon as
        // the panel opens. Previously only the icon changed locally, so the
        // server still stopped the track at the end.
        emit('vehicleAudio:repeat', `${panelVehicle}|${repeatMode}`);
        if (window.cef && typeof window.cef.set_focus === 'function') {
            // Re-assert focus after CEF paints the world-audio panel. This
            // makes the Windows cursor visible and keeps the controls
            // clickable even when the panel is opened from a command.
            window.cef.set_focus(true);
            setTimeout(() => window.cef && typeof window.cef.set_focus === 'function' && window.cef.set_focus(true), 60);
            setTimeout(() => window.cef && typeof window.cef.set_focus === 'function' && window.cef.set_focus(true), 240);
        }
    };

    const closePanel = (notifyServer = true) => {
        if (!panelOpen) return;
        panelOpen = false;
        scrubbing = false;
        root.classList.remove('va-open', 'va-playing', 'va-paused', 'va-url-open');
        setMessage('');
        if (notifyServer) emit('vehicleAudio:close', '1');
        worldPanel = false;
        root.classList.remove('va-world');
        panelVehicle = 0;
    };

    const selectTrack = (url, message = 'Трек передан в автомобильную 3D-аудиосистему.') => {
        if (!validUrl(url)) return;
        const source = sources.get(panelVehicle) || createSource(panelVehicle);
        panelUrl = url;
        panelPlaying = true;
        panelEnded = false;
        panelPositionMs = 0;
        endedHandled = false;
        source.url = url;
        source.playing = true;
        source.ended = false;
        source.positionMs = 0;
        source.durationMs = 0;
        source.receivedAt = performance.now();
        upsertTrack(url, false);
        updateNowPlaying();
        renderPlaylist(true);
        setMessage(message, true);
        emit('vehicleAudio:load', `${panelVehicle}|${url}`);
        probeDuration(url, panelVehicle);
    };

    const loadUrl = () => {
        const url = ui.url.value.trim();
        if (!validUrl(url)) return setMessage('Нужна прямая ссылка http:// или https:// без пробелов.');
        root.classList.remove('va-url-open');
        selectTrack(url, 'Ссылка добавлена. Запускаю музыку рядом с автомобилем.');
    };

    const playRelative = direction => {
        if (!playlist.length) return setMessage('Сначала добавьте хотя бы одну ссылку.');
        let index = playlist.findIndex(track => track.url === panelUrl);
        if (index < 0) index = direction > 0 ? -1 : 0;
        index = (index + direction + playlist.length) % playlist.length;
        selectTrack(playlist[index].url);
    };

    const handleEnded = () => {
        if (endedHandled || !panelPlaying || panelDuration <= 0) return;
        endedHandled = true;
        if (repeatMode === 1) {
            panelPositionMs = 0;
            emit('vehicleAudio:seek', `${panelVehicle}|0`);
            setMessage('Повторяю текущий трек.', true);
        } else if (repeatMode === 2 && playlist.length) {
            playRelative(1);
        } else {
            panelPlaying = false;
            panelEnded = true;
            const source = sources.get(panelVehicle);
            if (source) {
                source.playing = false;
                source.ended = true;
                source.positionMs = 0;
                source.receivedAt = performance.now();
            }
            updateNowPlaying();
            emit('vehicleAudio:ended', panelVehicle);
        }
    };

    ui.backdrop.addEventListener('mousedown', event => {
        if (event.button === 0) closePanel(true);
    });
    ui.addToggle.addEventListener('click', () => {
        root.classList.add('va-url-open');
        // Never expose/copy the currently playing URL into another account's
        // add form. Every player builds only their own account library.
        ui.url.value = '';
        setTimeout(() => ui.url.focus(), 30);
    });
    ui.urlClose.addEventListener('click', () => root.classList.remove('va-url-open'));
    ui.load.addEventListener('click', loadUrl);
    ui.url.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); loadUrl(); }
    });

    ui.playlist.addEventListener('click', event => {
        if (event.target.closest('.va-empty-add')) {
            root.classList.add('va-url-open');
            setTimeout(() => ui.url.focus(), 30);
            return;
        }
        const row = event.target.closest('.va-song');
        if (!row) return;
        const index = Number(row.dataset.track);
        const track = playlist[index];
        if (!track) return;
        if (event.target.closest('.va-song-remove')) {
            playlist.splice(index, 1);
            savePlaylist();
            renderPlaylist(false);
            setMessage('Ссылка удалена из списка. Текущая музыка не выключена.', true);
            return;
        }
        if (event.target.closest('.va-song-main')) selectTrack(track.url);
    });

    ui.playlist.addEventListener('dragstart', event => {
        const row = event.target.closest('.va-song');
        if (!row) return;
        dragIndex = Number(row.dataset.track);
        row.classList.add('va-dragging');
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    ui.playlist.addEventListener('dragend', event => {
        const row = event.target.closest('.va-song');
        if (row) row.classList.remove('va-dragging');
        dragIndex = -1;
    });
    ui.playlist.addEventListener('dragover', event => event.preventDefault());
    ui.playlist.addEventListener('drop', event => {
        event.preventDefault();
        const row = event.target.closest('.va-song');
        const targetIndex = row ? Number(row.dataset.track) : -1;
        if (dragIndex < 0 || targetIndex < 0 || dragIndex === targetIndex) return;
        const [track] = playlist.splice(dragIndex, 1);
        playlist.splice(targetIndex, 0, track);
        savePlaylist();
        renderPlaylist(false);
        setMessage('Новый порядок треков сохранён.', true);
        dragIndex = -1;
    });

    ui.play.addEventListener('click', () => {
        if (!panelUrl) {
            if (!playlist.length) return setMessage('Сначала добавьте ссылку на музыку.');
            return selectTrack(playlist[0].url);
        }
        panelPlaying = !panelPlaying;
        panelEnded = false;
        const source = sources.get(panelVehicle);
        if (source) {
            source.positionMs = expectedPositionMs(source);
            source.receivedAt = performance.now();
            source.playing = panelPlaying;
            source.ended = false;
        }
        updateNowPlaying();
        emit('vehicleAudio:toggle', panelVehicle);
    });
    ui.previous.addEventListener('click', () => playRelative(-1));
    ui.next.addEventListener('click', () => playRelative(1));
    ui.repeat.addEventListener('click', () => {
        repeatMode = (repeatMode + 1) % 3;
        if (libraryAccount) localStorage.setItem(repeatStorageKey(), String(repeatMode));
        emit('vehicleAudio:repeat', `${panelVehicle}|${repeatMode}`);
        renderRepeat();
        setMessage(['Повтор выключен.', 'Включён повтор одного трека.', 'Включён повтор всего списка.'][repeatMode], true);
    });
    ui.shuffle.addEventListener('click', () => {
        if (playlist.length < 2) return setMessage('Для перемешивания нужно хотя бы две ссылки.');
        for (let index = playlist.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [playlist[index], playlist[swap]] = [playlist[swap], playlist[index]];
        }
        savePlaylist();
        renderPlaylist(true);
        setMessage('Список перемешан и сохранён.', true);
    });
    ui.stop.addEventListener('click', () => {
        panelUrl = '';
        panelPlaying = false;
        panelEnded = false;
        panelPositionMs = 0;
        panelDuration = 0;
        endedHandled = false;
        const source = sources.get(panelVehicle);
        if (source) {
            source.url = '';
            source.playing = false;
            source.ended = false;
            source.positionMs = 0;
            source.receivedAt = performance.now();
        }
        stopMetadataProbe();
        updateNowPlaying();
        renderPlaylist(false);
        setMessage('Аудиосистема выключена.', true);
        emit('vehicleAudio:stop', panelVehicle);
    });

    ui.progress.addEventListener('input', () => {
        if (panelDuration <= 0) return;
        scrubbing = true;
        scrubPositionMs = (Number(ui.progress.value) / 1000) * panelDuration * 1000;
        ui.current.textContent = formatTime(scrubPositionMs / 1000);
        setRangeFill(ui.progress, Number(ui.progress.value) / 10);
    });
    ui.progress.addEventListener('change', () => {
        if (panelDuration <= 0) return;
        scrubbing = false;
        panelPositionMs = Math.round(scrubPositionMs);
        const source = sources.get(panelVehicle);
        if (source) {
            source.positionMs = panelPositionMs;
            source.receivedAt = performance.now();
        }
        emit('vehicleAudio:seek', `${panelVehicle}|${panelPositionMs}`);
        setMessage(`Позиция: ${formatTime(panelPositionMs / 1000)}`, true, 1800);
    });
    ui.volume.addEventListener('input', () => {
        panelVolume = clamp(ui.volume.value, 0, 100);
        ui.volumeValue.textContent = `${panelVolume}%`;
        setRangeFill(ui.volume, panelVolume);
        clearTimeout(volumeTimer);
        volumeTimer = setTimeout(() => emit('vehicleAudio:volume', `${panelVehicle}|${panelVolume}`), 120);
    });

    window.addEventListener('keydown', event => {
        if (!panelOpen || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (root.classList.contains('va-url-open')) root.classList.remove('va-url-open');
        else closePanel(true);
    }, true);

    const frame = () => {
        if (panelOpen) {
            const source = sources.get(panelVehicle);
            const currentMs = source ? expectedPositionMs(source) : panelPositionMs;
            if (!scrubbing) {
                ui.current.textContent = formatTime(currentMs / 1000);
                if (panelDuration > 0) {
                    const percent = clamp((currentMs / 1000 / panelDuration) * 100, 0, 100);
                    ui.duration.textContent = formatTime(panelDuration);
                    ui.progress.disabled = false;
                    ui.progress.value = String(Math.round(percent * 10));
                    setRangeFill(ui.progress, percent);
                    if (currentMs >= panelDuration * 1000 - 150) handleEnded();
                } else {
                    ui.duration.textContent = 'ПОТОК';
                    ui.progress.disabled = true;
                    ui.progress.value = '0';
                    setRangeFill(ui.progress, 0);
                }
            }
        }
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    renderRepeat();
    renderPlaylist(false);

    if (window.cef && typeof window.cef.on === 'function') {
        window.cef.on('vehicleAudio:show', openPanel);
        window.cef.on('worldAudio:show', (...args) => {
            worldPanel = true;
            root.classList.add('va-world');
            openPanel(...args);
        });
        window.cef.on('vehicleAudio:hide', () => closePanel(false));
        window.cef.on('worldAudio:hide', () => closePanel(false));
        window.cef.on('vehicleAudio:error', message => setMessage(message));
        window.cef.on('vehicleAudio:source', updateSource);
        window.cef.on('worldAudio:source', updateSource);
        window.cef.on('vehicleAudio:gain', (vehicleId, gain) => {
            const source = sources.get(Number(vehicleId));
            if (source) source.spatial = clamp(gain, 0, 100);
        });
        window.cef.on('vehicleAudio:clock', (vehicleId, positionMs, playing) => {
            const source = sources.get(Number(vehicleId));
            if (!source) return;
            source.positionMs = Math.max(0, Number(positionMs) || 0);
            source.receivedAt = performance.now();
            source.playing = !!Number(playing);
            if (panelOpen && panelVehicle === Number(vehicleId)) {
                panelPositionMs = source.positionMs;
                panelPlaying = source.playing;
                panelEnded = source.ended;
                updateNowPlaying();
            }
        });
        window.cef.on('vehicleAudio:remove', vehicleId => sources.delete(Number(vehicleId)));
        window.cef.on('worldAudio:remove', vehicleId => sources.delete(Number(vehicleId)));
    }
})();
