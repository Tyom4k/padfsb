if (typeof cef === 'undefined') {
    window.cef = {
        _events: {},
        emit: function(name, ...args) { console.log(`[CEF EMIT] ${name}`, args); },
        on: function(name, callback) { this._events[name] = callback; },
        set_focus: function(state) {}
    };
}

const CHAT_COMMANDS = [
    { name: '/me',    desc: 'Действие персонажа',    isAdmin: false },
    { name: '/do',    desc: 'Описание сцены',        isAdmin: false },
    { name: '/b',     desc: 'Вне игры (OOC)',        isAdmin: false },
    { name: '/s',     desc: 'Кричать',               isAdmin: false },
    { name: '/w',     desc: 'Шептать',               isAdmin: false },
    { name: '/pm',    desc: 'Личное сообщение',      isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'Текст' }] },
    { name: '/pay',   desc: 'Передать деньги',       isAdmin: false, args: [{ name: 'ID игрока' }, { name: 'Сумма' }] },
    { name: '/q',     desc: 'Выйти из игры',         isAdmin: false },
    { name: '/kick',  isAdmin: true, args: [{ name: 'ID' }, { name: 'Причина' }] },
    { name: '/ban',   isAdmin: true, args: [{ name: 'ID' }, { name: 'Причина' }] },
    { name: '/agl',   isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'Действие', options: [{ value: 0, name: 'Забрать' }, { value: 1, name: 'Выдать' }] }] },
    { name: '/aincar', isAdmin: true, args: [{ name: 'ID транспорта' }, { name: 'Место', options: [{ value: 0, name: 'Водительское' }, { value: 1, name: 'Пассажирское спереди' }, { value: 2, name: 'Сзади слева' }, { value: 3, name: 'Сзади справа' }] }] },
    { name: '/spawn', desc: 'Заспавнить игрока', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/unmove', desc: 'Снять заморозку объектом', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/move', desc: 'Двигать объект игрока', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/change_vinyl', desc: 'Установить/убрать винил', isAdmin: true, args: [{ name: 'Винил' }, { name: 'ID транспорта (0/пусто)' }] },
    { name: '/set_lights', desc: 'Цвет фар транспорта', isAdmin: true, args: [{ name: 'vehicleid' }, { name: 'red' }, { name: 'green' }, { name: 'blue' }, { name: 'alpha' }] },
    { name: '/set_smoke', desc: 'Цвет дыма транспорта', isAdmin: true, args: [{ name: 'vehicleid' }, { name: 'red' }, { name: 'green' }, { name: 'blue' }, { name: 'alpha' }] },
    { name: '/veh', desc: 'Создать транспорт', isAdmin: true, args: [{ name: 'vehicleid' }, { name: 'Цвет 1' }, { name: 'Цвет 2' }] },
    { name: '/delveh', desc: 'Удалить админ-авто', isAdmin: true, args: [{ name: 'vehicleid' }] },
    { name: '/alldelveh', desc: 'Удалить весь админ-транспорт', isAdmin: true },
    { name: '/setleader', desc: 'Выдать лидерские права', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/vehs', desc: 'Список админ-транспорта', isAdmin: true },
    { name: '/setfuel', desc: 'Установить топливо', isAdmin: true, args: [{ name: 'vehicleid (-1)' }, { name: 'Топливо' }] },
    { name: '/fixveh', desc: 'Починить автомобиль', isAdmin: true, args: [{ name: 'vehicleid' }]},
    { name: '/gotomark', desc: 'Телепорт по метке', isAdmin: true },
    { name: '/alogin', desc: 'Авторизоваться в админке', isAdmin: true },
    { name: '/sethp', desc: 'Установить HP игроку', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'HP' }] },
    { name: '/a', desc: 'Админ-чат', isAdmin: true, args: [{ name: 'Сообщение' }] },
    { name: '/givegun', desc: 'Выдать оружие', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'Оружие' }, { name: 'Патроны' }] },
    { name: '/hp', desc: 'Вылечить себя и авто', isAdmin: true },
    { name: '/setweather', desc: 'Установить погоду', isAdmin: true, args: [{ name: 'Погода' }] },
    { name: '/randweather', desc: 'Случайная погода', isAdmin: true },
    { name: '/settime', desc: 'Установить время', isAdmin: true, args: [{ name: 'Время' }] },
    { name: '/setskin', desc: 'Выдать скин навсегда', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'ID скина' }] },
    { name: '/tempskin', desc: 'Выдать временный скин', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'ID скина' }] },
    { name: '/obj', desc: 'Создать/редактировать объект', isAdmin: true, args: [{ name: 'ID объекта' }, { name: 'Название' }] },
    { name: '/tpcoord', desc: 'Телепорт по координатам', isAdmin: true, args: [{ name: 'X, Y, Z' }] },
    { name: '/tp', desc: 'Выбор точки телепорта', isAdmin: true },
    { name: '/setint', desc: 'Установить интерьер', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'Интерьер' }] },
    { name: '/setvw', desc: 'Установить виртуальный мир', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'VW' }] },
    { name: '/slap', desc: 'Пнуть игрока', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/admins', desc: 'Список админов онлайн', isAdmin: false },
    { name: '/agm', desc: 'Включить/выключить бессмертие', isAdmin: true },
    { name: '/goto', desc: 'Телепорт к игроку', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/gethere', desc: 'Телепорт игрока к себе', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/freeze', desc: 'Заморозить игрока', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/jet', desc: 'Выдать джетпак', isAdmin: true },
    { name: '/al', desc: 'Ссылка на nohello', isAdmin: false },
    { name: '/givemoney', desc: 'Выдать/забрать деньги', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'Сумма' }] },
    { name: '/setadmin', desc: 'Назначить администратора', isAdmin: true, args: [{ name: 'ID / Имя' }, { name: 'Уровень' }] },
    { name: '/apanel', desc: 'Панель администратора', isAdmin: true },
    { name: '/setvip', desc: 'Выдать VIP статус', isAdmin: true, args: [{ name: 'ID игрока' }, { name: 'Дней' }] },
    { name: '/removevip', desc: 'Снять VIP статус', isAdmin: true, args: [{ name: 'ID игрока' }] },
    { name: '/vipinfo', desc: 'Информация о VIP', isAdmin: false, args: [{ name: 'ID игрока (опционально)' }] }
];

const LAYOUT_MAP = {
    'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p',
    'ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l',
    'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m'
};

const MAX_MESSAGES = 100;

window.specChatApp = new Vue({
    el: '.chat-wrap',
    data: {
        chatInput: '',
        chatShowInput: false,
        chatShowSettings: false,
        fontDropdownOpen: false,
        chatVisible: true,
        lang: 'EN',
        chatMessages: [],
        chatFilteredCommands: [],
        selectedHintIndex: -1,
        history: [],
        historyIdx: -1,
        isIdle: false,
        idleTimer: null,
        fontList: [
            'Arial Black',
            'Arial',
            'Proxima Nova ExtraBold',
            'Gotham Pro',
            'Fira Sans',
            'Sofia Sans',
            'IBM Plex Sans',
            'JetBrains Mono',
            'Sansation'
        ],
        paydayBox: {
            visible: false,
            title: '',
            time: '',
            rows: [],
            total: null,
            footer: null
        },
        settings: {
            showHints: true,
            showArgs: true,
            autoScroll: true,
            showTime: false,
            saveMessages: true,
            chatWidth: 520,
            chatHeight: 10,
            msgGap: 5,
            fontFamily: 'Gotham Pro',
            fontSize: 20,
            fontWeight: '600',
            textShadow: 'always',
            bgOpen: 0.30,
            bgClosed: 0.15,
            blur: 22,
            animations: false,
            autoHide: false,
            autoHideTime: 0,
            autoOpacity: false,
            idleOpacity: 0.35
        }
    },
    computed: {
        chatStyle() {
            let currentOpacity = 1;
            if (!this.chatShowInput && this.settings.autoOpacity) {
                currentOpacity = this.isIdle ? this.settings.idleOpacity : 1;
            }

            return {
                maxHeight: this.settings.chatHeight + 'vh',
                fontSize: this.settings.fontSize + 'px',
                fontWeight: this.settings.fontWeight,
                fontFamily: `"${this.settings.fontFamily}", Arial, sans-serif`,
                opacity: currentOpacity,
                transition: this.settings.animations ? 'opacity 0.3s ease' : 'none',
                '--msg-gap': this.settings.msgGap + 'px',
                textShadow: this.settings.textShadow === 'never' ? 'none' :
                            (this.settings.textShadow === 'open' && !this.chatShowInput) ? 'none' :
                            '1px 1px 0 #000, -1px -1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000'
            };
        },
        containerStyle() {
            return {
                width: this.settings.chatWidth + 'px',
                display: this.chatVisible ? 'flex' : 'none',
                fontFamily: `"${this.settings.fontFamily}", Arial, sans-serif`
            };
        },
        currentActiveCommand() {
            if (!this.chatInput.startsWith('/')) return null;
            const parts = this.chatInput.split(' ');
            if (parts.length < 2) return null;
            const cmdName = parts[0].toLowerCase();
            return CHAT_COMMANDS.find(c => c.name.toLowerCase() === cmdName) || null;
        },
        showHintsBox() {
            if (!this.chatInput.startsWith('/')) return false;
            return this.chatFilteredCommands.length > 0 || this.currentActiveCommand !== null;
        },
        currentArgOptions() {
            if (!this.currentActiveCommand || !this.currentActiveCommand.args) return null;
            const parts = this.chatInput.split(' ');
            const argIdx = parts.length - 2;
            const currentArg = this.currentActiveCommand.args[argIdx];
            
            if (currentArg && currentArg.options) {
                const val = parts[parts.length - 1].toLowerCase();
                return currentArg.options.filter(o => o.name.toLowerCase().includes(val));
            }
            return null;
        },
        paydayStyle() {
            return {
                background: 'rgba(40,40,40,0.7)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                borderRadius: '16px'
            };
        }
    },
    methods: {
        resetIdleTimer() {
            this.isIdle = false;
            if (this.idleTimer) clearTimeout(this.idleTimer);
            
            if (!this.chatShowInput && this.settings.autoOpacity) {
                const timeoutMs = (this.settings.autoHideTime || 3) * 1000;
                this.idleTimer = setTimeout(() => {
                    if (!this.chatShowInput && this.settings.autoOpacity) {
                        this.isIdle = true;
                    }
                }, timeoutMs);
            }
        },
        getCurrentArgIndex() {
            const parts = this.chatInput.split(' ');
            return parts.length - 2;
        },
        getArgValue(index) {
            const parts = this.chatInput.split(' ');
            const val = parts[index + 1];
            return (val !== undefined && val !== '') ? val : null;
        },
        selectFont(font) {
            this.settings.fontFamily = font;
            this.fontDropdownOpen = false;
            this.saveSettings();
        },
        saveSettings() {
            try { localStorage.setItem('amz_chat_settings', JSON.stringify(this.settings)); } catch(e) {}
            this.resetIdleTimer();
            this.$nextTick(() => this.initSliders());
        },
        updateSettings() {
            this.saveSettings();
        },
        loadSettings() {
            try {
                const s = localStorage.getItem('amz_chat_settings');
                if (s) this.settings = Object.assign({}, this.settings, JSON.parse(s));
            } catch(e) {}
        },
        onAutoHideChange() {
            this.settings.autoHide = this.settings.autoHideTime > 0;
            this.saveSettings();
        },
        onIdleOpacityChange() {
            this.settings.autoOpacity = this.settings.idleOpacity < 1;
            this.saveSettings();
        },
        updateSliderFill(e) {
            const el = e.target || e;
            if (!el || el.type !== 'range') return;
            const min = parseFloat(el.min) || 0;
            const max = parseFloat(el.max) || 100;
            const val = parseFloat(el.value);
            const percent = ((val - min) / (max - min)) * 100;
            el.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, rgba(255,255,255,0.14) ${percent}%, rgba(255,255,255,0.14) 100%)`;
        },
        initSliders() {
            this.$nextTick(() => {
                document.querySelectorAll('.settings-modal input[type=range]').forEach(el => {
                    this.updateSliderFill(el);
                    el.removeEventListener('input', this._sliderHandler);
                    this._sliderHandler = (e) => this.updateSliderFill(e);
                    el.addEventListener('input', this._sliderHandler);
                });
            });
        },
        formatColors(text) {
            let escaped = String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            
            let raw = escaped.replace(/\{([A-Fa-f0-9]{6})\}/g, '</span><span style="color:#$1">');
            return '<span>' + raw + '</span>';
        },
        addMessage(color, message, category, count = 1, backgroundHex = null) {
            this.resetIdleTimer();
            const now = new Date();
            const hh  = String(now.getHours()).padStart(2, '0');
            const mm  = String(now.getMinutes()).padStart(2, '0');
            const id  = Date.now() + Math.random();
            let clean = message;
            if (category !== 'Система' && !message.includes('Скриншот')) {
                clean = message.replace(/^(\d+[\s,]{1,2}\d+[\s,]{1,2}\d+[\s,]{0,2})/, '').trim();
            }
            let finalColor = (color && color.length >= 6) ? color : 'FFFFFF';
            const catHtml = category ? `<span style="color:rgba(255,255,255,0.6)">[${category}] </span>` : '';
            
            let formattedText = `<span style="color:#${finalColor}">${catHtml}${this.formatColors(clean)}</span>`;
            
            if (backgroundHex) {
                formattedText = `<span class="text-highlight" style="background: rgba(${this.hexToRgb(backgroundHex)}, 0.85); border-color: rgba(${this.hexToRgb(backgroundHex)}, 0.4);">${formattedText}</span>`;
            }
            const lastMsg = this.chatMessages[this.chatMessages.length - 1];
            if (lastMsg && lastMsg.rawText === message) {
                lastMsg.count = (parseInt(lastMsg.count) || 1) + 1;
            } else {
                this.chatMessages.push({
                    id,
                    time: `[${hh}:${mm}] `,
                    count: parseInt(count) || 1,
                    color: finalColor,
                    rawText: message,
                    text: formattedText
                });
            }
            while (this.chatMessages.length > MAX_MESSAGES) {
                this.chatMessages.shift();
            }
            this.$nextTick(() => {
                const el = this.$refs.chatMessages;
                if (el && this.settings.autoScroll) el.scrollTop = el.scrollHeight;
            });
        },
        hexToRgb(hex) {
            let bigint = parseInt(hex.replace('#', ''), 16);
            let r = (bigint >> 16) & 255;
            let g = (bigint >> 8) & 255;
            let b = bigint & 255;
            return `${r}, ${g}, ${b}`;
        },
        filterCommands() {
            if (this.chatInput.startsWith('.')) {
                let res = '/';
                for (const ch of this.chatInput.substring(1)) {
                    res += LAYOUT_MAP[ch] || ch;
                }
                this.chatInput = res;
            }
            const parts = this.chatInput.split(' ');
            const val = parts[0].toLowerCase();
            if (this.chatInput.startsWith('/') && parts.length <= 1) {
                this.chatFilteredCommands = CHAT_COMMANDS.filter(c => c.name.startsWith(val)).slice(0, 5);
            } else {
                this.chatFilteredCommands = [];
            }
            this.selectedHintIndex = -1;
            this.updateLanguage();
        },
        updateLanguage() {
            this.lang = /[а-яёА-ЯЁ]/.test(this.chatInput) ? 'RU' : 'EN';
        },
        selectCommand(name) {
            this.chatInput = name + ' ';
            this.filterCommands();
        },
        selectOption(optName) {
            const parts = this.chatInput.split(' ');
            parts[parts.length - 1] = optName;
            this.chatInput = parts.join(' ') + ' ';
            this.filterCommands();
        },
        handleKeyDown(e) {
            if ((e.altKey || e.ctrlKey) && e.shiftKey) {
                setTimeout(() => { this.lang = (this.lang === 'EN') ? 'RU' : 'EN'; }, 50);
            }
            const hasCmdHints = !this.currentActiveCommand && this.chatFilteredCommands.length > 0;
            const hasOptHints = this.currentActiveCommand && this.currentArgOptions && this.currentArgOptions.length > 0;
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    if (hasCmdHints) {
                        if (this.selectedHintIndex === -1) this.selectedHintIndex = this.chatFilteredCommands.length - 1;
                        else this.selectedHintIndex = (this.selectedHintIndex > 0) ? this.selectedHintIndex - 1 : this.chatFilteredCommands.length - 1;
                    } else if (hasOptHints) {
                        if (this.selectedHintIndex === -1) this.selectedHintIndex = this.currentArgOptions.length - 1;
                        else this.selectedHintIndex = (this.selectedHintIndex > 0) ? this.selectedHintIndex - 1 : this.currentArgOptions.length - 1;
                    } else if (this.historyIdx < this.history.length - 1) {
                        this.historyIdx++;
                        this.chatInput = this.history[this.history.length - 1 - this.historyIdx];
                        this.filterCommands();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (hasCmdHints) {
                        if (this.selectedHintIndex === -1) this.selectedHintIndex = 0;
                        else this.selectedHintIndex = (this.selectedHintIndex < this.chatFilteredCommands.length - 1) ? this.selectedHintIndex + 1 : 0;
                    } else if (hasOptHints) {
                        if (this.selectedHintIndex === -1) this.selectedHintIndex = 0;
                        else this.selectedHintIndex = (this.selectedHintIndex < this.currentArgOptions.length - 1) ? this.selectedHintIndex + 1 : 0;
                    } else if (this.historyIdx > 0) {
                        this.historyIdx--;
                        this.chatInput = this.history[this.history.length - 1 - this.historyIdx];
                        this.filterCommands();
                    } else {
                        this.historyIdx = -1;
                        this.chatInput = '';
                        this.filterCommands();
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (hasCmdHints && this.selectedHintIndex !== -1 && this.chatFilteredCommands[this.selectedHintIndex]) {
                        this.selectCommand(this.chatFilteredCommands[this.selectedHintIndex].name);
                        return;
                    }
                    if (hasOptHints && this.selectedHintIndex !== -1 && this.currentArgOptions[this.selectedHintIndex]) {
                        this.selectOption(this.currentArgOptions[this.selectedHintIndex].name);
                        return;
                    }
                    const msg = this.chatInput.trim();
                    if (msg) {
                        this.history.push(msg);
                        window.parent.postMessage({ type: 'spec-chat-submit', message: msg }, '*');
                    }
                    this.closeChat();
                    break;
                case 'Tab':
                    e.preventDefault();
                    if (hasCmdHints) {
                        if (this.selectedHintIndex === -1) {
                            this.selectedHintIndex = 0;
                        } else {
                            this.selectCommand(this.chatFilteredCommands[this.selectedHintIndex].name);
                        }
                    } else if (hasOptHints) {
                        if (this.selectedHintIndex === -1) {
                            this.selectedHintIndex = 0;
                        } else {
                            this.selectOption(this.currentArgOptions[this.selectedHintIndex].name);
                        }
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.closeChat();
                    break;
            }
        },
        openChat(prefix) {
            this.resetIdleTimer();
            this.chatShowInput = true;
            this.chatInput = prefix || '';
            this.historyIdx = -1;
            this.filterCommands();
            window.parent.postMessage({ type: 'spec-chat-input', active: true }, '*');
            this.$nextTick(() => {
                const el = document.getElementById('chat-input');
                if (el) el.focus();
            });
        },
        closeChat() {
            this.chatShowInput = false;
            this.chatShowSettings = false;
            this.fontDropdownOpen = false;
            this.chatInput = '';
            this.selectedHintIndex = -1;
            window.parent.postMessage({ type: 'spec-chat-input', active: false }, '*');
            this.resetIdleTimer();
        },
        handleGlobalKey(e) {
            if (!this.chatShowInput && (e.keyCode === 84 || e.keyCode === 117)) {
                e.preventDefault();
                this.openChat('');
            }
        },
        handleClickOutside(e) {
            const chatMain = this.$el.querySelector('.chat-main');
            const settingsModal = this.$el.querySelector('.settings-modal');
            const payday = this.$el.querySelector('.payday-box');

            if (this.chatShowSettings && settingsModal && !settingsModal.contains(e.target) && !e.target.closest('.gear-btn')) {
                this.chatShowSettings = false;
                this.fontDropdownOpen = false;
            }

            if (this.chatShowInput && chatMain && !chatMain.contains(e.target) && !e.target.closest('.settings-modal') && !e.target.closest('.payday-box')) {
                this.closeChat();
            }
        },
        showPayday(data) {
            if (!data) return;
            this.paydayBox = Object.assign({
                visible: true,
                title: '',
                time: '',
                rows: [],
                total: null,
                footer: null
            }, data);
        }
    },
    watch: {
        chatShowSettings(val) {
            if (val) {
                this.$nextTick(() => this.initSliders());
            }
        }
    },
    mounted() {
        this.loadSettings();
        this.resetIdleTimer();
        
        window.addEventListener('keydown', this.handleGlobalKey);
        document.addEventListener('mousedown', this.handleClickOutside);
        
        // This chat runs inside a HUD iframe, not a CEF browser of its own.
        // The parent HUD forwards server messages through postMessage.
        window.parent.postMessage({ type: 'spec-chat-ready' }, '*');

    },
    beforeDestroy() {
        window.removeEventListener('keydown', this.handleGlobalKey);
        document.removeEventListener('mousedown', this.handleClickOutside);
        if (this.idleTimer) clearTimeout(this.idleTimer);
    }
});

window.addEventListener('message', event => {
    if (event.source !== window.parent || !window.specChatApp) return;
    const data = event.data || {};
    if (data.type === 'spec-chat-open') window.specChatApp.openChat('');
    else if (data.type === 'spec-chat-message') {
        window.specChatApp.addMessage(data.color, data.message, data.category || '');
    }
});
