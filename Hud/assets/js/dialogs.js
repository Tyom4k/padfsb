let currentDialog = null;
let lastDialogPayload = null;
let dialogDragCleanup = null;

function setDialogOverlayState(active) {
    document.body.classList.toggle("dialog-active", Boolean(active));
}

function syncDialogOverlayState() {
    const active = Boolean(
        document.getElementById("dialog_container") ||
        document.getElementById("ahelp-cef")
    );
    setDialogOverlayState(active);
}

function publishDialogBounds(container) {
    if (!window.cef || typeof cef.emit !== "function") return;
    if (!container) {
        cef.emit("dialog:bounds", "-1|-1|0|0");
        return;
    }
    const rect = container.getBoundingClientRect();
    cef.emit("dialog:bounds", `${Math.round(rect.left)}|${Math.round(rect.top)}|${Math.round(rect.width)}|${Math.round(rect.height)}`);
}

function restoreDialogFocus() {
    if (!currentDialog || !window.cef) return;
    if (typeof cef.set_focus === "function") cef.set_focus(true);
    const input = document.getElementById("dialogInput");
    if (input && document.activeElement !== input) input.focus();
}

// ================== UTILS ==================
function formatColorText(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
        .replace(/\{(\w{3}|\w{6})\}([^{}]*)/gi,
            (_, color, text) =>
                `<span style="color:#${color}">${text}</span>`
        );
}

function removeDialogEventListeners() {
    window.removeEventListener("click", dialogClickHandler);
    window.removeEventListener("keyup", dialogKeyHandler);
    if (dialogDragCleanup) {
        dialogDragCleanup();
        dialogDragCleanup = null;
    }
}

// ================== INPUT ==================
function dialogKeyHandler(e) {
    if (!currentDialog) return;
    // The chat deliberately opens above dialogs (F6). Its keys must never
    // trigger the dialog's Enter/Escape handlers.
    if (e.target && e.target.id === "cef-chat-input") return;

    if (e.key === "Escape") {
        currentDialog.response = 0;
        return callDialogResponse();
    }

    if (e.key === "Enter") {
        if (currentDialog.type === 1 || currentDialog.type === 3) {
            const input = document.getElementById("dialogInput");
            currentDialog.inputText = input ? input.value : "";
        }
        currentDialog.response = 1;
        return callDialogResponse();
    }

    if (currentDialog.type === 2 || currentDialog.type === 4 || currentDialog.type === 5) {
        if (e.key === "ArrowDown") moveList(1);
        if (e.key === "ArrowUp") moveList(-1);
    }
}

function dialogClickHandler(e) {
    const item = e.target.closest(".dialogItem");
    if (!item || !currentDialog) return;

    const value = +item.dataset.value;
    if (isNaN(value)) return;

    currentDialog.listItem = value;
    updateList();
}

// ================== LIST ==================
function moveList(dir) {
    let next = currentDialog.listItem + dir;

    if (next < 0) next = 0;
    if (next > currentDialog.maxListItem)
        next = currentDialog.maxListItem;

    currentDialog.listItem = next;
    updateList();
}

function updateList() {
    const items = document.querySelectorAll(".dialogItem");

    items.forEach(el => el.classList.remove("white_back"));

    const active = items[currentDialog.listItem];
    if (active) active.classList.add("white_back");
}

// ================== RESPONSE ==================
function callDialogResponse() {
    removeDialogEventListeners();

    // sscanf on the Pawn side must receive a fourth, non-empty field. List
    // dialogs have no input, so send a marker and restore an empty string
    // server-side before OnDialogResponse is called.
    const input = currentDialog.inputText.replace(/\|/g, " ") || "~";

    // Clear the cached dialog before emitting the response. The old code kept
    // lastDialogPayload alive until the server's hide event arrived; any window
    // focus/pageshow event in that gap recreated the closed dialog and enabled
    // the mouse cursor permanently.
    lastDialogPayload = null;

    cef.emit(
        "dialog:response",
        `${currentDialog.id}|${currentDialog.response}|${currentDialog.listItem}|${input}`
    );

    document.getElementById("dialog_container")?.remove();

    currentDialog = null;
    setDialogOverlayState(false);
    publishDialogBounds(null);
    cef.set_focus(false);
}

// ================== CREATE ==================
function createDialog(id, type, header, text, btn1, btn2) {
    document.getElementById("dialog_container")?.remove();
    removeDialogEventListeners();

    currentDialog = {
        id,
        type,
        listItem: 0,
        maxListItem: 0,
        response: 1,
        inputText: ""
    };

    const container = document.createElement("div");
    container.id = "dialog_container";

    container.innerHTML = `
        <div class="dialogHeader">${formatColorText(header)}</div>
        <div class="dialogText"></div>
        <div class="buttons">
            <div class="clickBtn clickBtn1">${btn1}</div>
            ${btn2 ? `<div class="clickBtn clickBtn2">${btn2}</div>` : ""}
        </div>
    `;

    document.body.appendChild(container);
    setDialogOverlayState(true);

    // Drag only by the title bar. Use mouse events rather than PointerEvent:
    // the CEF build used by SA-MP forwards mouse events more reliably.
    const headerBar = container.querySelector(".dialogHeader");
    let drag = null;
    const stopDragging = () => { drag = null; };
    headerBar.addEventListener("mousedown", event => {
        if (event.button !== 0 || event.target.closest("button, input, a")) return;
        const rect = container.getBoundingClientRect();
        drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        container.style.transform = "none";
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        event.preventDefault();
    });
    const moveDialog = event => {
        if (!drag) return;
        const maxX = Math.max(0, window.innerWidth - container.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - container.offsetHeight);
        container.style.left = `${Math.max(0, Math.min(maxX, event.clientX - drag.x))}px`;
        container.style.top = `${Math.max(0, Math.min(maxY, event.clientY - drag.y))}px`;
        publishDialogBounds(container);
    };
    window.addEventListener("mousemove", moveDialog);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("blur", stopDragging);
    headerBar.addEventListener("dragstart", event => event.preventDefault());
    dialogDragCleanup = () => {
        window.removeEventListener("mousemove", moveDialog);
        window.removeEventListener("mouseup", stopDragging);
        window.removeEventListener("blur", stopDragging);
        drag = null;
    };

    const content = container.querySelector(".dialogText");

    // ===== TYPES =====
    if (type === 0) {
        content.innerHTML = formatColorText(text);
    }

    if (type === 1 || type === 3) {
        content.innerHTML = formatColorText(text);

        const input = document.createElement("input");
        input.id = "dialogInput";
        input.className = "dialog_input";
        input.type = type === 3 ? "password" : "text";
        input.autofocus = true;

        content.appendChild(input);
        input.addEventListener("mousedown", event => {
            event.stopPropagation();
            restoreDialogFocus();
        });
    }

    if (type === 2 || type === 4) {
        const lines = text.split("\n").filter(Boolean);

        lines.forEach((line, i) => {
            content.insertAdjacentHTML(
                "beforeend",
                `<div class="dialogItem" data-value="${i}">
                    ${formatColorText(line)}
                </div>`
            );
        });

        currentDialog.maxListItem = lines.length - 1;
        updateList();
    }

    if (type === 5) {
        const lines = text.split("\n").filter(Boolean);

        lines.forEach((line, i) => {
            const row = line
                .split("\t")
                .map(cell => `<div class="dialogCell">${formatColorText(cell)}</div>`)
                .join("");

            content.insertAdjacentHTML(
                "beforeend",
                `<div class="dialogItem tablist_headers" data-value="${i}">
                    ${row}
                </div>`
            );
        });

        currentDialog.maxListItem = lines.length - 1;
        updateList();
    }

    // ===== BUTTONS =====
    container.querySelector(".clickBtn1").onclick = () => {
        if (type === 1 || type === 3) {
            currentDialog.inputText =
                document.getElementById("dialogInput")?.value || "";
        }
        currentDialog.response = 1;
        callDialogResponse();
    };

    container.querySelector(".clickBtn2")?.addEventListener("click", () => {
        currentDialog.response = 0;
        callDialogResponse();
    });

    // ===== EVENTS =====
    window.addEventListener("keyup", dialogKeyHandler);
    window.addEventListener("click", dialogClickHandler);

    requestAnimationFrame(() => {
        publishDialogBounds(container);
        restoreDialogFocus();
    });
    cef.set_focus(true);
}

// Do not recreate dialogs from browser focus/pageshow events. Only a fresh
// server dialog:show event may open an interactive overlay and enable cursor.

// Do not let an open dialog swallow F6. The key is forwarded to the game
// bridge, while all other dialog navigation remains unchanged.
window.addEventListener("keydown", e => {
    if (e.key === "F6") {
        e.preventDefault();
        if (window.cef && typeof cef.emit === "function") cef.emit("dialog:f6", "F6");
    }
}, true);

// CEF can lose native focus after the game window is restored or another
// overlay closes. Re-focus only while a real dialog is open; this never leaves
// the mouse cursor enabled after the dialog has been closed.
window.addEventListener("focus", () => {
    syncDialogOverlayState();
    restoreDialogFocus();
});
window.addEventListener("pageshow", syncDialogOverlayState);
window.addEventListener("resize", syncDialogOverlayState);
// A native CEF hide event can be lost while SA-MP changes focus. Reconcile
// the class with the actual overlay DOM without rebuilding or flashing HUD.
setInterval(syncDialogOverlayState, 750);

// ================== CEF ==================
function showCefDialog(payload) {
    const data = String(payload || "").split("\x1e");
    if (data.length !== 6) return;
    lastDialogPayload = { id: Number(data[0]), type: Number(data[1]), header: data[2], text: data[3], btn1: data[4], btn2: data[5] };
    createDialog(lastDialogPayload.id, lastDialogPayload.type, lastDialogPayload.header, lastDialogPayload.text, lastDialogPayload.btn1, lastDialogPayload.btn2);
}

cef.on("dialog:show", showCefDialog);
// Kept for compatibility with the old HUD bridge.
cef.on("show_dialog", showCefDialog);
cef.on("dialog:hide", () => {
    removeDialogEventListeners();
    document.getElementById("dialog_container")?.remove();
    currentDialog = null;
    lastDialogPayload = null;
    setDialogOverlayState(false);
    publishDialogBounds(null);
    cef.set_focus(false);
});

// ================== ADMIN CEF WIKI ==================
const ahelpSections = [
    { title: "Администрирование", text: "/alogin — вход администратора\n/a — админ-чат\n/apanel — панель администратора\n/admins — администрация онлайн\n/afk — список AFK\n/astats — личная статистика\n/ac_logs — логи античита\n/pm — ответ игроку\n/check, /offcheck — информация об игроке\n/ainfo, /agetid — расширенная проверка" },
    { title: "Наказания", text: "/kick, /akick, /skick — отключить игрока\n/ban, /sban, /iban, /offban — блокировка\n/unban, /banip, /unbanip — управление блокировками\n/mute, /unmute, /offmute — блокировка чата\n/warn, /unwarn, /offwarn — предупреждения\n/jail, /unjail, /offjail — админ-тюрьма\n/freeze, /unfreeze — заморозка\n\nАдминистраторы из /test не могут применять наказания." },
    { title: "Игроки и телепорты", text: "/goto, /agoto — телепорт к игроку\n/gethere — переместить игрока к себе\n/tp, /tpc, /tpcoord, /tpcor — телепорты\n/tpint, /setint, /setworld, /setvirt — интерьер и мир\n/gotocar, /gotoveh, /gotobiz, /gotohouse — к объекту\n/spec, /specoff — наблюдение\n/slap, /spawn, /sethp — действия над игроком\n/cuff, /uncuff, /auncuff — наручники" },
    { title: "Мир, транспорт и объекты", text: "/veh, /plveh — создать транспорт\n/delveh, /alldelveh — удалить транспорт\n/fixveh, /fixcar, /res — ремонт или респавн\n/setfuel, /fuelcars — топливо\n/asetaudio — установить аудиосистему в текущую машину\n/delaudio — снять аудиосистему с текущей машины\n/setweather, /settime — погода и время\n/picup, /delpicup — пикапы\n/object, /object1, /sobject — объекты\n/createzone, /createredzone — зоны\n/createradar — радар\n/gmx — перезапуск режима" },
    { title: "Фракции", text: "/leaders, /aleaders — список лидеров\n/setleader, /ainvite — управление лидерами\n/invite, /uninvite, /giverank — состав\n/fgiverank, /funinvite — управление фракцией\n/uval — уволить игрока\n/capture, /bizwar — войны территорий\n/fdpanel, /lpanel — панели\n/gnews, /news, /megaphone — объявления\n/arrest, /unarrest — задержание" },
    { title: "Аккаунты и права", text: "/setadmin — уровень администратора\n/banadm, /unbanadm — блокировка админ-прав\n/arevoke [ник] — навсегда снять права и запретить /test\n/setlvl, /setvip, /setprefix — параметры аккаунта\n/givemoney, /givecredits — валюта\n/giveinv, /checkinv — инвентарь\n/givegun, /givegunall — оружие\n/setskill, /setstat, /setsex, /setskin — характеристики\n/clist — цвет ника администратора" },
    { title: "Мероприятия", text: "/mp, /mpanel — панель мероприятия\n/settp — точка мероприятия\n/startrace, /astartrace — гонка\n/startpb — Paintball/CS\n/startivent, /fivent — ивенты\n/duel — дуэль\n/msg — объявление администратора\n/clearchat, /cc — очистка чата\n/notify, /notifyright — уведомления\n/anticheat, /anticheat2 — античит\n/gm — проверка GodMode" },
    { title: "Игровые команды", text: "/help, /cmd — помощь игрока\n/report, /ask, /rep — обращение к администрации\n/gps, /tgps, /hgps — навигация\n/stats, /id, /get — информация\n/sms, /call — связь\n/family, /famonline — семья\n/home, /hmenu — дом\n/car_info, /carmenu — транспорт\n/buybiz, /bpanel — бизнес\n/quitjob — покинуть работу\n/anim, /animlist — анимации" }
];

const ahelpAllCommands = (`a aaadelveh aastartrace ab abonus ac_logs aclear activate acuff ad add adivorce admdown admins admremove admup afk afly agetid agg agiverank agivevoen agl agoto ahelp ahelpers ainfo ainvite airbrake akick aleaders alldelveh alogin ame amusic anim animka1 animka2 animka3 animlist ans anticheat anticheat2 apanel arrest arrestcar asetaudio ask astartrace astats atake atakegun audition auncuff aunwarn b b_add_prod ban banadm baninfo banip baton bizwar bomb bootle bpanel buybiz buybomb c call cancel canceldice cancelorder capture car_info carmenu cc changebizz changecar changehouse changeskin charity check check_acc_ip check_bank checkad checkask checkinv checkrep chstats circle clear clearchat clearicon clearicon1 cleartop clist close closecameditor cmd cont_info contract controlmost coord createpodezd createradar createredzone createzone ctune cuff d deactivate delaudio delete_cont delpicup delveh dice dim diplom divorce divorceid dj dn do donat donate down dpsgate dstats duel dump easter_spawn editdps editfsb editfsb2 eject end endrc eviction exit exitcs exitgame f family famonline fare fdkit fdpanel fgiverank fin find findcar findcopter finvite fivent fixcar fixcopter fixveh flight fly fmute fn freeze friends frisk fsbgate fsbgate2 fstyle fuel fuelcars funinvite g gcar gcontrol gcreturn get get_player_skin get_stats get_vi getbizstats getcar getgiftpos gethere getip ghostchange give_coupone givecredits givecreditsoff giveflowers givefull givegun givegunall giveinv givemoney givepumpkin giverank givevoen gm gmx gnews gomchs gomechanic gomedhelp gopolice gotaxi goto gotobiz gotocar gotohouse gotome gotomp gotoveh govno gps grandadmins gun gzcolor halloween halloween_inv hc heal healing healme help helpers hgps hhelp hi hinfoo history hmenu home hookah hostname hp hstats iban id incar init_glass inv invite ivent iznas jail jaillist jet k kal kal_anim kalmar_rope kick kiss klad_list leaders leave left lic load_money loadcars2 loadgun lock lpanel lunwarn lwarn m mainmenu market market_info mask me med megaphone menu miglo mm mn mp mpanel msg mute mutelist mymonopoly myworld n nbank neon net news newyear no normveh notify notifyinteractive notifyright npanel number nydrop nyinfo nyspawn object object1 offaunwarn offawarn offban offcheck offget offgoto offiban offjail offlunwarn offlwarn offmute offunjail offunmute offwarn packages park parkcopter pass pay payday pet pgetip picup play plveh pm pmenu portable promocodes pts push quest quitjob r race radio ram recorder referal refill reg_among_us rekl removetiktok removeyoutube rep report res resetmoney return_int right rmute rn rob rpanel rt rtune ruletka ruletkaa s salelic saveparrot sban search select selfie sellcar sellcopter sellmybiz sellmycar sellmycopter sellmyhouse sellsim sellzone set_c_time set_easter set_market_info set_squid_prize setadmin setam setbizprod setcar setcarh setcs setcs1 setfuel setgiftpos seth sethalloween sethash sethdrop sethp setint setleader setlvl setmiglo setprefix setrecorder setsex setskill setskin setspawn setstat setsub settiktok settime settiming settp setumvd setumvdleader setvh setvip setvirt setweather setworld setyoutube setzarall sex sh_speed show_auth show_normal_hookah show_num show_plate show_random_hookah show_tune skick skill skin skinids slap smoke sms sobject soe sp spawn spawn_cont spawn_dcont spawn_treasure spawnpumpkin spec specoff sperm spoff squid start_squid startivent startpb startpubg startrace startsquid stats stickers su suspect svarn_money t tachki take take_plate takerecorder temp_show_quest tempskin test test_anim test_poloska testweapon tgps ticket tie time timetobonus togphone tools top tow tp tpc tpcoord tpcor tpint tptopum tptptree tree try tskill twarn twarns umvdmenu umvdskin unammo unarrest unavig unban unbanadm unbanip uncuff unfreeze uninvite unjail unloadgun unmask unmute unprison unrmute untie untwarn unwarn up use usedrugs usezezl uval v vad vaunwarn vawarn veh vidok viphelp vmute vpc vunmute w wanted warn weaponids wedding work_cancelorder work_debug work_deer work_ruletka y yes zone2`).trim().split(/\s+/).sort();

function closeAdminWiki() {
    document.getElementById('ahelp-cef')?.remove();
    window.removeEventListener('keydown', adminWikiEscape);
    syncDialogOverlayState();
    publishDialogBounds(null);
    if (window.cef && typeof cef.set_focus === 'function') cef.set_focus(false);
}

function adminWikiEscape(event) {
    if (event.key === 'Escape') closeAdminWiki();

    const content = document.getElementById('ahelp-content');
    if (!content || event.target?.tagName === 'INPUT') return;
    const page = Math.max(120, content.clientHeight - 60);
    if (event.key === 'PageDown') content.scrollTop += page;
    else if (event.key === 'PageUp') content.scrollTop -= page;
    else if (event.key === 'Home') content.scrollTop = 0;
    else if (event.key === 'End') content.scrollTop = content.scrollHeight;
    else return;
    event.preventDefault();
}

function showAdminWiki() {
    document.getElementById('dialog_container')?.remove();
    removeDialogEventListeners();
    currentDialog = null;
    document.getElementById('ahelp-cef')?.remove();

    const root = document.createElement('div');
    root.id = 'ahelp-cef';
    root.innerHTML = `<div class="ahelp-window">
        <aside class="ahelp-sidebar">
            <div class="ahelp-brand"><b>SLIV</b><span>ADMIN WIKI</span></div>
            <button class="ahelp-tab active" data-section="0">Главная</button>
            ${ahelpSections.map((section, index) => `<button class="ahelp-tab" data-section="${index + 1}">${section.title}</button>`).join('')}
            <button class="ahelp-tab" data-section="all">Все 536 команд</button>
        </aside>
        <main class="ahelp-main">
            <header><div><small>БАЗА ЗНАНИЙ ПРОЕКТА</small><h1>Команды администратора</h1></div><button id="ahelp-close">×</button></header>
            <div class="ahelp-search-wrap"><input id="ahelp-search" placeholder="Поиск команды, например: ban, goto, vehicle"></div>
            <section id="ahelp-content"></section>
        </main>
    </div>`;
    document.body.appendChild(root);
    setDialogOverlayState(true);

    const content = root.querySelector('#ahelp-content');
    const search = root.querySelector('#ahelp-search');
    const scrollWiki = event => {
        const delta = Number(event.deltaY || 0);
        if (!delta || content.scrollHeight <= content.clientHeight) return;
        content.scrollTop += delta;
        event.preventDefault();
        event.stopPropagation();
    };
    content.addEventListener('wheel', scrollWiki, false);
    const renderHome = () => {
        content.innerHTML = `<div class="ahelp-hero"><h2>Полная Wiki команд</h2><p>Выберите раздел слева или воспользуйтесь поиском. В индекс загружены все 536 команд из текущего исходника мода.</p></div><div class="ahelp-cards">${ahelpSections.map((s, i) => `<button class="ahelp-card" data-open="${i + 1}"><b>${s.title}</b><span>${s.text.split('\n').length} подсказок</span></button>`).join('')}</div>`;
        content.scrollTop = 0;
        content.querySelectorAll('[data-open]').forEach(button => button.onclick = () => selectSection(button.dataset.open));
    };
    const renderSection = index => {
        const section = ahelpSections[index - 1];
        content.innerHTML = `<div class="ahelp-section"><h2>${section.title}</h2>${section.text.split('\n').map(line => line ? `<div class="ahelp-line">${line.replace(/^(\/[^ —,]+)/, '<b>$1</b>')}</div>` : '<br>').join('')}</div>`;
        content.scrollTop = 0;
    };
    const renderCommands = query => {
        const normalized = String(query || '').trim().toLowerCase().replace(/^\//, '');
        const filtered = ahelpAllCommands.filter(command => !normalized || command.includes(normalized));
        content.innerHTML = `<div class="ahelp-section"><h2>${normalized ? `Найдено: ${filtered.length}` : 'Все 536 команд'}</h2><p>Введите команду в чат без параметров, чтобы увидеть её точный синтаксис.</p><div class="ahelp-command-grid">${filtered.map(command => `<span>/${command}</span>`).join('')}</div></div>`;
        content.scrollTop = 0;
    };
    const selectSection = value => {
        root.querySelectorAll('.ahelp-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.section === String(value)));
        search.value = '';
        if (value === 'all') renderCommands('');
        else if (Number(value) === 0) renderHome();
        else renderSection(Number(value));
    };

    root.querySelectorAll('.ahelp-tab').forEach(tab => tab.onclick = () => selectSection(tab.dataset.section));
    root.querySelector('#ahelp-close').onclick = closeAdminWiki;
    search.addEventListener('input', () => renderCommands(search.value));
    window.addEventListener('keydown', adminWikiEscape);
    renderHome();
    if (window.cef && typeof cef.set_focus === 'function') cef.set_focus(true);
}

cef.on('ahelp:show', showAdminWiki);
