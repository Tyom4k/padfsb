(function () {
    var NS = 'http://www.w3.org/2000/svg';
    var SIZE = 900;
    var CENTER_POINT = 450;
    var OUTER = 440;
    var INNER = 267;
    var ICON_RADIUS = (OUTER + INNER) / 2;
    var ASSET_ROOT = 'assets/images/full-old-player-radial/';
    var opened = false;
    var openedAt = 0;
    var suppressOpeningContext = false;
    var targetId = -1;
    var targetName = '';
    var hasTarget = false;
    var hasFaction = false;
    var hasPolice = false;
    var stack = [];
    var hovered = -1;
    var preloadedImages = [];
    var renderedKey = '';
    var focusSuspended = false;
    var closePending = false;
    var selectionPending = false;

    var rootItems = [
        {
            label: 'Фракция',
            icon: ASSET_ROOT + 'fraction.svg',
            event: 'fraction',
            mode: 'fraction',
            faction: true,
            children: [
                { label: 'Показать удостоверение', icon: ASSET_ROOT + 'original/licenses.svg', event: 'fraction-id', faction: true, target: true },
                { label: 'Надеть / снять наручники', icon: ASSET_ROOT + 'original/handcuffs.svg', event: 'handcuffs', police: true, target: true },
                { label: 'Выдать розыск', icon: ASSET_ROOT + 'original/wanted-list.svg', event: 'wanted-list', police: true, target: true },
                { label: 'Начать / закончить конвоирование', icon: ASSET_ROOT + 'original/police-follow.svg', event: 'escort', police: true, target: true },
                {
                    label: 'Действия организации',
                    icon: ASSET_ROOT + 'original/category.svg',
                    mode: 'fraction-actions',
                    police: true,
                    children: [
                        { label: 'Обыскать', icon: ASSET_ROOT + 'grid.svg', event: 'police-frisk', target: true },
                        { label: 'Найти по базе', icon: ASSET_ROOT + 'original/wanted-list.svg', event: 'police-search', target: true },
                        { label: 'Снять розыск', icon: ASSET_ROOT + 'original/licenses.svg', event: 'police-clear', target: true },
                        { label: 'Список разыскиваемых', icon: ASSET_ROOT + 'original/category.svg', event: 'wanted-all' }
                    ]
                },
                {
                    label: 'Дополнительные действия',
                    icon: ASSET_ROOT + 'original/category.svg',
                    mode: 'fraction-more',
                    police: true,
                    children: [
                        { label: 'Снять маску', icon: ASSET_ROOT + 'id-card.svg', event: 'police-unmask', target: true },
                        { label: 'Посадить: место 1', icon: ASSET_ROOT + 'original/police-follow.svg', event: 'police-push-1', target: true },
                        { label: 'Посадить: место 2', icon: ASSET_ROOT + 'original/police-follow.svg', event: 'police-push-2', target: true },
                        { label: 'Посадить: место 3', icon: ASSET_ROOT + 'original/police-follow.svg', event: 'police-push-3', target: true }
                    ]
                }
            ]
        },
        { label: 'Поздороваться', icon: ASSET_ROOT + 'handshake-outline.svg', event: 'handshake', target: true },
        { label: 'Передать деньги', icon: ASSET_ROOT + 'give-money.svg', event: 'give-money', target: true },
        {
            label: 'Предложить сделку',
            icon: ASSET_ROOT + 'trade.svg',
            target: true,
            mode: 'trade',
            children: [
                { label: 'Обмен домами', icon: ASSET_ROOT + 'trade.svg', event: 'trade-house', target: true },
                { label: 'Обмен бизнесами', icon: ASSET_ROOT + 'give-money.svg', event: 'trade-business', target: true },
                { label: 'Обмен автомобилями', icon: ASSET_ROOT + 'original/category.svg', event: 'trade-car', target: true }
            ]
        },
        { label: 'Показать паспорт', icon: ASSET_ROOT + 'passport.svg', event: 'passport', target: true },
        { label: 'Показать лицензии', icon: ASSET_ROOT + 'id-card.svg', event: 'licenses', target: true },
        { label: 'Поцеловать', icon: ASSET_ROOT + 'kiss.svg', event: 'kiss', target: true },
        { label: 'Отшлепать', icon: ASSET_ROOT + 'slap.svg', event: 'slap', target: true },
        { label: 'Показать навыки', icon: ASSET_ROOT + 'grid.svg', event: 'skills', target: true }
    ];

    function preloadMenuImages(items) {
        var i;
        var image;
        for (i = 0; i < items.length; i++) {
            image = new Image();
            image.src = items[i].icon;
            preloadedImages.push(image);
            if (items[i].children && items[i].children.length) {
                preloadMenuImages(items[i].children);
            }
        }
    }

    preloadMenuImages(rootItems);

    var overlay = document.createElement('main');
    overlay.id = 'player-radial';
    overlay.className = 'player-radial';
    overlay.setAttribute('aria-label', 'Меню взаимодействия с игроком');
    overlay.hidden = true;
    overlay.innerHTML =
        '<header class="target">' +
            '<div>Взаимодействие с</div>' +
            '<strong class="radial-target-value"></strong>' +
        '</header>' +
        '<section class="wheel-wrap">' +
            '<svg class="wheel" viewBox="0 0 900 900" aria-hidden="true"></svg>' +
            '<div class="icons"></div>' +
            '<div class="center-action">' +
                '<div class="action-name"></div>' +
                '<div class="control-row idle-control">' +
                    '<span class="mouse mouse-left"><i></i></span><span class="idle-label">Закрыть</span>' +
                '</div>' +
                '<div class="active-controls">' +
                    '<div class="control-row"><span class="mouse mouse-left"><i></i></span><span>Выбрать</span></div>' +
                    '<div class="control-row"><span class="mouse mouse-right"><i></i></span><span class="back-label">Назад</span></div>' +
                '</div>' +
            '</div>' +
        '</section>';
    document.body.appendChild(overlay);

    var wheel = overlay.querySelector('.wheel');
    var icons = overlay.querySelector('.icons');
    var actionName = overlay.querySelector('.action-name');
    var centerAction = overlay.querySelector('.center-action');
    var idleLabel = overlay.querySelector('.idle-label');
    var backLabel = overlay.querySelector('.back-label');
    var targetValueNode = overlay.querySelector('.radial-target-value');

    function emit(name, value) {
        if (!window.cef || typeof window.cef.emit !== 'function') return;
        if (typeof value === 'undefined') window.cef.emit(name);
        else window.cef.emit(name, String(value));
    }

    function polar(radius, degrees) {
        var angle = (degrees - 90) * Math.PI / 180;
        return [
            CENTER_POINT + radius * Math.cos(angle),
            CENTER_POINT + radius * Math.sin(angle)
        ];
    }

    function sectorPath(start, end) {
        var first = polar(OUTER, start);
        var second = polar(OUTER, end);
        var third = polar(INNER, end);
        var fourth = polar(INNER, start);
        return 'M' + first[0] + ' ' + first[1] +
            'A' + OUTER + ' ' + OUTER + ' 0 0 1 ' + second[0] + ' ' + second[1] +
            'L' + third[0] + ' ' + third[1] +
            'A' + INNER + ' ' + INNER + ' 0 0 0 ' + fourth[0] + ' ' + fourth[1] + 'Z';
    }

    function currentMenu() {
        return stack[stack.length - 1];
    }

    function itemDisabled(item) {
        return (!!item.faction && !hasFaction) || (!!item.police && !hasPolice) || (!!item.target && !hasTarget);
    }

    function setHover(index) {
        var sectorNodes = overlay.querySelectorAll('.sector');
        var iconNodes = overlay.querySelectorAll('.radial-icon');
        var i;
        var item;
        var fractionLevel = currentMenu().mode === 'fraction';

        hovered = index;
        for (i = 0; i < sectorNodes.length; i++) {
            sectorNodes[i].classList.toggle('active', Number(sectorNodes[i].getAttribute('data-index')) === index);
        }
        for (i = 0; i < iconNodes.length; i++) {
            iconNodes[i].classList.toggle('active', Number(iconNodes[i].getAttribute('data-index')) === index);
        }

        item = index >= 0 ? currentMenu().items[index] : null;
        actionName.textContent = fractionLevel ? '' : (item ? item.label : currentMenu().title);
        actionName.classList.toggle('visible', !fractionLevel && (index >= 0 || stack.length > 1));
        centerAction.classList.toggle('selected', !fractionLevel && (index >= 0 || stack.length > 1));
        idleLabel.textContent = stack.length > 1 ? 'Назад' : 'Закрыть';
        backLabel.textContent = stack.length > 1 ? 'Назад' : 'Закрыть';
    }

    function choose(index) {
        var item = currentMenu().items[index];
        if (!item || itemDisabled(item) || selectionPending || closePending) return;

        if (item.children && item.children.length) {
            stack.push({ title: item.label, items: item.children, mode: item.mode });
            render();
            return;
        }

        // Close immediately on the client. Waiting for the server round trip
        // left the wheel and cursor stuck when a packet/event was lost.
        selectionPending = true;
        hideLocal();
        emit('radial:select', item.event);
    }

    function hideLocal() {
        opened = false;
        overlay.hidden = true;
        document.documentElement.classList.remove('player-radial-open');
        document.body.classList.remove('player-radial-open');
        stack = [];
        hovered = -1;
        renderedKey = '';
        suppressOpeningContext = false;
    }

    function closeAndNotify() {
        if (!opened || closePending || selectionPending) return;
        closePending = true;
        hideLocal();
        emit('radial:close');
    }

    function backOrClose() {
        if (!opened) return;
        if (stack.length > 1) {
            stack.pop();
            render();
            return;
        }
        closeAndNotify();
    }

    function suspendForFocusLoss() {
        if (focusSuspended) return;
        focusSuspended = true;
        if (!opened) return;
        closeAndNotify();
    }

    function resumeAfterFocus() {
        focusSuspended = false;
        if (!opened) hideLocal();
    }

    function render() {
        var menu = currentMenu();
        var nextRenderedKey = (menu.mode || 'root') + ':' + (hasFaction ? '1' : '0') + ':' + (hasPolice ? '1' : '0') + ':' + (hasTarget ? '1' : '0');
        var items = menu.items.slice(0, 10);
        var count = items.length;
        var step = 360 / count;
        var i;

        hovered = -1;
        if (renderedKey === nextRenderedKey) {
            setHover(-1);
            return;
        }
        renderedKey = nextRenderedKey;
        wheel.innerHTML = '';
        icons.innerHTML = '';

        for (i = 0; i < count; i++) {
            (function (item, index) {
                var angle = index * step;
                var sector = document.createElementNS(NS, 'path');
                var icon = document.createElement('div');
                var iconPoint = polar(ICON_RADIUS, angle);
                var disabled = itemDisabled(item);

                sector.setAttribute('d', sectorPath(angle - step / 2, angle + step / 2));
                sector.setAttribute('data-index', index);
                sector.setAttribute('class', 'sector' + (disabled ? ' disabled' : ''));
                sector.addEventListener('mouseenter', function () { setHover(index); });
                sector.addEventListener('mouseleave', function () { setHover(-1); });
                sector.addEventListener('click', function () { choose(index); });
                wheel.appendChild(sector);

                icon.className = 'radial-icon' + (disabled ? ' disabled' : '');
                icon.setAttribute('data-index', index);
                icon.style.left = (iconPoint[0] / SIZE * 100) + '%';
                icon.style.top = (iconPoint[1] / SIZE * 100) + '%';
                icon.innerHTML = '<img src="' + item.icon + '" alt="" draggable="false">';
                icons.appendChild(icon);
            })(items[i], i);
        }

        var innerGlass = document.createElementNS(NS, 'circle');
        innerGlass.setAttribute('cx', CENTER_POINT);
        innerGlass.setAttribute('cy', CENTER_POINT);
        innerGlass.setAttribute('r', INNER);
        innerGlass.setAttribute('class', 'inner-glass');
        wheel.appendChild(innerGlass);

        var innerLine = document.createElementNS(NS, 'circle');
        innerLine.setAttribute('cx', CENTER_POINT);
        innerLine.setAttribute('cy', CENTER_POINT);
        innerLine.setAttribute('r', INNER - 7);
        innerLine.setAttribute('class', 'inner-line');
        wheel.appendChild(innerLine);

        setHover(-1);
    }

    function show(serverTargetId, serverHasFaction, serverTargetName, serverHasTarget, serverHasPolice) {
        focusSuspended = false;
        closePending = false;
        selectionPending = false;
        if (opened) hideLocal();
        targetId = Number(serverTargetId);
        hasFaction = Number(serverHasFaction) !== 0;
        hasPolice = Number(serverHasPolice) !== 0;
        hasTarget = Number(serverHasTarget) !== 0 && targetId >= 0;
        targetName = String(serverTargetName || '');

        targetValueNode.textContent = hasTarget ? targetName + ' [' + targetId + ']' : 'Меню игрока';
        stack = [{ title: 'Взаимодействие', items: rootItems }];
        opened = true;
        openedAt = Date.now();
        // In targeted mode RMB was pressed before the browser became visible.
        // Suppress only that already-held click. A new RMB press reaches the
        // mousedown handler below and therefore closes the menu immediately.
        suppressOpeningContext = hasTarget;
        document.documentElement.classList.add('player-radial-open');
        document.body.classList.add('player-radial-open');
        overlay.hidden = false;
        render();
    }

    overlay.addEventListener('selectstart', function (event) {
        event.preventDefault();
    });

    overlay.addEventListener('dragstart', function (event) {
        event.preventDefault();
    });

    overlay.addEventListener('mousedown', function (event) {
        if (event.button === 2) suppressOpeningContext = false;
    });

    overlay.addEventListener('contextmenu', function (event) {
        event.preventDefault();
        if (suppressOpeningContext) {
            suppressOpeningContext = false;
            return;
        }
        backOrClose();
    });

    window.addEventListener('keydown', function (event) {
        var key;
        if (!opened) return;
        key = String(event.key || '').toLowerCase();

        if (key === 'escape') {
            event.preventDefault();
            backOrClose();
        } else if ((key === 'r' || Number(event.keyCode) === 82) && Date.now() - openedAt > 450) {
            event.preventDefault();
            backOrClose();
        }
    });

    // The HUD browser itself stays alive while the game is minimized. Close
    // only the radial layer and release its server-side CEF focus, otherwise a
    // lost Alt+Tab event can leave every following R press in a stale state.
    window.addEventListener('blur', suspendForFocusLoss);
    window.addEventListener('pagehide', suspendForFocusLoss);
    window.addEventListener('focus', resumeAfterFocus);
    window.addEventListener('pageshow', resumeAfterFocus);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) suspendForFocusLoss();
        else resumeAfterFocus();
    });

    window.openPlayerRadial = function (data) {
        data = data || {};
        show(
            typeof data.id === 'undefined' ? 83 : data.id,
            typeof data.hasFaction === 'undefined' ? 1 : data.hasFaction,
            data.name || 'Zhorik_Dadayan',
            typeof data.hasTarget === 'undefined' ? 1 : data.hasTarget,
            typeof data.hasPolice === 'undefined' ? 1 : data.hasPolice
        );
    };

    window.closePlayerRadial = function () {
        closePending = false;
        selectionPending = false;
        hideLocal();
    };

    function bindCef() {
        if (!window.cef || typeof window.cef.on !== 'function' || typeof window.cef.emit !== 'function') {
            window.setTimeout(bindCef, 100);
            return;
        }
        window.cef.on('radial:show', show);
        window.cef.on('radial:hide', function () {
            closePending = false;
            selectionPending = false;
            hideLocal();
        });
        window.cef.emit('radial:ready');
    }

    bindCef();

    if (window.location.search.indexOf('radialPreview=') !== -1) {
        document.body.classList.add('player-radial-preview-scene');
        window.setTimeout(function () {
            show(83, window.location.search.indexOf('radialPreview=disabled') === -1 ? 1 : 0, 'Zhorik_Dadayan', 1);
        }, 450);
    }
})();
