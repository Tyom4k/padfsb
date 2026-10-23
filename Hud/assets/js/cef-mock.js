if (typeof cef === 'undefined') {
    console.warn("CEF is not defined. Using mock object for development.");
    
    const events = {};

    window.cef = {
        on: function(event, callback) {
            console.log(`[CEF Mock] Registered listener for event: ${event}`);
            if (!events[event]) events[event] = [];
            events[event].push(callback);
            
            // Тестовые данные при регистрации
            if (event === "game:data:playerStats") {
                setTimeout(() => callback(100, 100, 50, 100, 0, 24, 30, 90, 1500, 80), 1000);
            }
            if (event.includes("main.hud.name")) {
                setTimeout(() => callback("Player_Name"), 500);
            }
            if (event.includes("main.hud.id")) {
                setTimeout(() => callback(123), 500);
            }
            if (event.includes("main.hud.active")) {
                setTimeout(() => callback(true), 100);
            }
        },
        off: function(event, callback) {
            console.log(`[CEF Mock] Removed listener for event: ${event}`);
            if (events[event]) {
                events[event] = events[event].filter(cb => cb !== callback);
            }
        },
        emit: function(event, ...args) {
            console.log(`[CEF Mock] Emitted event: ${event}`, args);
            
            // Если есть слушатели на этот ивент внутри JS (имитация ответа сервера)
            if (events[event]) {
                events[event].forEach(cb => cb(...args));
            }

            // Обработка некоторых эмит-событий для управления видимостью
            if (event === "game:hud:setComponentVisible") {
                const component = args[0];
                const visible = args[1];
                console.log(`[CEF Mock] Setting component ${component} visibility to ${visible}`);
                
                if (component === "radar") {
                    if (typeof toggleSpeedometer === 'function') {
                        toggleSpeedometer(visible ? 1 : 0);
                    }
                }

                if (component === "interface") {
                    const hudActiveEvent = "Lethality(executeEvent['main.hud.active'])";
                    if (events[hudActiveEvent]) {
                        events[hudActiveEvent].forEach(cb => cb(visible));
                    }
                }
            }
        },
        invoke: function(name, ...args) {
            console.log(`[CEF Mock] Invoked method: ${name}`, args);
            return Promise.resolve();
        },
        set_focus: function(focused) {
            console.log(`[CEF Mock] Set focus to: ${focused}`);
        }
    };

    // Глобальные помощники для разработчика
    window.testHud = {
        show: () => {
            const eventName = "Lethality(executeEvent['main.hud.active'])";
            if (events[eventName]) events[eventName].forEach(cb => cb(true));
        },
        hide: () => {
            const eventName = "Lethality(executeEvent['main.hud.active'])";
            if (events[eventName]) events[eventName].forEach(cb => cb(false));
        },
        setMoney: (val) => {
            cef.emit("game:data:playerStats", 100, 100, 50, 100, 0, 24, 30, 90, val, 80);
        },
        toggleSpeedo: (visible) => {
            cef.emit("game:ToggleSpeedometer", visible);
        },
        setSpeed: (speed, mileage = "000123") => {
            cef.emit("game:SetSpeed", speed, mileage);
        },
        setFuel: (val) => {
            cef.emit("game:SetSpeedFuel", val);
        },
        setVehHealth: (val) => {
            cef.emit("game:SetSpeedHealth", val);
        },
        setEngine: (state) => {
            cef.emit("game:SetSpeedEngine", state);
        },
        setDoors: (state) => {
            cef.emit("game:SetSpeedDoors", state);
        },
        setLights: (state) => {
            cef.emit("game:SetSpeedLights", state);
        },
        setStage: (val) => {
            cef.emit("game:SetSpeedStage", val);
        },
        setName: (name) => {
            cef.emit("Lethality(executeEvent['main.hud.name'])", name);
        },
        setID: (id) => {
            cef.emit("Lethality(executeEvent['main.hud.id'])", id);
        },
        setAdmin: (isAdmin) => {
            cef.emit("Lethality(executeEvent['main.hud.admin'])", isAdmin);
        },
        showAuth: () => {
            window.location.href = "../AuthModule/index.html";
        }
    };
    
    console.log("%c[CEF Mock] Helpers available: testHud.show(), testHud.hide(), testHud.setMoney(val), testHud.toggleSpeedo(bool), testHud.setSpeed(val), testHud.setFuel(val), testHud.setVehHealth(val), testHud.setEngine(bool), testHud.setDoors(bool), testHud.setLights(bool), testHud.setStage(val), testHud.showAuth()", "color: green; font-weight: bold;");
}
