(function announceSlivClientBuild() {
    const build = "141341";
    const started = Date.now();
    let bridgeBound = false;

    function bindBridge() {
        if (!window.cef || typeof window.cef.on !== "function" || typeof window.cef.emit !== "function") {
            return false;
        }
        // hud.js owns the single hud:ping listener. Registering it here too
        // produced duplicate pong packets and could make the server recovery
        // state oscillate while another CEF overlay was closing.
        bridgeBound = true;
        return true;
    }

    function announce() {
        if (bindBridge()) {
            window.cef.emit("client:build", build);
            return;
        }
        if (Date.now() - started < 30000) setTimeout(announce, 100);
    }

    // Build verification is sent once and stays completely in the background.
    // Focus/pageshow must not re-run the HUD lifecycle after Alt+Tab.
    announce();
})();
