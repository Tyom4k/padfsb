// ================= CONFIG =================
const HUD_CONFIG = {
    DATE_UPDATE_INTERVAL_MS: 500,
    CIRCLE_RADIUS: 180,
    HEALTH_MAX: 100
};

const circumference = 2 * Math.PI * HUD_CONFIG.CIRCLE_RADIUS;
const numberFormatter = new Intl.NumberFormat('ru-RU');

function clearStaleDialogOverlay() {
    if (!document.getElementById('dialog_container') && !document.getElementById('ahelp-cef')) {
        document.body.classList.remove('dialog-active');
    }
}

// Administrators whose HUD ID badge must be blue before they authorize.
// Add other SA-MP nicknames here in the same form: 'Name_Surname'.
const PRELOGIN_ADMIN_NAMES = new Set([
    'danya_luxury'
]);

function isPreloginAdmin(name) {
    return PRELOGIN_ADMIN_NAMES.has(String(name || '').trim().replace(/\s+/g, '_').toLowerCase());
}


// ================= VUE =================
const main = new Vue({
    el: ".amazing-main-hud-block",

    data: {
        active: true,
        health: 0,
        id: 0,
        name: "",
        currentDate: "",
        currentTime: "",
        armour: 0,
        wanted: 0,
        money: 0,
        weapon: 0,
        ammo: "",
        isAdmin: false,
        isPreloginAdmin: false
    },

    computed: {
        healthCircleLength() {
            return circumference;
        },

        healthStrokeDashoffset() {
            const percent = Math.min(100, Math.max(0, this.health)) / 100;
            return circumference * (1 - percent);
        },

        isWeaponFire() {
            return (this.weapon >= 22 && this.weapon <= 38) ||
                   this.weapon === 41 ||
                   this.weapon === 42;
        },

        healthPercent() {
            return Math.min(100, Math.max(0, Number(this.health) || 0));
        },

        ammoNow() {
            return String(this.ammo).split('/')[0] || '0';
        },

        ammoLeft() {
            return String(this.ammo).split('/')[1] || '0';
        },

        idClass() {
            return {
                'admin-id': this.isAdmin || this.isPreloginAdmin,
                'user-id': !this.isAdmin && !this.isPreloginAdmin
            };
        }
    },

    methods: {
        getInterface() {
            return this.removeUnderscores(this.name);
        },

        removeUnderscores(str) {
            return str ? str.replace(/_/g, ' ') : '';
        },

        formatNumber(value) {
            return numberFormatter.format(value);
        },

        // ⭐ НОВАЯ ЛОГИКА ДАТЫ/ВРЕМЕНИ — КАК НА МАКЕТЕ
        updateDateTime() {
            const now = new Date();

            // === ДАТА: DD.MM.YYYY ===
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = String(now.getFullYear());

            this.currentDate = `${day}.${month}.${year}`;

            // === ВРЕМЯ: HH:MM:SS ===
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            this.currentTime = `${hours}:${minutes}:${seconds}`;
        },

        applyPlayerStats(hp, maxHp, arm, breath, wanted, weapon, ammo, maxAmmo, money, speed) {
            this.health = Math.round(hp);
            this.armour = Math.round(arm);
            this.money = money;
            this.weapon = weapon;

            const remainingAmmo = Math.max(0, maxAmmo - ammo);
            this.ammo = `${ammo}/${remainingAmmo}`;

            if (typeof state !== 'undefined') state.speed = speed;
            if (typeof updateSpeedometer === 'function') updateSpeedometer();
        },

        bindCefBridge() {
            if (this._cefBridgeBound) return true;
            if (!window.cef || typeof window.cef.on !== 'function' || typeof window.cef.emit !== 'function') return false;

            this._cefBridgeBound = true;
            const bridge = window.cef;

            // The HUD browser is created only for the in-game interface. Keep
            // its DOM mounted permanently: transient/late state packets must
            // never tear down the page and make the HUD flash.
            bridge.on("Lethality(executeEvent['main.hud.active'])", v => {
                if (Number(v) !== 0) this.active = true;
            });
            bridge.on("Lethality(executeEvent['main.hud.wanted'])", v => this.wanted = Number(v) || 0);
            bridge.on("Lethality(executeEvent['main.hud.id'])", v => this.id = Number(v) || 0);
            bridge.on("Lethality(executeEvent['main.hud.name'])", v => {
                this.name = v;
                this.isPreloginAdmin = isPreloginAdmin(v);
            });
            bridge.on("Lethality(executeEvent['main.hud.admin'])", v => this.isAdmin = Number(v) !== 0);
            bridge.on('game:data:playerStats', (...stats) => this.applyPlayerStats(...stats));
            bridge.on('hud:ping', token => bridge.emit('hud:pong', String(token)));
            bridge.on('hud:restore', token => {
                // Compatibility only for clients that still send the old
                // recovery request. Never mutate CSS or the compositor layer.
                this.active = true;
                bridge.emit('hud:pong', String(token || 0));
            });

            // Hide only GTA's native HUD; this CEF page itself stays visible.
            bridge.emit('game:hud:setComponentVisible', 'interface', false);
            bridge.emit('game:hud:setComponentVisible', 'radar', true);
            bridge.emit('game:data:pollPlayerStats', true, 100);

            // One quiet retry covers a slow server/plugin handshake. Do not
            // announce on focus/pageshow: Alt+Tab must not touch HUD state.
            const announceReady = () => bridge.emit('hud:ready');
            announceReady();
            setTimeout(announceReady, 1500);
            return true;
        },

        waitForCefBridge() {
            const started = Date.now();
            if (this.bindCefBridge()) return;

            const timer = setInterval(() => {
                if (this.bindCefBridge() || Date.now() - started >= 30000) clearInterval(timer);
            }, 100);
        }
    },

    mounted() {
        clearStaleDialogOverlay();
        this.updateDateTime();

        setInterval(() => {
            this.updateDateTime();
        }, HUD_CONFIG.DATE_UPDATE_INTERVAL_MS);

        this.waitForCefBridge();
    }
});
