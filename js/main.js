document.addEventListener('keydown', (e) => {
    if (
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'F12') ||
        e.key === 'F12'
    ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
    }
});

document.addEventListener('DOMContentLoaded', async function () {
    'use strict';

    // ==================== SIMPLE PERFORMANCE MANAGER ====================
    class SimplePerformanceManager {
        constructor() {
            this.fps = 60;
            this.lastTime = performance.now();
            this.frameCount = 0;
            this.lowFPSThreshold = 45;
            this.performanceMode = false;

            this.init();
        }

        init() {
            this.startFPSMonitoring();
        }

        startFPSMonitoring() {
            const measureFPS = (currentTime) => {
                this.frameCount++;

                if (currentTime - this.lastTime >= 1000) {
                    this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));

                    // Update UI FPS counter
                    const fpsEl = document.getElementById('dp-fps');
                    if (fpsEl) {
                        fpsEl.textContent = this.fps;
                    }

                    // Dynamic performance adjustment
                    if (this.fps < this.lowFPSThreshold && !this.performanceMode) {
                        this.enablePerformanceMode();
                    } else if (this.fps > 55 && this.performanceMode) {
                        this.disablePerformanceMode();
                    }

                    this.frameCount = 0;
                    this.lastTime = currentTime;
                }

                requestAnimationFrame(measureFPS);
            };

            requestAnimationFrame(measureFPS);
        }

        enablePerformanceMode() {
            if (this.performanceMode) return;

            this.performanceMode = true;
            document.body.classList.add('performance-mode');
            console.log('🔧 Performance mode enabled - FPS:', this.fps);
        }

        disablePerformanceMode() {
            if (!this.performanceMode) return;

            this.performanceMode = false;
            document.body.classList.remove('performance-mode');
        }
    }

    // Initialize performance manager
    const perfManager = new SimplePerformanceManager();

    // ==================== IMPROVED LAZY LOADER ====================
    class ImprovedLazyLoader {
        constructor() {
            this.observer = null;
            this.init();
        }

        init() {
            // Ko'proq elementlarni oldindan yuklash uchun kattaroq margin
            const options = {
                root: null,
                rootMargin: '300px 0px', // 300px oldindan yuklash
                threshold: 0.1, // 10% ko'rinsa yuklash
            };

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        this.loadImage(img);
                        this.observer.unobserve(img);
                    }
                });
            }, options);
        }

        loadImage(img) {
            const src = img.dataset.src;
            if (!src) return;

            // To'g'ridan-to'g'ri yuklash
            img.src = src;
            img.classList.remove('lazy');

            // Yuklanganda animatsiya
            img.onload = () => {
                // Avval animatsiya uchun tayyorlaymiz
                // Agar u allaqachon opacity 0 bo'lsa, tegmaymiz

                requestAnimationFrame(() => {
                    img.style.transition = 'opacity 0.3s ease';

                    // SHU YERDA O'ZGARTIRISH KIRITILDI:
                    // Agar bu footage (preset-img) bo'lsa, u yuklanganda ham ko'rinmasligi kerak (opacity 0).
                    // Faqat PNG (static-thumb) ko'rinishi kerak (opacity 1).
                    if (img.classList.contains('preset-img')) {
                        img.style.opacity = '0';
                    } else {
                        img.style.opacity = '1';
                    }

                    // Placeholder ni olib tashlash (faqat static thumb uchun)
                    const placeholder = img.previousElementSibling;
                    if (
                        placeholder &&
                        placeholder.classList.contains('image-placeholder') &&
                        img.classList.contains('static-thumb')
                    ) {
                        placeholder.style.display = 'none';
                    }
                });
            };
        }

        observe(images) {
            images.forEach((img) => {
                // Birinchi 4 ta rasmni darhol yuklash
                if (images.indexOf(img) < 4) {
                    this.loadImage(img);
                } else {
                    this.observer.observe(img);
                }
            });
        }
    }

    // ==================== MAIN APPLICATION ====================
    const API_BASE = 'https://darkpanel-backend-swart.vercel.app/api';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let csInterface = null;
    try {
        csInterface = new CSInterface();
    } catch (_) {
        console.warn('CSInterface not available. Running in browser preview mode.');
    }

    let isSleeping = false;
    let lazyLoader = null;

    function goSleep() {
        if (isSleeping) return;

        const infoModal = document.getElementById('dp-info-modal');
        if (infoModal && infoModal.classList.contains('show')) return;

        isSleeping = true;
        document.body.classList.add('dp-sleep');
    }

    function wakeUp() {
        if (!isSleeping) return;
        isSleeping = false;
        document.body.classList.remove('dp-sleep');
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) goSleep();
        else wakeUp();
    });

    window.addEventListener('blur', goSleep);
    window.addEventListener('focus', wakeUp);

    if (csInterface && typeof csInterface.addEventListener === 'function') {
        try {
            csInterface.addEventListener('com.adobe.csxs.events.ApplicationActivate', () =>
                wakeUp()
            );
            csInterface.addEventListener('com.adobe.csxs.events.ApplicationDeactivate', () =>
                goSleep()
            );
        } catch (e) {
            console.warn('CEP visibility events not available:', e);
        }
    }

    async function getDeviceId() {
        try {
            if (csInterface) {
                const p = csInterface.getSystemPath(SystemPath.USER_DATA);
                if (p) return 'cep_' + String(p);
            }
        } catch (_) {}
        const ua = (navigator.userAgent || '') + (navigator.platform || '');
        const dims = (screen.width || 0) + 'x' + (screen.height || 0);
        return 'web_' + btoa(ua + '|' + dims);
    }
    const deviceId = await getDeviceId();

    async function apiPost(path, body) {
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            return { ok: res.ok, data };
        } catch (err) {
            console.error('API error:', err);
            return { ok: false, data: { error: 'network_error' } };
        }
    }

    const startTime = Date.now();
    const uptimeEl = document.getElementById('dp-uptime');

    function updateUptime() {
        if (!uptimeEl) return;
        const diff = Date.now() - startTime;
        const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
        uptimeEl.textContent = `${h}:${m}:${s}`;
    }

    setInterval(updateUptime, 1000);
    updateUptime();

    const LOCAL_KEY = 'darkpanel_license_key';
    const LICENSE_CACHE = 'darkpanel_license_cache';

    async function checkKey(key) {
        const { data } = await apiPost('/license/check', { key, deviceId });
        if (data?.valid || data?.ok) {
            localStorage.setItem(
                LICENSE_CACHE,
                JSON.stringify({
                    ts: Date.now(),
                    type: data.type || (data.valid ? 'trial' : undefined),
                    expiresAt: data.expiresAt || null,
                })
            );
        }
        return data;
    }

    const platformEl = document.getElementById('dp-platform');
    if (platformEl) {
        platformEl.textContent = navigator.platform || 'Unknown';
    }

    const panelStateEl = document.getElementById('dp-panel-state');
    if (panelStateEl) {
        panelStateEl.textContent = document.hidden ? 'Idle' : 'Active';
    }

    document.addEventListener('visibilitychange', () => {
        if (panelStateEl) {
            panelStateEl.textContent = document.hidden ? 'Idle' : 'Active';
        }
    });

    async function activateKey(key) {
        const { data } = await apiPost('/license/activate', { key, deviceId });
        return data;
    }

    async function validateStoredKey() {
        const key = localStorage.getItem(LOCAL_KEY);
        if (!key) return false;

        if (!navigator.onLine) return true;

        const data = await checkKey(key);
        return !!(data && (data.ok === true || data.valid === true));
    }

    function renderActivationUI() {
        if (!navigator.onLine) {
            showOfflineNeedsNetOverlay();
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'dp-activation';
        overlay.style.cssText = `
            position:fixed;inset:0;background:#0f0f10;display:flex;
            align-items:center;justify-content:center;z-index:999999;color:#fff;
            font-family:Inter,system-ui,Arial,sans-serif;
        `;
        overlay.innerHTML = `
            <div style="width:min(420px,90vw);padding:22px 20px;border:1px solid #2a2a2a;
                border-radius:14px;background:linear-gradient(180deg,#141416,#0f0f10)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                    <div style="width:32px;height:32px;border-radius:8px;background:#3537ff;
                        display:flex;align-items:center;justify-content:center;">🔐</div>
                    <h2 style="margin:0;font-size:18px;font-weight:700">darkPanel Activation</h2>
                </div>
                <p style="margin:6px 0 14px;color:#bdbdbd;font-size:12px">Please enter your key.</p>
                <input id="dp-key" placeholder="XXXX-XXXX-XXXX" spellcheck="false"
                    style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2b2b2b;
                    background:#131318;color:#eaeaea;outline:none;font-size:13px">
                <div style="display:flex;gap:10px;margin-top:12px">
                    <button id="dp-activate" style="flex:1;padding:10px 12px;border:0;
                        border-radius:10px;background:#4a6cff;color:#fff;font-weight:600;cursor:pointer">
                        Activate
                    </button>
                    <button id="dp-exit" style="padding:0px 0px;border:0px solid #2b2b2b;
                        border-radius:10px;background:#16161a;color:#ddd;cursor:pointer"></button>
                </div>
                <div id="dp-msg" style="margin-top:10px;color:#9ca3af;font-size:12px;min-height:16px"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        const exitBtn = document.getElementById('dp-exit');
        if (exitBtn) {
            exitBtn.onclick = () => {
                const msgEl = document.getElementById('dp-msg');
                if (msgEl) msgEl.textContent = 'Activation required to continue.';
            };
        }

        const activateBtn = document.getElementById('dp-activate');
        if (activateBtn) {
            activateBtn.onclick = async () => {
                const el = document.getElementById('dp-key');
                const msg = document.getElementById('dp-msg');
                const key = (el?.value || '').trim().toUpperCase();
                if (!msg) return;
                if (!key) {
                    msg.textContent = 'Please paste your key.';
                    return;
                }

                msg.textContent = '🔄 Checking key…';

                const result = await activateKey(key);
                console.log('Activation result:', result);

                if (!result) {
                    msg.textContent = '❌ No response from server.';
                    return;
                }

                if (!result.ok) {
                    const reason = result.error || 'Invalid key.';
                    if (reason === 'bound_to_other_device')
                        msg.textContent = '⚠️ Key already used on another device.';
                    else if (reason === 'trial_expired') msg.textContent = '⏰ Trial expired.';
                    else if (reason === 'not_found') msg.textContent = '❌ Key not found.';
                    else msg.textContent = '❌ ' + reason;
                    return;
                }

                localStorage.setItem(LOCAL_KEY, key);
                msg.textContent = '✅ Activated successfully!';
                await sleep(700);
                overlay.remove();
                startApp();
            };
        }
    }

    function showOfflineRibbon() {
        if (document.getElementById('offline-ribbon')) return;
        const bar = document.createElement('div');
        bar.id = 'offline-ribbon';
        bar.style.cssText = `
            position:fixed;left:12px;right:12px;bottom:10rem;z-index:99999;
            background:#191a1f;border:1px solid #2b2b2b;color:#bbb;
            padding:6px 10px;border-radius:8px;font:12px/1.2 Inter,system-ui;text-align:center;
        `;
        bar.textContent = '📡 Offline mode — some features need internet';
        document.body.appendChild(bar);
        window.addEventListener(
            'online',
            () => {
                bar.remove();
                location.reload();
            },
            { once: true }
        );
    }

    function showOfflineNeedsNetOverlay() {
        const el = document.createElement('div');
        el.style.cssText = `
            position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
            background:#0f0f10;color:#fff;z-index:999999;font-family:Inter,system-ui;flex-direction:column;gap:8px;
        `;
        el.innerHTML = `
            <div style="font-size:40px">📡</div>
            <div style="font-size:16px;font-weight:700">No internet</div>
            <div style="font-size:13px;color:#bdbdbd">Activation requires internet connection</div>
            <button id="retryNet" style="margin-top:10px;padding:8px 14px;border-radius:10px;border:0;background:#4a6cff;color:#fff;font-weight:600">Try again</button>
        `;
        document.body.appendChild(el);
        const go = () => {
            el.remove();
            location.reload();
        };
        const btn = document.getElementById('retryNet');
        if (btn) btn.onclick = go;
        window.addEventListener('online', go, { once: true });
    }

    const hasKey = !!localStorage.getItem(LOCAL_KEY);

    if (!navigator.onLine) {
        if (hasKey) {
            showOfflineRibbon();
            startApp();
        } else {
            showOfflineNeedsNetOverlay();
        }
        return;
    }

    const valid = await validateStoredKey();
    if (!valid) {
        renderActivationUI();
        return;
    }

    // INFO PANEL HANDLING - TO'G'RI ISHLASHI UCHUN
    const infoModal = document.getElementById('dp-info-modal');
    const closeInfoBtn = infoModal?.querySelector('.close-info');
    const btnWrapper = document.querySelector('.btn-wrapper');

    // Info panelni ochish
    function openInfoModal() {
        if (!infoModal) return;

        // Performance modeni o'chirish info panel ochilganda
        perfManager.disablePerformanceMode();

        infoModal.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Modal kontentini to'ldirish
        fillInfoModal();
    }

    // Info panelni yopish
    function closeInfoModal() {
        if (!infoModal) return;

        infoModal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Event listenerlarni qo'shish
    if (btnWrapper) {
        btnWrapper.addEventListener('click', openInfoModal);
    }

    if (closeInfoBtn) {
        closeInfoBtn.addEventListener('click', closeInfoModal);
    }

    // Modal tashqarisini bosganda yopish
    infoModal?.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            closeInfoModal();
        }
    });

    // Escape tugmasi bilan yopish
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && infoModal?.classList.contains('show')) {
            closeInfoModal();
        }
    });

    async function fillInfoModal() {
        const key = localStorage.getItem(LOCAL_KEY);

        const statusBadge = document.getElementById('modal-status');
        const licenseBadge = document.getElementById('modal-license-status');
        const trialBadge = document.getElementById('modal-trial-days');
        const versionBadge = document.getElementById('modal-version');

        if (!statusBadge || !licenseBadge || !trialBadge || !versionBadge) return;

        licenseBadge.textContent = 'Loading…';
        licenseBadge.className = 'value-badge';
        trialBadge.textContent = '…';
        statusBadge.className = 'value-badge';

        if (navigator.onLine) {
            statusBadge.textContent = 'Online';
            statusBadge.classList.add('online');
        } else {
            statusBadge.textContent = 'Offline';
            statusBadge.classList.add('offline');
        }

        checkKey(key).then((data) => {
            if (!data || !data.ok) {
                licenseBadge.textContent = 'Not Activated';
                licenseBadge.style.color = '#ff0000ff';
                trialBadge.textContent = '–';
                return;
            }

            if (data.type === 'lifetime') {
                licenseBadge.textContent = 'Lifetime';
                licenseBadge.style.color = '#00ff00ff';
                trialBadge.textContent = 'Unlimited';
            }

            if (data.type === 'trial') {
                licenseBadge.textContent = 'Trial';
                licenseBadge.style.color = '#ff8800ff';
                trialBadge.textContent = data.remainingDays ?? '0';
            }
        });

        const version =
            localStorage.getItem('darkpanel_last_applied_version') ||
            localStorage.getItem('darkpanel_installed_version') ||
            '1.0';

        versionBadge.textContent = 'v' + version;
        document.getElementById('modal-env').textContent = csInterface
            ? 'After Effects (CEP)'
            : 'Browser';

        document.getElementById('modal-device').textContent = deviceId.slice(0, 10) + '…';

        document.getElementById('modal-net').textContent = navigator.onLine ? 'Stable' : 'Offline';
    }

    window.addEventListener('online', () => {
        const s = document.getElementById('modal-status');
        if (s) {
            s.textContent = 'Online';
            s.style.color = '#00ff00ff';
        }
    });

    window.addEventListener('offline', () => {
        const s = document.getElementById('modal-status');
        if (s) {
            s.textContent = 'Offline';
            s.style.color = '#ff6f6f';
        }
    });

    let activePreviewImg = null;
    let selectedPresetEl = null;
    // 1. Play funksiyasini yangilaymiz
    function playPreview(img) {
        if (!img) return;

        // Agar hozir boshqa rasm o'ynayotgan bo'lsa...
        if (activePreviewImg && activePreviewImg !== img) {
            // Va u rasm TANLANGAN (Selected) kartochkaga tegishli bo'lmasa...
            const activeCard = activePreviewImg.closest('.preset');
            if (activeCard !== selectedPresetEl) {
                // Uni to'xtatamiz
                stopPreview(activePreviewImg);
            }
        }

        // Yangi rasmni o'ynatamiz
        img.src = img.dataset.src;
        img.style.opacity = '1';

        // Uning orqasidagi PNG ni yashiramiz
        const parent = img.closest('.preset-thumb');
        if (parent) {
            const png = parent.querySelector('.static-thumb');
            if (png) png.style.opacity = '0';
        }

        activePreviewImg = img;
    }

    // 2. Stop funksiyasini yangilaymiz
    function stopPreview(img) {
        if (!img) return;

        img.removeAttribute('src');
        img.style.opacity = '0';

        // Orqasidagi PNG ni qaytaramiz
        const parent = img.closest('.preset-thumb');
        if (parent) {
            const png = parent.querySelector('.static-thumb');
            if (png) png.style.opacity = '1';
        }
    }

    // 3. Stop All funksiyasini yangilaymiz
    function stopAllPreviews() {
        document.querySelectorAll('.preset-img').forEach((img) => {
            // Agar bu rasm TANLANGAN kartochkaniki bo'lsa, to'xtatmaymiz!
            const card = img.closest('.preset');
            if (card === selectedPresetEl) return;

            stopPreview(img);
        });
        // Agar tanlangan rasm bo'lmasa, active ni null qilamiz
        if (!selectedPresetEl) {
            activePreviewImg = null;
        }
    }

    let presets = [];
    startApp();

    async function startApp() {
        const GITHUB_RAW = 'https://raw.githubusercontent.com/Cyber05CC/darkpanel/main';
        const UPDATE_URL = API_BASE.replace('/api', '') + '/data/update.json';

        const LS_INSTALLED = 'darkpanel_installed_version';
        const LS_LAST_APPLIED = 'darkpanel_last_applied_version';

        const storedVersion =
            localStorage.getItem(LS_LAST_APPLIED) || localStorage.getItem(LS_INSTALLED);
        const BUNDLE_VERSION = storedVersion || '1.0.0';
        let currentVersion = BUNDLE_VERSION;

        const SUPPORTED_TEXT_FILES = [
            'index.html',
            'css/style.css',
            'js/main.js',
            'CSXS/manifest.xml',
        ];

        let selectedPreset = null;
        const presetList = document.getElementById('presetList');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
        const allTab = document.getElementById('allTab');
        const favoritesTab = document.getElementById('favoritesTab');
        const refreshBtn = document.getElementById('refresh');
        const applyBtn = document.getElementById('apply');
        const status = document.getElementById('status');
        const textPackBtn = document.getElementById('textPackBtn');
        const effectPackBtn = document.getElementById('effectPackBtn');

        const itemsPerPage = 16;
        let currentPage = 1;
        let totalPages = 1;
        let currentView = 'all';
        let currentPack = localStorage.getItem('currentPack') || 'text';
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

        setupConnectionWatcher();
        await autoUpdateIfNeeded();

        // Initialize lazy loader
        lazyLoader = new ImprovedLazyLoader();

        init();
        setupPackDropdown();
        setupTabsUnderline();

        const presetsContainer = document.getElementById('presetList');

        if (presetsContainer) {
            presetsContainer.addEventListener('mousedown', (e) => {
                if (e.target === presetsContainer) {
                    clearPresetSelection();
                }
            });
        }

        function setupConnectionWatcher() {
            function showConnectionAlert(message, type = 'error') {
                const existing = document.querySelector('.net-alert');
                if (existing) existing.remove();

                const alert = document.createElement('div');
                alert.className = `net-alert ${type}`;
                alert.innerHTML = `<span>${type === 'error' ? '📡' : '🌐'} ${message}</span>`;
                document.body.appendChild(alert);

                requestAnimationFrame(() => alert.classList.add('visible'));

                setTimeout(
                    () => {
                        alert.classList.remove('visible');
                        setTimeout(() => alert.remove(), 400);
                    },
                    type === 'error' ? 3500 : 1800
                );
            }

            window.addEventListener('offline', () => {
                showConnectionAlert('Offline.', 'error');
            });

            window.addEventListener('online', () => {
                showConnectionAlert('Online', 'success');
                setTimeout(() => location.reload(true), 1000);
            });

            if (!navigator.onLine) showConnectionAlert('Offline.', 'error');
        }

        function isNewerVersion(remote, local) {
            const r = remote.split('.').map(Number);
            const l = local.split('.').map(Number);

            for (let i = 0; i < 3; i++) {
                if ((r[i] || 0) > (l[i] || 0)) return true;
                if ((r[i] || 0) < (l[i] || 0)) return false;
            }
            return false;
        }

        async function autoUpdateIfNeeded() {
            if (!navigator.onLine || isSleeping) {
                console.log('🔄 Offline or sleeping – update skip');
                return;
            }

            try {
                const res = await fetch(UPDATE_URL + '?v=' + Date.now(), {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error('update.json not found');

                const remote = await res.json();
                if (!remote?.version || !remote.files) return;

                const installed =
                    localStorage.getItem(LS_LAST_APPLIED) ||
                    localStorage.getItem(LS_INSTALLED) ||
                    BUNDLE_VERSION;

                if (!isNewerVersion(remote.version, installed)) {
                    console.log('✅ darkPanel already latest:', installed);
                    currentVersion = installed;
                    return;
                }

                console.log('⬆ darkPanel auto-update', installed, '→', remote.version);

                localStorage.setItem('darkpanel_cache_bust', String(Date.now()));

                let wrote = false;

                if (csInterface) {
                    wrote = await tryWriteToExtension(remote.files);
                }

                if (wrote) {
                    localStorage.setItem(LS_INSTALLED, remote.version);
                    localStorage.setItem(LS_LAST_APPLIED, remote.version);
                    currentVersion = remote.version;
                    hardReloadExtension();
                    return;
                }

                console.warn('❗ tryWriteToExtension failed or csInterface yok – overlay fallback');

                localStorage.setItem(LS_LAST_APPLIED, remote.version);
                currentVersion = remote.version;
                hardReloadUI(remote.version);
            } catch (e) {
                console.warn('❌ autoUpdateIfNeeded error:', e);
            }
        }

        async function tryWriteToExtension(files) {
            if (!csInterface) return false;
            const extRoot = csInterface.getSystemPath(SystemPath.EXTENSION);

            const ensureFoldersScript = (fullPath) => `
                (function() {
                    function ensureFolder(path) {
                        var parts = path.split(/[\\\\\\/]/);
                        var acc = parts.shift();
                        while (parts.length) {
                            acc += "/" + parts.shift();
                            var f = new Folder(acc);
                            if (!f.exists) { try { f.create(); } catch(e) { return "ERR:" + e; } }
                        }
                        return "OK";
                    }
                    return ensureFolder("${fullPath.replace(/"/g, '\\"')}");
                })();
            `;

            for (const [rel, info] of Object.entries(files || {})) {
                if (!SUPPORTED_TEXT_FILES.includes(rel)) continue;
                const url = info.url + '?v=' + Date.now();
                const text = await (await fetch(url, { cache: 'no-store' })).text();

                const dir = rel.split('/').slice(0, -1).join('/');
                if (dir) {
                    const targetDir = extRoot + '/' + dir;
                    const ok = await new Promise((resolve) => {
                        csInterface.evalScript(ensureFoldersScript(targetDir), (res) =>
                            resolve(res === 'OK')
                        );
                    });
                    if (!ok) return false;
                }

                const targetFile = `${extRoot}/${rel}`;
                const wrote = await writeFileInChunks(targetFile, text);
                if (!wrote) return false;
            }
            return true;
        }

        async function writeFileInChunks(targetFile, text) {
            if (!csInterface) return false;
            const chunkSize = 30000;
            const chunks = [];
            for (let i = 0; i < text.length; i += chunkSize) {
                chunks.push(text.substring(i, i + chunkSize));
            }

            let mode = 'w';
            for (const chunk of chunks) {
                const writeChunkScript = `
                    (function() {
                        try {
                            var f = new File("${targetFile.replace(/"/g, '\\"')}");
                            f.encoding = "UTF-8";
                            f.open("${mode}");
                            f.write(${JSON.stringify(chunk)});
                            f.close();
                            return "OK";
                        } catch(e) { return "ERR:" + e; }
                    })();
                `;
                const result = await new Promise((resolve) => {
                    csInterface.evalScript(writeChunkScript, (res) => resolve(res === 'OK'));
                });
                if (!result) return false;
                mode = 'a';
            }
            return true;
        }

        function hardReloadExtension() {
            sessionStorage.clear();
            const keep = {
                favorites: localStorage.getItem('favorites'),
                currentPack: localStorage.getItem('currentPack'),
                gridCols: localStorage.getItem('gridCols'),
                installed: localStorage.getItem(LS_INSTALLED),
                lastApplied: localStorage.getItem(LS_LAST_APPLIED),
                license: localStorage.getItem(LOCAL_KEY),
            };
            localStorage.clear();
            if (keep.favorites) localStorage.setItem('favorites', keep.favorites);
            if (keep.currentPack) localStorage.setItem('currentPack', keep.currentPack);
            if (keep.gridCols) localStorage.setItem('gridCols', keep.gridCols);
            if (keep.installed) localStorage.setItem(LS_INSTALLED, keep.installed);
            if (keep.lastApplied) localStorage.setItem(LS_LAST_APPLIED, keep.lastApplied);
            if (keep.license) localStorage.setItem(LOCAL_KEY, keep.license);

            if (csInterface) {
                csInterface.evalScript(
                    `
                    (function(){
                        try {
                            var extPath = new File($.fileName).parent.fsName;
                            var indexFile = new File(extPath + "/index.html");
                            if(indexFile.exists){
                                app.scheduleTask('$.evalFile(\\'' + indexFile.fsName + '\\')', 0, false);
                            }
                            return "Panel restarted";
                        } catch(e){ return "Error: " + e; }
                    })();
                `,
                    (res) => console.log('🔁 Reload:', res)
                );
            }
            setTimeout(() => location.reload(true), 800);
        }

        function hardReloadUI(version) {
            setTimeout(() => location.reload(true), 300);
        }

        function init() {
            updatePackUI();
            createPresets();
            setupEventListeners();
            setupGridControl();
            if (status) status.textContent = 'No items selected';
        }

        function updatePackUI() {
            const packBtn = document.querySelector('.pack-btn');
            if (!packBtn) return;

            const labelSpan = packBtn.querySelector('.pack-label');
            if (!labelSpan) return;

            if (currentPack === 'text') {
                labelSpan.textContent = 'Text Pack';
                textPackBtn?.classList.add('active');
                effectPackBtn?.classList.remove('active');
            } else {
                labelSpan.textContent = 'Effect Pack';
                effectPackBtn?.classList.add('active');
                textPackBtn?.classList.remove('active');
            }
        }

        async function createPresets() {
            if (!presetList) return;

            presetList.innerHTML =
                '<div class="loading-placeholder" style="text-align:center;padding:2rem;color:#aaa">Loading presets...</div>';

            let presetIndexes = [];

            try {
                const res = await fetch(`${GITHUB_RAW}/assets/videos/list.json?v=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    presetIndexes = Array.isArray(data[currentPack])
                        ? data[currentPack].slice().sort((a, b) => {
                              const na = typeof a === 'object' ? a.n : a;
                              const nb = typeof b === 'object' ? b.n : b;
                              return na - nb;
                          })
                        : [];
                }
            } catch (e) {
                console.warn('list.json load failed:', e);
            }

            presetList.innerHTML = '';

            const packType = currentPack === 'text' ? 'Text' : 'Effect';
            let uiCounter = 1;
            const lazyImages = [];

            presetIndexes.forEach((entry) => {
                const preset = document.createElement('div');
                preset.className = 'preset';

                // entry raqam yoki obyekt bo'lishi mumkin:
                // Raqam: 3           → default extension (.aep effect uchun, .ffx text uchun)
                // Obyekt: {n:3, ext:".ffx"} → maxsus extension
                let realNum, extension;
                if (typeof entry === 'object' && entry !== null) {
                    realNum = entry.n;
                    extension = entry.ext || (currentPack === 'effect' ? '.aep' : '.ffx');
                } else {
                    realNum = entry;
                    extension = currentPack === 'effect' ? '.aep' : '.ffx';
                }
                const fileName = `${currentPack}_${realNum}${extension}`;

                preset.dataset.file = fileName;

                const footageSrc = `${GITHUB_RAW}/assets/videos/${currentPack}_${realNum}.webp`;
                const thumbSrc = `${GITHUB_RAW}/assets/thumbnails/${currentPack}_${realNum}.png`;

                preset.innerHTML = `
                    <div class="preset-thumb">
                        <div class="image-placeholder"></div>
                        <img class="static-thumb lazy" data-src="${thumbSrc}" alt="thumb" draggable="false" />
                        <img class="preset-img" data-src="${footageSrc}" alt="" draggable="false" />
                        <input type="checkbox" class="favorite-check" data-file="${fileName}">
                    </div>
                    <div class="preset-name">${packType} ${uiCounter}</div>
                `;

                presetList.appendChild(preset);

                const staticImg = preset.querySelector('.static-thumb');
                const footageImg = preset.querySelector('.preset-img');

                if (staticImg) lazyImages.push(staticImg);
                if (footageImg) lazyImages.push(footageImg);

                uiCounter++;
            });

            setTimeout(() => {
                if (lazyLoader) {
                    lazyLoader.observe(lazyImages);
                }
            }, 100);

            presets = document.querySelectorAll('.preset');
            initializeFavorites();
            showPage(1);

            setTimeout(() => {
                stopAllPreviews();
                initPresetPreviews();
                showPage(1);
            }, 0);
        }
        function initPresetPreviews() {
            const presets = document.querySelectorAll('.preset');

            presets.forEach((preset) => {
                const webpImg = preset.querySelector('.preset-img');
                if (!webpImg) return;

                /* --- HOVER KIRISH --- */
                preset.addEventListener('mouseenter', () => {
                    // Agar bu kartochka allaqachon tanlangan bo'lsa, tegmaymiz (u o'ynab turibdi)
                    if (preset === selectedPresetEl) return;
                    playPreview(webpImg);
                });

                /* --- HOVER CHIQISH --- */
                preset.addEventListener('mouseleave', () => {
                    // Agar bu tanlangan kartochka bo'lsa, to'xtatmaymiz!
                    if (preset === selectedPresetEl) return;
                    stopPreview(webpImg);
                });

                /* --- CLICK (SELECT) --- */
                preset.addEventListener('click', (e) => {
                    if (e.target.classList.contains('favorite-check')) return;

                    // A) Eski tanlangan kartochkani to'xtatamiz (Endi u oddiy bo'lib qoladi)
                    if (selectedPresetEl && selectedPresetEl !== preset) {
                        selectedPresetEl.classList.remove('selected');
                        const oldWebp = selectedPresetEl.querySelector('.preset-img');
                        stopPreview(oldWebp); // PNG qaytadi, WebP to'xtaydi
                    }

                    // B) Agar o'zini qayta bossak (Deselect)
                    if (selectedPresetEl === preset) {
                        preset.classList.remove('selected');
                        stopPreview(webpImg); // PNG qaytadi
                        selectedPresetEl = null;
                        selectedPreset = null;
                        if (status) status.textContent = 'No items selected';
                        return;
                    }

                    // C) Yangi kartochkani tanlash
                    preset.classList.add('selected');
                    selectedPresetEl = preset;
                    selectedPreset = preset.dataset.file;

                    // WebP ni yoqamiz (PNG avtomatik yashirinadi playPreview ichida)
                    playPreview(webpImg);

                    if (status) {
                        status.textContent = `Selected: ${preset.querySelector('.preset-name').textContent}`;
                    }
                });
            });
        }
        function setupPresetHoverEffects() {
            presets.forEach((preset) => {
                preset.addEventListener('mouseenter', () => {
                    if (isSleeping) return;

                    const img = preset.querySelector('.preset-img');
                    if (img && !img.classList.contains('lazy')) {
                        img.style.transform = 'scale(1.05)';
                        img.style.transition = 'transform 0.2s ease';
                    }
                });

                preset.addEventListener('mouseleave', () => {
                    const img = preset.querySelector('.preset-img');
                    if (img) {
                        img.style.transform = 'scale(1)';
                    }
                });
            });
        }

        function initializeFavorites() {
            presets.forEach((preset) => {
                const file = preset.dataset.file;
                const checkbox = preset.querySelector('.favorite-check');
                if (!checkbox) return;
                checkbox.checked = favorites.includes(file);
                checkbox.addEventListener('change', function () {
                    toggleFavorite(file, this.checked);
                });
            });
        }

        function toggleFavorite(file, isFavorite) {
            if (isFavorite && !favorites.includes(file)) favorites.push(file);
            else if (!isFavorite) favorites = favorites.filter((f) => f !== file);
            localStorage.setItem('favorites', JSON.stringify(favorites));
            if (currentView === 'favorites') showPage(1);
        }

        function filterPresets() {
            return Array.from(presets).filter(
                (preset) => currentView === 'all' || favorites.includes(preset.dataset.file)
            );
        }

        function showPage(page) {
            if (isSleeping) return;

            const filtered = filterPresets();
            currentPage = page;
            totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

            // Hide all presets first
            presets.forEach((p) => {
                p.style.display = 'none';
            });

            // Show only current page
            const presetsToShow = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
            presetsToShow.forEach((p) => {
                p.style.display = 'block';
            });

            if (pageInfo) pageInfo.textContent = `Page : ${currentPage}`;
            if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
            if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        }

        function setupPresetSelection() {
            const presetsContainer = document.getElementById('presetList');

            if (presetsContainer) {
                presetsContainer.addEventListener('mousedown', (e) => {
                    if (e.target === presetsContainer) {
                        clearPresetSelection();
                    }
                });
            }

            presets.forEach((preset) => {
                preset.addEventListener('click', (e) => {
                    if (e.target.classList.contains('favorite-check')) return;

                    presets.forEach((p) => p.classList.remove('selected'));
                    preset.classList.add('selected');
                    selectedPreset = preset.dataset.file;

                    if (status) {
                        status.textContent = `Selected: ${
                            preset.querySelector('.preset-name').textContent
                        }`;
                    }
                });
            });
        }

        function clearPresetSelection() {
            presets.forEach((p) => p.classList.remove('selected'));
            selectedPreset = null;
            if (status) status.textContent = 'No items selected';
        }

        function setupGridControl() {
            const gridButtons = document.querySelectorAll('.grid-btn');
            const presetsContainer = document.querySelector('.presets');

            if (!presetsContainer || gridButtons.length === 0) return;

            let userSelectedCols = parseInt(localStorage.getItem('gridCols') || '2', 10);

            function applyGrid(cols, fromUser = false) {
                presetsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

                if (fromUser) {
                    userSelectedCols = cols;
                    localStorage.setItem('gridCols', String(cols));
                }

                gridButtons.forEach((btn) =>
                    btn.classList.toggle('active', parseInt(btn.dataset.cols) === cols)
                );
            }

            gridButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const cols = parseInt(btn.dataset.cols, 10);
                    applyGrid(cols, true);
                });
            });

            function autoDetectGrid() {
                const width = window.innerWidth;

                if (width <= 420) {
                    applyGrid(1);
                } else if (width <= 640) {
                    applyGrid(2);
                } else if (width <= 720) {
                    applyGrid(3);
                } else {
                    applyGrid(userSelectedCols);
                }
            }

            autoDetectGrid();

            // Debounced resize handler
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(autoDetectGrid, 250);
            });
        }

        async function applyPreset() {
            // 1. Validatsiya
            if (!selectedPreset) {
                const toast = document.createElement('div');
                toast.className = 'apply-toast';
                toast.textContent = 'Select a preset first!';
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.classList.add('hide');
                    setTimeout(() => toast.remove(), 500);
                }, 1500);
                return;
            }

            const isAEP = selectedPreset.toLowerCase().endsWith('.aep');
            const extension = isAEP ? '.aep' : '.ffx';
            const remotePresetUrl = `${GITHUB_RAW}/presets/${selectedPreset}`;

            console.log(`Applying ${extension.toUpperCase()}:`, selectedPreset);

            try {
                // 2. Yuklab olish
                const res = await fetch(remotePresetUrl, { cache: 'no-store' });
                if (!res.ok) throw new Error('Preset not found');
                const blob = await res.blob();
                const base64 = await blobToBase64(blob);

                // 3. Fayl yozish (Chunking)
                const chunkSize = 20000;
                const chunks = [];
                for (let i = 0; i < base64.length; i += chunkSize) {
                    chunks.push(base64.slice(i, i + chunkSize));
                }

                const pathScript = `(function(){ try { var p = Folder.temp.fsName + "/dp_temp${extension}"; var f=new File(p); f.encoding="BINARY"; f.open("w"); f.close(); return p; } catch(e){return "ERR";} })()`;

                if (!csInterface) return;

                csInterface.evalScript(pathScript, async (tempPath) => {
                    if (tempPath === 'ERR') return;
                    const escapedPath = tempPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const writeScript = `(function(){ 
                            var f=new File("${escapedPath}"); f.encoding="BINARY"; f.open("a"); 
                            function b64d(s) { var k="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", o="", b=0, x=0, c; for(var i=0;i<s.length;i++){ c=s.charAt(i); if(c=='=')break; var v=k.indexOf(c); if(v<0)continue; b=(b<<6)|v; x+=6; if(x>=8){x-=8; o+=String.fromCharCode((b>>x)&0xFF);} } return o; }
                            f.write(b64d("${chunk}")); f.close(); 
                        })()`;
                        await new Promise((r) => csInterface.evalScript(writeScript, r));
                    }

                    // --- APPLY SCRIPT ---
                    let applyScript;

                    if (isAEP) {
                        // =====================================================
                        // .AEP APPLY v10 — 3 TA ALOHIDA evalScript + JSON
                        //
                        // AE FUNDAMENTAL CHEGARASI:
                        // importFile() va remove() HECH QACHON undo group ni
                        // hurmat qilmaydi. DOIM alohida undo entry yaratadi.
                        //
                        // v10 YECHIMI:
                        // 1) evalScript 1: import → serialize → JSON.stringify
                        //    → $.global.__dpJSON = "string" → remove
                        //
                        // 2) evalScript 2: Undo × (1 + removeCount)
                        //    Undo tarixidan import/remove TOZALANADI
                        //    $.global dagi STRING saqlanib qoladi
                        //
                        // 3) evalScript 3: JSON.parse → beginUndoGroup
                        //    → addProperty + setValue → endUndoGroup
                        //    FAQAT SHU qoladi undo tarixida
                        //
                        // NATIJA:
                        // CTRL+Z 1: "Apply Smart Preset" qaytadi
                        // CTRL+Z 2: precomp qaytadi
                        // =====================================================

                        const evalP = (script) =>
                            new Promise((resolve) => {
                                csInterface.evalScript(script, (res) => resolve(res));
                            });

                        try {
                            // ========== STEP 1: IMPORT + SERIALIZE + REMOVE ==========
                            const step1 = `(function(){
                                try {
                                    var f = new File("${escapedPath}");
                                    if(!f.exists) return "ERR:File missing";
                                    
                                    var comp = app.project.activeItem;
                                    if (!comp || !(comp instanceof CompItem)) return "ERR:No Comp";
                                    var sl = comp.selectedLayers;
                                    if (sl.length === 0) return "ERR:No Layer";
                                    
                                    var idxs = [];
                                    for (var i = 0; i < sl.length; i++) idxs.push(sl[i].index);

                                    var oldIds = {};
                                    for (var i = 1; i <= app.project.numItems; i++) {
                                        oldIds[app.project.item(i).id] = true;
                                    }
                                    
                                    var io = new ImportOptions(f);
                                    var imported = app.project.importFile(io);

                                    var newItems = [];
                                    for (var i = 1; i <= app.project.numItems; i++) {
                                        var it = app.project.item(i);
                                        if (!oldIds[it.id]) newItems.push(it);
                                    }

                                    var srcComp = null;
                                    if (imported instanceof CompItem) {
                                        srcComp = imported;
                                    } else if (imported instanceof FolderItem) {
                                        for (var i = 1; i <= imported.numItems; i++) {
                                            if (imported.item(i) instanceof CompItem) { srcComp = imported.item(i); break; }
                                        }
                                    }
                                    if (!srcComp) {
                                        for (var i = 0; i < newItems.length; i++) {
                                            if (newItems[i] instanceof CompItem) { srcComp = newItems[i]; break; }
                                        }
                                    }
                                    if (!srcComp || srcComp.numLayers === 0) {
                                        for (var r = newItems.length-1; r >= 0; r--) { try{newItems[r].remove();}catch(e){} }
                                        return "ERR:Bad AEP";
                                    }

                                    var srcLayer = srcComp.layer(1);
                                    var srcW = srcLayer.width;
                                    var srcH = srcLayer.height;
                                    var srcEffects = srcLayer.property("ADBE Effect Parade");
                                    if (!srcEffects || srcEffects.numProperties === 0) {
                                        for (var r = newItems.length-1; r >= 0; r--) { try{newItems[r].remove();}catch(e){} }
                                        return "ERR:No effects";
                                    }

                                    function ser(p) {
                                        var o = {n:p.name,m:p.matchName,t:p.propertyType,vt:0,v:null,k:[],x:"",xo:false,c:[]};
                                        try {
                                            if (p.propertyType === PropertyType.PROPERTY) {
                                                o.vt = p.propertyValueType;
                                                if (o.vt===PropertyValueType.NO_VALUE||o.vt===PropertyValueType.CUSTOM_VALUE) return o;
                                                try{if(p.expressionEnabled&&p.expression){o.x=p.expression;o.xo=true;}}catch(e){}
                                                if (p.isTimeVarying && p.numKeys > 0) {
                                                    for (var i=1;i<=p.numKeys;i++) {
                                                        var kd={t:p.keyTime(i),v:p.keyValue(i),ii:-1,oi:-1,ie:null,oe:null,is:null,os:null};
                                                        try{kd.ii=p.keyInInterpolationType(i);}catch(e){}
                                                        try{kd.oi=p.keyOutInterpolationType(i);}catch(e){}
                                                        try{
                                                            var a=p.keyInTemporalEase(i),b=p.keyOutTemporalEase(i);
                                                            kd.ie=[];kd.oe=[];
                                                            for(var j=0;j<a.length;j++){kd.ie.push([a[j].speed,a[j].influence]);kd.oe.push([b[j].speed,b[j].influence]);}
                                                        }catch(e){}
                                                        try{
                                                            if(o.vt===PropertyValueType.TwoD_SPATIAL||o.vt===PropertyValueType.ThreeD_SPATIAL){
                                                                kd.is=p.keyInSpatialTangent(i);kd.os=p.keyOutSpatialTangent(i);
                                                            }
                                                        }catch(e){}
                                                        o.k.push(kd);
                                                    }
                                                } else { try{o.v=p.value;}catch(e){} }
                                            } else if(p.propertyType===PropertyType.NAMED_GROUP||p.propertyType===PropertyType.INDEXED_GROUP){
                                                for(var i=1;i<=p.numProperties;i++){try{o.c.push(ser(p.property(i)));}catch(e){}}
                                            }
                                        } catch(e){}
                                        return o;
                                    }

                                    var effs = [];
                                    for (var i=1;i<=srcEffects.numProperties;i++) {
                                        try{var e=srcEffects.property(i);effs.push({m:e.matchName,d:ser(e)});}catch(e){}
                                    }
                                    if (effs.length === 0) {
                                        for (var r=newItems.length-1;r>=0;r--){try{newItems[r].remove();}catch(e){}}
                                        return "ERR:Serialize failed";
                                    }

                                    $.global.__dpJSON = JSON.stringify({effs:effs,srcW:srcW,srcH:srcH,idxs:idxs});

                                    var rmCount = 0;
                                    for (var r=newItems.length-1;r>=0;r--) {
                                        try{newItems[r].remove();rmCount++;}catch(e){}
                                    }

                                    return "OK:" + rmCount;
                                } catch(e) { return "ERR:" + e.toString(); }
                            })()`;

                            const r1 = await evalP(step1);
                            console.log('[dp step1]', r1);
                            if (r1.indexOf('ERR') === 0) throw new Error(r1.replace('ERR:', ''));

                            var rmCount = parseInt(r1.split(':')[1]) || 0;
                            var undoCount = 1 + rmCount;

                            // ========== STEP 2: UNDO × N ==========
                            var undoCmds = '';
                            for (var u = 0; u < undoCount; u++) {
                                undoCmds += 'app.executeCommand(app.findMenuCommandId("Undo"));';
                            }
                            const step2 =
                                '(function(){try{' +
                                undoCmds +
                                'var c=app.project.activeItem;' +
                                'if(c&&c instanceof CompItem){' +
                                'var d=JSON.parse($.global.__dpJSON);' +
                                'for(var i=1;i<=c.numLayers;i++)c.layer(i).selected=false;' +
                                'for(var i=0;i<d.idxs.length;i++){try{c.layer(d.idxs[i]).selected=true;}catch(e){}}' +
                                '}return "OK";}catch(e){return "ERR:"+e.toString();}})()';

                            const r2 = await evalP(step2);
                            console.log('[dp step2] undoCount=' + undoCount, r2);

                            // ========== STEP 3: APPLY (TOZA UNDO GROUP) ==========
                            const step3 = `(function(){
                                var undoStarted = false;
                                try {
                                    var raw = $.global.__dpJSON;
                                    if (!raw) return "Error: No data";
                                    var d = JSON.parse(raw);
                                    var effs = d.effs;
                                    var srcW = d.srcW;
                                    var srcH = d.srcH;
                                    if (!effs || effs.length === 0) return "Error: Empty";

                                    var comp = app.project.activeItem;
                                    if (!comp || !(comp instanceof CompItem)) return "Error: No Comp";
                                    var layers = comp.selectedLayers;
                                    if (layers.length === 0) return "Error: No Layer";

                                    app.beginUndoGroup("Apply Smart Preset");
                                    undoStarted = true;

                                    function applyD(s,t) {
                                        try {
                                            if(s.t===PropertyType.PROPERTY){
                                                if(s.vt===PropertyValueType.NO_VALUE||s.vt===PropertyValueType.CUSTOM_VALUE) return;
                                                if(s.k&&s.k.length>0){
                                                    for(var i=0;i<s.k.length;i++){try{t.setValueAtTime(s.k[i].t,s.k[i].v);}catch(e){}}
                                                    for(var i=0;i<s.k.length;i++){
                                                        var ki=i+1,kd=s.k[i];
                                                        try{if(kd.ii>=0)t.setInterpolationTypeAtKey(ki,kd.ii,kd.oi);}catch(e){}
                                                        try{
                                                            if(kd.ie){
                                                                var ni=[],no=[];
                                                                for(var j=0;j<kd.ie.length;j++){
                                                                    ni.push(new KeyframeEase(kd.ie[j][0],kd.ie[j][1]));
                                                                    no.push(new KeyframeEase(kd.oe[j][0],kd.oe[j][1]));
                                                                }
                                                                t.setTemporalEaseAtKey(ki,ni,no);
                                                            }
                                                        }catch(e){}
                                                        try{if(kd.is)t.setSpatialTangentsAtKey(ki,kd.is,kd.os);}catch(e){}
                                                    }
                                                } else if(s.v!==null&&s.v!==undefined){
                                                    try{t.setValue(s.v);}catch(e){}
                                                }
                                                try{if(s.xo&&s.x)t.expression=s.x;}catch(e){}
                                            } else if(s.c&&s.c.length>0){
                                                for(var i=0;i<s.c.length;i++){
                                                    try{
                                                        var cd=s.c[i],tc=null;
                                                        try{tc=t.property(cd.n);}catch(e){}
                                                        if(!tc){try{tc=t.property(i+1);}catch(e){}}
                                                        if(tc) applyD(cd,tc);
                                                    }catch(e){}
                                                }
                                            }
                                        }catch(e){}
                                    }

                                    function isPos(n){return /Center|Position|Point|Anchor|Start|End|From|To/.test(n);}
                                    function isSz(n){return /Width|Size|Thickness|Radius|Softness|Border|Intensity/.test(n);}

                                    var cnt=0;
                                    for(var L=0;L<layers.length;L++){
                                        var ly=layers[L];
                                        var te=ly.property("ADBE Effect Parade");
                                        var rect=ly.sourceRectAtTime(comp.time,false);
                                        var vW=(rect.width<1)?ly.width:rect.width;
                                        var vH=(rect.height<1)?ly.height:rect.height;
                                        var sR=((vW/srcW)+(vH/srcH))/2;

                                        for(var e=0;e<effs.length;e++){
                                            var ne=null;
                                            try{ne=te.addProperty(effs[e].m);}catch(ex){continue;}
                                            if(!ne)continue;
                                            cnt++;
                                            applyD(effs[e].d,ne);

                                            for(var P=1;P<=ne.numProperties;P++){
                                                try{
                                                    var p=ne.property(P);
                                                    if(!p)continue;
                                                    if(p.propertyValueType===PropertyValueType.OneD&&isSz(p.name)){
                                                        if(p.value>0)try{p.setValue(p.value*sR);}catch(ex){}
                                                    }
                                                    else if(p.propertyValueType===PropertyValueType.TwoD_SPATIAL&&isPos(p.name)){
                                                        try{
                                                            var ov=p.value,nx=ov[0]/srcW,ny=ov[1]/srcH;
                                                            p.expression="var r=thisLayer.sourceRectAtTime(time,false);[r.left+r.width*"+nx+",r.top+r.height*"+ny+"]";
                                                            var bv=p.valueAtTime(comp.time,false);
                                                            p.expression="";p.setValue(bv);
                                                        }catch(ex){}
                                                    }
                                                }catch(ex){}
                                            }
                                        }
                                    }

                                    app.endUndoGroup();
                                    undoStarted=false;
                                    $.global.__dpJSON=null;

                                    if(cnt===0) return "Error: No effects added";
                                    return "Success:"+cnt;
                                } catch(err) {
                                    if(undoStarted){try{app.endUndoGroup();}catch(x){}}
                                    return "Error: "+err.toString();
                                }
                            })()`;

                            const r3 = await evalP(step3);
                            console.log('[dp step3]', r3);

                            if (r3.indexOf('Success') !== -1) {
                                const lastAction = document.getElementById('dp-last-action');
                                const lastTime = document.getElementById('dp-last-time');
                                if (lastAction) lastAction.textContent = 'Effect Fitted';
                                if (lastTime) {
                                    const now = new Date();
                                    lastTime.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                }
                                const toast = document.createElement('div');
                                toast.className = 'apply-toast';
                                toast.textContent = 'EFFECTS ADDED';
                                document.body.appendChild(toast);
                                setTimeout(() => {
                                    toast.classList.add('hide');
                                    setTimeout(() => toast.remove(), 500);
                                }, 1500);
                            } else {
                                throw new Error(r3);
                            }
                        } catch (stepErr) {
                            console.error('[dp error]', stepErr);
                            const toast = document.createElement('div');
                            toast.className = 'apply-toast';
                            toast.style.borderColor = 'red';
                            toast.textContent =
                                String(stepErr.message || stepErr).replace('Error: ', '') ||
                                'ERROR';
                            document.body.appendChild(toast);
                            setTimeout(() => {
                                toast.classList.add('hide');
                                setTimeout(() => toast.remove(), 500);
                            }, 2000);
                        }
                        return; // AEP shu yerda tugaydi, FFX callback ga o'tmasin
                    } else {
                        // .FFX logic (Short & Safe)
                        applyScript = `(function(){ 
                            var res = "Success";
                            app.beginUndoGroup("Apply Preset");
                            try {
                                var f=new File("${escapedPath}"); 
                                if(!f.exists) throw new Error("Missing"); 
                                var c=app.project.activeItem; 
                                if(!c) throw new Error("No Comp"); 
                                var s=c.selectedLayers; 
                                for(var i=0;i<s.length;i++) s[i].applyPreset(f);
                            } catch(e) { res = "Error: " + e.toString(); } 
                            finally { app.endUndoGroup(); }
                            return res;
                        })()`;
                    }

                    csInterface.evalScript(applyScript, (result) => {
                        // v8: result format is "Status|debug_info"
                        console.log('[darkPanel AEP debug]', result);
                        if (result && result.indexOf('Success') !== -1) {
                            const lastAction = document.getElementById('dp-last-action');
                            const lastTime = document.getElementById('dp-last-time');
                            if (lastAction)
                                lastAction.textContent = isAEP ? 'Effect Fitted' : 'Preset Applied';
                            if (lastTime) {
                                const now = new Date();
                                lastTime.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                            }
                            const toast = document.createElement('div');
                            toast.className = 'apply-toast';
                            toast.textContent = isAEP ? 'EFFECTS ADDED' : 'APPLIED';
                            document.body.appendChild(toast);
                            setTimeout(() => {
                                toast.classList.add('hide');
                                setTimeout(() => toast.remove(), 500);
                            }, 1500);
                        } else {
                            console.error(result);
                            const toast = document.createElement('div');
                            toast.className = 'apply-toast';
                            toast.style.borderColor = 'red';
                            toast.textContent =
                                result.split('|')[0].replace('Error: ', '') || 'ERROR';
                            document.body.appendChild(toast);
                            setTimeout(() => {
                                toast.classList.add('hide');
                                setTimeout(() => toast.remove(), 500);
                            }, 2000);
                        }
                    });
                });
            } catch (err) {
                console.error('Apply preset error:', err);
            }
        }

        function blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        function showApplyToast(msg = 'DONE') {
            const old = document.querySelector('.apply-toast');
            if (old) old.remove();

            const toast = document.createElement('div');
            toast.className = 'apply-toast';
            toast.textContent = msg;

            document.body.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 500);
            }, 1200);
        }

        function setupEventListeners() {
            prevPageBtn?.addEventListener(
                'click',
                () => currentPage > 1 && showPage(currentPage - 1)
            );
            nextPageBtn?.addEventListener(
                'click',
                () => currentPage < totalPages && showPage(currentPage + 1)
            );
            refreshBtn?.addEventListener('click', () => {
                selectedPreset = null;
                presets.forEach((p) => p.classList.remove('selected'));
                if (status) status.textContent = 'No items selected';
                showPage(1);
            });
            applyBtn?.addEventListener('click', applyPreset);
            allTab?.addEventListener('click', () => switchTab('all'));
            favoritesTab?.addEventListener('click', () => switchTab('favorites'));
            textPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                switchPack('text');
            });
            effectPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                switchPack('effect');
            });

            const copyBtn = document.getElementById('copyDeviceBtn');

            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(deviceId);

                        copyBtn.textContent = 'Copied!';
                        copyBtn.classList.add('copied');

                        setTimeout(() => {
                            copyBtn.textContent = 'Copy device ID';
                            copyBtn.classList.remove('copied');
                        }, 1200);
                    } catch (e) {
                        console.warn('Clipboard failed, fallback');

                        const ta = document.createElement('textarea');
                        ta.value = deviceId;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();

                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => {
                            copyBtn.textContent = 'Copy device ID';
                        }, 1200);
                    }
                });
            }

            const checkUpdateBtn = document.getElementById('checkUpdateBtn');

            if (checkUpdateBtn) {
                checkUpdateBtn.addEventListener('click', async () => {
                    if (!navigator.onLine) {
                        showMiniToast('No internet connection');
                        return;
                    }

                    checkUpdateBtn.textContent = 'Checking…';
                    checkUpdateBtn.disabled = true;

                    try {
                        const UPDATE_URL = API_BASE.replace('/api', '') + '/data/update.json';
                        const res = await fetch(UPDATE_URL + '?v=' + Date.now(), {
                            cache: 'no-store',
                        });

                        if (!res.ok) throw new Error('update.json not found');

                        const remote = await res.json();

                        const localVersion =
                            localStorage.getItem('darkpanel_last_applied_version') ||
                            localStorage.getItem('darkpanel_installed_version') ||
                            '1.0.0';

                        if (isNewerVersion(remote.version, localVersion)) {
                            showMiniToast(`Updating → v${remote.version}`);
                            await autoUpdateIfNeeded();
                        } else {
                            showMiniToast('You are up to date ✔');
                        }
                    } catch (e) {
                        console.warn(e);
                        showMiniToast('Update check failed');
                    } finally {
                        checkUpdateBtn.textContent = 'Check update';
                        checkUpdateBtn.disabled = false;
                    }
                });
            }
        }

        function showMiniToast(text) {
            const old = document.querySelector('.mini-toast');
            if (old) old.remove();

            const t = document.createElement('div');
            t.className = 'mini-toast';
            t.textContent = text;
            document.body.appendChild(t);

            requestAnimationFrame(() => t.classList.add('show'));

            setTimeout(() => {
                t.classList.remove('show');
                setTimeout(() => t.remove(), 300);
            }, 1600);
        }

        function switchPack(type) {
            if (currentPack === type) return;
            currentPack = type;
            localStorage.setItem('currentPack', type);
            updatePackUI();
            createPresets();
            selectedPreset = null;
            if (status) status.textContent = 'No items selected';
        }

        function switchTab(type) {
            if (currentView === type) return;
            currentView = type;
            allTab?.classList.toggle('active', type === 'all');
            favoritesTab?.classList.toggle('active', type === 'favorites');
            selectedPreset = null;
            if (status) status.textContent = 'No items selected';
            showPage(1);
        }

        function setupTabsUnderline() {
            const tabsContainer = document.querySelector('.tabs');
            const tabs = document.querySelectorAll('.tab');
            const underline = document.querySelector('.underline');

            if (!tabsContainer || !underline || !tabs.length) return;

            function moveUnderline(tab) {
                const r = tab.getBoundingClientRect();
                const pr = tabsContainer.getBoundingClientRect();

                const left = r.left - pr.left;
                const width = r.width;

                document.documentElement.style.setProperty('--underline-left', left + 'px');
                document.documentElement.style.setProperty('--underline-width', width + 'px');
            }

            const activeTab = document.querySelector('.tab.active') || tabs[0];
            moveUnderline(activeTab);

            tabs.forEach((tab) => {
                tab.addEventListener('click', () => {
                    document.querySelector('.tab.active')?.classList.remove('active');
                    tab.classList.add('active');
                    moveUnderline(tab);
                });
            });

            window.addEventListener('resize', () => {
                const active = document.querySelector('.tab.active');
                if (active) moveUnderline(active);
            });
        }

        function setupPackDropdown() {
            const packDropdown = document.querySelector('.pack-dropdown');
            if (!packDropdown) return;

            const packBtn = packDropdown.querySelector('.pack-btn');
            const label = packBtn.querySelector('.pack-label');
            const arrow = packBtn.querySelector('.pack-arrow');
            const dropdown = packDropdown.querySelector('.pack-dropdown-content');

            if (!packBtn || !dropdown) return;

            packBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
                packBtn.classList.toggle('active');
            });

            textPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                dropdown.classList.remove('show');
                packBtn.classList.remove('active');
                switchPack('text');
            });

            effectPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                dropdown.classList.remove('show');
                packBtn.classList.remove('active');
                switchPack('effect');
            });

            document.addEventListener('click', (e) => {
                if (!packDropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                    packBtn.classList.remove('active');
                }
            });
        }
    }
});
