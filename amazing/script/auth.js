(() => {
    'use strict';

    const maleSkins = [1, 4, 6, 7, 8, 14, 15, 16, 18];
    const femaleSkins = [90, 93, 13, 41, 38, 65];
    const errorMessages = {
        wrong_password: 'Неверный пароль. Проверьте раскладку и попробуйте ещё раз.',
        too_many_attempts: 'Слишком много неверных попыток входа. Соединение закрыто.',
        account_not_found: 'Аккаунт с этим ником не найден.',
        invalid_password: 'Пароль должен содержать от 6 до 16 латинских букв и цифр.',
        invalid_referral: 'Игрок с таким промокодом не найден.',
        referral_same_ip: 'Нельзя использовать промокод аккаунта с того же IP-адреса.',
        invalid_skin: 'Выбран недоступный скин. Выберите другой.',
        account_exists: 'Аккаунт с этим ником уже зарегистрирован.',
        registration_failed: 'Не удалось завершить регистрацию. Попробуйте ещё раз.',
        server_timeout: 'Сервер долго не отвечает. Запрос сброшен — попробуйте ещё раз.',
        recovery_unavailable: 'Восстановление пароля пока выполняется через администрацию сервера.',
        request_in_progress: 'Запрос уже обрабатывается. Подождите несколько секунд.'
    };

    const state = {
        registered: false,
        nickname: '',
        password: '',
        promo: '',
        sex: 1,
        skinIndex: 0,
        busy: false,
        serverStateReceived: false
    };

    const root = document.getElementById('amz-portal');
    const connectScreen = document.getElementById('amz-connect-screen');
    const authContent = document.getElementById('amz-auth-content');
    const form = document.getElementById('amz-form-container');
    const title = document.getElementById('amz-title');
    const statusBar = document.getElementById('amz-status-bar');
    const tabs = document.querySelector('.amz-tabs-v4');
    const box = document.querySelector('.amz-box-main');
    const toast = document.getElementById('amz-toast');
    let hudGuardActive = false;
    let readyRetry = null;
    let cefEventsBound = false;
    let authFocusHeld = false;

    let focusWatch = null;

    function grabAuthFocus() {
        if (window.cef && typeof window.cef.set_focus === 'function')
            window.cef.set_focus(true);
        authFocusHeld = true;
    }

    function startFocusWatch() {
        grabAuthFocus();
        // Re-applying CEF focus on a timer resets the focused DOM control on
        // some clients: the cursor still moves, but inputs and buttons appear
        // frozen. The server already focuses this browser when it is shown, so
        // one explicit focus request here is sufficient.
        focusWatch = true;
    }

    function releaseAuthFocus() {
        authFocusHeld = false;
        focusWatch = null;
        if (window.cef && typeof window.cef.set_focus === 'function')
            window.cef.set_focus(false);
    }

    function getQuery(name) {
        const search = window.location.search || '';
        const match = search.match(new RegExp('[?&]' + name + '=([^&]*)'));
        if (!match) return '';
        try {
            return decodeURIComponent(match[1].replace(/\+/g, ' '));
        } catch (e) {
            return match[1];
        }
    }

    function emit(name, value) {
        if (window.cef && typeof window.cef.emit === 'function') {
            if (typeof value === 'undefined') window.cef.emit(name);
            else window.cef.emit(name, String(value));
        }
    }

    function emitStateRequest() {
        emit('auth:request_state', 'state');
        emit('auth:ready', 'ready');
    }

    function setGameHudForAuth(active) {
        if (!window.cef || typeof window.cef.emit !== 'function') return;
        window.cef.emit('game:hud:setComponentVisible', 'interface', false);
        window.cef.emit('game:hud:setComponentVisible', 'radar', !active);
    }

    function startHudGuard() {
        if (hudGuardActive) return;
        hudGuardActive = true;
        setGameHudForAuth(true);
    }

    function stopHudGuard() {
        hudGuardActive = false;
    }

    function showToast(messageOrCode) {
        const message = errorMessages[messageOrCode] || messageOrCode || 'Произошла ошибка.';
        toast.textContent = message;
        toast.classList.add('visible');
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => toast.classList.remove('visible'), 5000);
    }

    function setBusy(value) {
        state.busy = value;
        document.querySelectorAll('button').forEach(button => {
            if (!button.classList.contains('amz-btn-back')) button.disabled = value;
        });
    }

    function resetLayout() {
        root.classList.remove('skin-step-active', 'terms-step-active');
        box.classList.remove('skin-box-mode', 'terms-box-mode');
        tabs.hidden = false;
        statusBar.hidden = false;
        title.hidden = false;
        setBusy(false);
    }

    function setTab(active) {
        const authTab = document.getElementById('tab-auth');
        const regTab = document.getElementById('tab-reg');
        authTab.className = `amz-t-btn ${active === 'auth' ? 'amz-t-active' : 'amz-t-dark'}`;
        regTab.className = `amz-t-btn ${active === 'reg' ? 'amz-t-active' : 'amz-t-dark'}`;
        authTab.classList.toggle('disabled', !state.registered);
        regTab.classList.toggle('disabled', state.registered);
    }

    function inputTemplate(id, placeholder, value, languageBadge = false) {
        return `
            <div class="amz-input-v4">
                <span class="amz-icon-v4 amz-ic-lock"></span>
                <input type="password" id="${id}" maxlength="16" autocomplete="off"
                    placeholder="${placeholder}" value="${value || ''}" class="amz-field-v4">
                ${languageBadge ? '<span class="amz-lang-badge">EN</span>' : ''}
                <span class="amz-icon-v4 amz-ic-eye" data-eye="${id}"></span>
            </div>`;
    }

    function bindEyes() {
        document.querySelectorAll('[data-eye]').forEach(eye => {
            eye.addEventListener('click', () => {
                const input = document.getElementById(eye.dataset.eye);
                if (input) input.type = input.type === 'password' ? 'text' : 'password';
            });
        });
    }

    function validPassword(value) {
        return /^[A-Za-z0-9]{6,16}$/.test(value);
    }

    function renderLogin() {
        resetLayout();
        setTab('auth');
        title.textContent = 'Авторизация';
        form.innerHTML = `
            ${inputTemplate('amz-login-password', 'Введите пароль', '')}
            <button type="button" id="amz-login" class="amz-btn-v4">Войти</button>
            <button id="amz-recovery" class="amz-btn-lost">Забыли пароль?</button>`;
        bindEyes();
        const password = document.getElementById('amz-login-password');
        const submit = () => {
            if (state.busy) return;
            if (!validPassword(password.value)) {
                password.classList.add('error');
                showToast('invalid_password');
                return;
            }
            setBusy(true);
            emit('auth:login', password.value);
        };
        document.getElementById('amz-login').addEventListener('click', submit);
        document.getElementById('amz-recovery').addEventListener('click', () => emit('auth:recovery'));
        password.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
        grabAuthFocus();
        password.focus();
    }

    function renderRegisterPassword() {
        resetLayout();
        setTab('reg');
        title.textContent = 'Регистрация';
        form.innerHTML = `
            ${inputTemplate('amz-reg-password', 'Введите пароль', state.password)}
            ${inputTemplate('amz-reg-password-repeat', 'Повторите пароль', state.password, true)}
            <button id="amz-reg-password-next" class="amz-btn-v4">Далее</button>`;
        bindEyes();
        document.getElementById('amz-reg-password-next').addEventListener('click', () => {
            const first = document.getElementById('amz-reg-password');
            const second = document.getElementById('amz-reg-password-repeat');
            if (!validPassword(first.value)) {
                first.classList.add('error');
                showToast('invalid_password');
                return;
            }
            if (first.value !== second.value) {
                second.classList.add('error');
                showToast('Пароли не совпадают.');
                return;
            }
            state.password = first.value;
            renderPromo();
        });
        grabAuthFocus();
        const firstField = document.getElementById('amz-reg-password');
        if (firstField) firstField.focus();
    }

    function renderPromo() {
        resetLayout();
        setTab('reg');
        title.textContent = 'Промокод';
        form.innerHTML = `
            <div class="amz-promo-desc">Есть промокод? Введите его и получите подарок.<br><br>Этот шаг можно пропустить.</div>
            <div class="amz-input-v4">
                <span class="amz-icon-v4 amz-ic-gift"></span>
                <input type="text" id="amz-promo" maxlength="24" autocomplete="off"
                    placeholder="Введите промокод" value="${state.promo}" class="amz-field-v4">
            </div>
            <button id="amz-promo-next" class="amz-btn-v4">Далее</button>
            <button id="amz-promo-back" class="amz-btn-back">Назад</button>`;
        document.getElementById('amz-promo-next').addEventListener('click', () => {
            const promo = document.getElementById('amz-promo').value.trim();
            if (promo && !/^[A-Za-z0-9_]{3,24}$/.test(promo)) {
                showToast('Промокод может содержать только латинские буквы, цифры и _.');
                return;
            }
            state.promo = promo;
            renderTerms();
        });
        document.getElementById('amz-promo-back').addEventListener('click', renderRegisterPassword);
    }

    function renderTerms() {
        resetLayout();
        root.classList.add('terms-step-active');
        box.classList.add('terms-box-mode');
        tabs.hidden = true;
        statusBar.hidden = true;
        title.hidden = true;
        form.innerHTML = `
            <div class="amz-wordmark amz-terms-logo" aria-label="Absolute Online">
                <span class="amz-wordmark-top">Absolute</span>
                <span class="amz-wordmark-bottom">Online</span>
            </div>
            <div class="amz-terms-tabs"><b>Лицензионное соглашение</b><span>Политика конфиденциальности</span></div>
            <div class="amz-terms-box">
                <b>Лицензионное соглашение на игру Absolute Online.</b><br><br>
                Регистрируясь, вы подтверждаете, что ознакомились с правилами проекта, обязуетесь соблюдать их
                и несёте ответственность за безопасность своего аккаунта. Запрещены нечестная игра,
                использование стороннего программного обеспечения и передача доступа третьим лицам.<br><br>
                Администрация вправе ограничить доступ при нарушении правил. Игровые данные обрабатываются
                только для работы аккаунта и игрового сервера.
            </div>
            <div class="amz-checkboxes">
                <label class="amz-checkbox-label"><input type="checkbox"> Я принимаю лицензионное соглашение</label>
                <label class="amz-checkbox-label"><input type="checkbox"> Я согласен с правилами проекта</label>
                <label class="amz-checkbox-label"><input type="checkbox"> Я согласен на обработку игровых данных</label>
            </div>
            <button id="amz-terms-next" class="amz-btn-v4" disabled>Далее</button>
            <button id="amz-terms-back" class="amz-btn-back">Назад</button>`;
        const checks = Array.from(form.querySelectorAll('input[type="checkbox"]'));
        const next = document.getElementById('amz-terms-next');
        checks.forEach(check => check.addEventListener('change', () => {
            next.disabled = !checks.every(item => item.checked);
        }));
        next.addEventListener('click', renderSkin);
        document.getElementById('amz-terms-back').addEventListener('click', renderPromo);
    }

    function getSkins() {
        return state.sex === 1 ? maleSkins : femaleSkins;
    }

    function renderSkin() {
        resetLayout();
        root.classList.add('skin-step-active');
        box.classList.add('skin-box-mode');
        tabs.hidden = true;
        statusBar.hidden = true;
        title.hidden = true;
        const skins = getSkins();
        if (state.skinIndex >= skins.length) state.skinIndex = 0;
        const skin = skins[state.skinIndex];
        form.innerHTML = `
            <div class="amz-skin-logo-top">
                <div class="amz-wordmark" aria-label="Absolute Online">
                    <span class="amz-wordmark-top">Absolute</span>
                    <span class="amz-wordmark-bottom">Online</span>
                </div>
            </div>
            <div class="amz-skin-wrapper">
                <div class="amz-skin-title">Выбор пола и внешности</div>
                <div class="amz-gender-toggle">
                    <button id="amz-male" class="amz-g-btn ${state.sex === 1 ? 'active' : ''}">Мужчина</button>
                    <button id="amz-female" class="amz-g-btn ${state.sex === 2 ? 'active' : ''}">Женщина</button>
                </div>
                <div class="amz-skin-slider-box">
                    <button id="amz-skin-prev" class="amz-arrow-btn">&#10094;</button>
                    <div class="amz-skin-img-wrapper"><img src="images/skin/${skin}.png" alt="Персонаж"></div>
                    <button id="amz-skin-next" class="amz-arrow-btn">&#10095;</button>
                </div>
                <button id="amz-register" class="amz-skin-btn-submit">Зарегистрироваться</button>
                <button id="amz-skin-back" class="amz-skin-btn-back">Назад</button>
            </div>`;
        document.getElementById('amz-male').addEventListener('click', () => { state.sex = 1; state.skinIndex = 0; renderSkin(); });
        document.getElementById('amz-female').addEventListener('click', () => { state.sex = 2; state.skinIndex = 0; renderSkin(); });
        document.getElementById('amz-skin-prev').addEventListener('click', () => {
            state.skinIndex = (state.skinIndex - 1 + getSkins().length) % getSkins().length;
            renderSkin();
        });
        document.getElementById('amz-skin-next').addEventListener('click', () => {
            state.skinIndex = (state.skinIndex + 1) % getSkins().length;
            renderSkin();
        });
        document.getElementById('amz-register').addEventListener('click', () => {
            if (state.busy) return;
            setBusy(true);
            emit('auth:register', `${state.password}|${state.promo || '-'}|${state.sex}|${skin}`);
        });
        document.getElementById('amz-skin-back').addEventListener('click', renderTerms);
    }

    function showAuth(registered, nickname) {
        const accountResolved = Number(registered) === 0 || Number(registered) === 1;
        if (!accountResolved) return;
        const nextRegistered = Number(registered) === 1;
        const nextNickname = String(nickname || '');

        // The server can repeat auth:show while the player is typing. Rebuilding
        // form.innerHTML here used to erase the password and steal input focus.
        if (state.serverStateReceived && state.registered === nextRegistered &&
            state.nickname === nextNickname && !authContent.hidden) {
            grabAuthFocus();
            const activeField = form.querySelector('input:not([type="checkbox"])');
            if (activeField && document.activeElement !== activeField) activeField.focus();
            emit('auth:shown', 'shown');
            return;
        }

        state.serverStateReceived = true;
        if (readyRetry) clearInterval(readyRetry);
        readyRetry = null;
        state.registered = nextRegistered;
        state.nickname = nextNickname;
        document.getElementById('usr-badge').textContent = state.nickname || '';
        document.getElementById('srv-badge').textContent = 'Absolute Online';
        connectScreen.hidden = true;
        connectScreen.style.pointerEvents = 'none';
        authContent.hidden = false;
        setGameHudForAuth(true);

        const authTab = document.getElementById('tab-auth');
        const regTab = document.getElementById('tab-reg');
        const allowBoth = getQuery('bridge') === '1';
        authTab.classList.toggle('disabled', !allowBoth && !state.registered);
        regTab.classList.toggle('disabled', !allowBoth && state.registered);
        authTab.onclick = (allowBoth || state.registered) ? renderLogin : null;
        regTab.onclick = (allowBoth || !state.registered) ? renderRegisterPassword : null;
        if (state.registered) renderLogin();
        else renderRegisterPassword();
        grabAuthFocus();
        emit('auth:shown', 'shown');
        startFocusWatch();
    }

    function hideAuthVisual() {
        stopHudGuard();
        connectScreen.hidden = true;
        authContent.hidden = true;
        root.style.display = 'none';
        releaseAuthFocus();
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function formatMoney(value) {
        try {
            return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
        } catch (e) {
            return String(value || 0);
        }
    }

    function tickHudClock() {
        const now = new Date();
        const dateEl = document.getElementById('hud-date');
        const timeEl = document.getElementById('hud-time');
        if (dateEl) {
            dateEl.textContent = pad2(now.getDate()) + '.' + pad2(now.getMonth() + 1) + '.' + String(now.getFullYear()).slice(-2);
        }
        if (timeEl) {
            timeEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
        }
    }

    function enterHudMode() {
        stopHudGuard();
        releaseAuthFocus();
        connectScreen.hidden = true;
        authContent.hidden = true;
        document.body.classList.add('ingame');
        const leftoverHud = document.getElementById('ingame-hud');
        if (leftoverHud) leftoverHud.style.display = 'none';
        root.style.display = 'none';
        if (enterHudMode.clock) {
            clearInterval(enterHudMode.clock);
            enterHudMode.clock = null;
        }
        if (window.cef && typeof window.cef.set_focus === 'function') window.cef.set_focus(false);
        if (window.cef && typeof window.cef.hide === 'function') window.cef.hide(true);
    }

    function restoreAuthVisual() {
        document.body.classList.remove('ingame');
        root.style.display = 'block';
        authContent.hidden = false;
        connectScreen.hidden = true;
        if (window.cef && typeof window.cef.hide === 'function') window.cef.hide(false);
        grabAuthFocus();
    }

    function closeAuth() {
        enterHudMode();
        emit('auth:ui_closed', 'closed');
    }

    // The account query normally completes before this fires.  On a slow
    // connection, however, do not strand a returning player on a bare
    function bindCefEvents() {
        if (cefEventsBound || !window.cef || typeof window.cef.on !== 'function') return false;
        window.cef.on('auth:show', showAuth);
        window.cef.on('auth:error', code => {
            setBusy(false);
            restoreAuthVisual();
            showToast(code);
        });
        window.cef.on('auth:complete', closeAuth);
        window.cef.on("Lethality(executeEvent['main.hud.active'])", v => {
            if (Number(v)) enterHudMode();
        });
        window.cef.on("Lethality(executeEvent['main.hud.id'])", v => {
            const el = document.querySelector('#hud-id span');
            if (el) el.textContent = String(v || 0);
        });
        window.cef.on("Lethality(executeEvent['main.hud.name'])", v => {
            const el = document.getElementById('hud-name');
            if (el) el.textContent = String(v || '').replace(/_/g, ' ');
        });
        window.cef.on("Lethality(executeEvent['main.hud.admin'])", v => {
            const el = document.getElementById('hud-id');
            if (el) el.classList.toggle('admin', !!Number(v));
        });
        window.cef.on("Lethality(executeEvent['main.hud.health'])", v => {
            const el = document.getElementById('hud-health');
            if (el) el.textContent = String(v || 0);
        });
        window.cef.on("Lethality(executeEvent['main.hud.money'])", v => {
            const el = document.getElementById('hud-money');
            if (el) el.textContent = formatMoney(v);
        });
        cefEventsBound = true;
        if (state.serverStateReceived) emit('auth:shown', 'shown');
        return true;
    }

    document.addEventListener('contextmenu', event => event.preventDefault());
    root.addEventListener('mousedown', () => {
        if (!authContent.hidden) grabAuthFocus();
    }, true);
    window.addEventListener('focus', () => {
        if (!authContent.hidden) {
            grabAuthFocus();
            const activeField = form.querySelector('input:not([type="checkbox"])');
            if (activeField) activeField.focus();
        }
    });

    function initializeAuthPage() {
        root.style.display = 'block';
        authContent.hidden = true;
        connectScreen.hidden = false;
        bindCefEvents();

        const bridgeRetry = setInterval(() => {
            if (bindCefEvents()) clearInterval(bridgeRetry);
        }, 80);
        setTimeout(() => clearInterval(bridgeRetry), 30000);

        const account = getQuery('account');
        if (account === '0' || account === '1') {
            showAuth(Number(account), getQuery('nick') || 'Игрок');
            emit('auth:shown', 'shown');
            return;
        }

        let readyAttempts = 0;
        const announceReady = () => {
            if (state.serverStateReceived) {
                if (readyRetry) clearInterval(readyRetry);
                readyRetry = null;
                return;
            }
            readyAttempts += 1;
            emitStateRequest();
            // Keep retrying until the local CEF bridge answers. Some players
            // need several seconds while the embedded renderer starts; the
            // old 20-second cutoff left them stuck on the connection screen.
        };
        announceReady();
        readyRetry = setInterval(announceReady, 500);

        if (!window.cef) {
            const preview = getQuery('preview');
            if (preview === 'login') showAuth(1, 'Danya_Luxury');
            if (preview === 'register') showAuth(0, 'Danya_Luxury');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAuthPage, { once: true });
    } else {
        initializeAuthPage();
    }
})();
