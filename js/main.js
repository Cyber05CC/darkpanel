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

            // preset-img ni autoplay observer boshqaradi
            if (img.classList.contains('preset-img')) return;

            img.src = src;
            img.classList.remove('lazy');

            img.onload = () => {
                requestAnimationFrame(() => {
                    img.style.transition = 'opacity 0.3s ease';
                    img.style.opacity = '1';
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

    // activePreviewImg o'chirildi — autoplay observer boshqaradi
    let selectedPresetEl = null;
    // ========== AUTOPLAY PREVIEW SYSTEM ==========
    // Toggle bilan boshqariladi — yoqilsa footage o'ynaydi, o'chirilsa to'xtaydi

    let autoplayEnabled = localStorage.getItem('dp_autoplay') !== 'off'; // default: ON
    let autoplayObserver = null;
    const autoplayingSet = new Set();

    function playPreview(img) {
        if (!autoplayEnabled) return; // TOGGLE O'CHIRILGAN
        if (!img || !img.dataset.src) return;
        if (autoplayingSet.has(img)) return;

        autoplayingSet.add(img);

        // Rasm YUKLANGANIDAN KEYIN ko'rsatish
        img.onload = () => {
            img.style.opacity = '1';
            // Shimmer ni yashirish
            const placeholder = img.parentElement?.querySelector('.image-placeholder');
            if (placeholder) placeholder.style.display = 'none';
        };

        img.src = img.dataset.src;
        // Agar allaqachon cache da bo'lsa
        if (img.complete && img.naturalWidth > 0) {
            img.style.opacity = '1';
            const placeholder = img.parentElement?.querySelector('.image-placeholder');
            if (placeholder) placeholder.style.display = 'none';
        }
    }

    function stopPreview(img) {
        if (!img) return;

        img.onload = null;
        img.removeAttribute('src');
        img.style.opacity = '0';

        // Shimmer ni qaytarish
        const placeholder = img.parentElement?.querySelector('.image-placeholder');
        if (placeholder) placeholder.style.display = '';

        autoplayingSet.delete(img);
    }

    function stopAllPreviews() {
        document.querySelectorAll('.preset-img').forEach((img) => {
            stopPreview(img);
        });
        autoplayingSet.clear();
    }

    function initAutoplayObserver() {
        // Eski observerni tozalash
        if (autoplayObserver) {
            autoplayObserver.disconnect();
        }

        autoplayObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const preset = entry.target;
                    const img = preset.querySelector('.preset-img');
                    if (!img || !img.dataset.src) return;

                    if (entry.isIntersecting) {
                        playPreview(img);
                    } else {
                        if (preset !== selectedPresetEl) {
                            stopPreview(img);
                        }
                    }
                });
            },
            {
                rootMargin: '100px',
                threshold: 0.1,
            }
        );
    }

    function observeVisiblePresets() {
        if (!autoplayObserver) return;

        // Avval hammasini unobserve
        autoplayObserver.disconnect();

        // Faqat display:block bo'lgan presetlarni observe
        document.querySelectorAll('.preset').forEach((preset) => {
            if (preset.style.display !== 'none') {
                autoplayObserver.observe(preset);
            }
        });
    }

    // FALLBACK: Observer ishlamasa, to'g'ridan-to'g'ri yuklash
    function forceLoadVisiblePresets() {
        const container = document.getElementById('presets-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();

        document.querySelectorAll('.preset').forEach((preset) => {
            if (preset.style.display === 'none') return;

            const rect = preset.getBoundingClientRect();
            // Ekranda ko'rinadimi?
            const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;

            if (isVisible) {
                const img = preset.querySelector('.preset-img');
                if (img && img.dataset.src && !img.src) {
                    playPreview(img);
                }
            }
        });
    }

    // ========== AUTOPLAY TOGGLE ==========
    function toggleAutoplay() {
        autoplayEnabled = !autoplayEnabled;
        localStorage.setItem('dp_autoplay', autoplayEnabled ? 'on' : 'off');

        // UI tugmasini yangilash
        updateAutoplayBtn();

        if (autoplayEnabled) {
            // Yoqildi — ko'rinadigan presetlarni yuklash
            observeVisiblePresets();
            setTimeout(() => forceLoadVisiblePresets(), 100);
        } else {
            // O'chirildi — hammasini to'xtatish
            stopAllPreviews();
            if (autoplayObserver) autoplayObserver.disconnect();
        }
    }

    function updateAutoplayBtn() {
        const btn = document.getElementById('autoplayToggle');
        if (!btn) return;
        if (autoplayEnabled) {
            btn.classList.add('active');
            btn.title = 'Autoplay ON';
        } else {
            btn.classList.remove('active');
            btn.title = 'Autoplay OFF';
        }
    }

    // Tugmani yaratish (tabs ichiga)
    function createAutoplayButton() {
        const gridControl = document.querySelector('.grid-control');
        if (!gridControl || document.getElementById('autoplayToggle')) return;

        const btn = document.createElement('button');
        btn.id = 'autoplayToggle';
        btn.className = 'grid-btn autoplay-btn' + (autoplayEnabled ? ' active' : '');
        btn.title = autoplayEnabled ? 'Autoplay ON' : 'Autoplay OFF';
        btn.innerHTML = '▶';
        btn.addEventListener('click', toggleAutoplay);

        // Grid control dan oldin qo'yish
        gridControl.parentElement.insertBefore(btn, gridControl);
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
            createAutoplayButton();
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

                preset.innerHTML = `
                    <div class="preset-thumb">
                        <div class="image-placeholder"></div>
                        <img class="preset-img" data-src="${footageSrc}" alt="" draggable="false" />
                        <input type="checkbox" class="favorite-check" data-file="${fileName}">
                    </div>
                    <div class="preset-name">${packType} ${uiCounter}</div>
                `;

                presetList.appendChild(preset);

                const footageImg = preset.querySelector('.preset-img');
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
            initPresetPreviews(); // Observer AVVAL yaratiladi
            showPage(1); // Keyin observe qilinadi
        }
        function initPresetPreviews() {
            const presets = document.querySelectorAll('.preset');

            presets.forEach((preset) => {
                const webpImg = preset.querySelector('.preset-img');
                if (!webpImg) return;

                // Hover endi kerak emas — autoplay observer boshqaradi
                // Faqat CLICK (SELECT) qoldi

                preset.addEventListener('click', (e) => {
                    if (e.target.classList.contains('favorite-check')) return;

                    // A) Eski tanlangan kartochkani bekor qilish
                    if (selectedPresetEl && selectedPresetEl !== preset) {
                        selectedPresetEl.classList.remove('selected');
                    }

                    // B) O'zini qayta bosish (Deselect)
                    if (selectedPresetEl === preset) {
                        preset.classList.remove('selected');
                        selectedPresetEl = null;
                        selectedPreset = null;
                        if (status) status.textContent = 'No items selected';
                        return;
                    }

                    // C) Yangi kartochka tanlash
                    preset.classList.add('selected');
                    selectedPresetEl = preset;
                    selectedPreset = preset.dataset.file;

                    if (status) {
                        status.textContent = `Selected: ${preset.querySelector('.preset-name').textContent}`;
                    }
                });
            });

            // Autoplay observer ni ishga tushirish
            initAutoplayObserver();
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

            // Autoplay: observe + force load fallback
            setTimeout(() => {
                observeVisiblePresets();
                // Fallback: observer ishlamasa, 300ms keyin to'g'ridan-to'g'ri yuklash
                requestAnimationFrame(() => {
                    setTimeout(() => forceLoadVisiblePresets(), 300);
                });
            }, 50);
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
                        // .AEP APPLY v15
                        //
                        // TUZATISHLAR:
                        // 1) Tashqi layerni scale QILMASLIK
                        // 2) Project panelda "darkPanel" papkasi —
                        //    hamma import shu ichiga, dublikat bo'lmaydi
                        // 3) Adjustment layer qo'llab-quvvatlanadi
                        // 4) Ichki layer transform ga TEGMASLIK
                        // =====================================================

                        const evalP = (script) =>
                            new Promise((resolve) => {
                                csInterface.evalScript(script, (res) => resolve(res));
                            });

                        try {
                            // ========== STEP 1: IMPORT (undo group TASHQARIDA) ==========
                            const step1 = `(function(){
                                try {
                                    var f = new File("${escapedPath}");
                                    if(!f.exists) return "ERR:File missing";

                                    var comp = app.project.activeItem;
                                    if (!comp || !(comp instanceof CompItem)) return "ERR:No Comp";
                                    var sel = comp.selectedLayers;
                                    if (sel.length === 0) return "ERR:No Layer";

                                    // Eski dp_temp itemlarni tozalash (CTRL+Z dan qolganlar)
                                    for (var c = app.project.numItems; c >= 1; c--) {
                                        try {
                                            var itm = app.project.item(c);
                                            if (itm.name === "dp_temp.aep" || itm.name === "dp_temp") {
                                                itm.remove();
                                            }
                                        } catch(e){}
                                    }

                                    var io = new ImportOptions(f);
                                    var imported = app.project.importFile(io);

                                    var srcComp = null;
                                    if (imported instanceof CompItem) {
                                        srcComp = imported;
                                    } else if (imported instanceof FolderItem) {
                                        for (var i = 1; i <= imported.numItems; i++) {
                                            if (imported.item(i) instanceof CompItem) {
                                                srcComp = imported.item(i); break;
                                            }
                                        }
                                    }
                                    if (!srcComp || srcComp.numLayers === 0) return "ERR:Bad AEP";

                                    // Adjustment layer tekshirish
                                    var srcLayer = srcComp.layer(1);
                                    var isAdj = srcLayer.adjustmentLayer ? 1 : 0;
                                    var hasSource = sel[0].source ? 1 : 0;
                                    var lw = 0, lh = 0;
                                    if (hasSource) { lw = sel[0].source.width; lh = sel[0].source.height; }

                                    return "OK:" + srcComp.id + ":" + sel[0].index + ":" + isAdj + ":" + hasSource + ":" + imported.id + ":" + lw + ":" + lh;
                                } catch(e) { return "ERR:" + e.toString(); }
                            })()`;

                            const r1 = await evalP(step1);
                            console.log('[dp step1]', r1);
                            if (r1.indexOf('ERR') === 0) throw new Error(r1.replace('ERR:', ''));

                            const p = r1.split(':');
                            const srcId = p[1],
                                tIdx = p[2],
                                isAdj = p[3] === '1',
                                hasSource = p[4] === '1',
                                importedId = p[5];
                            const layerW = parseInt(p[6]) || 0,
                                layerH = parseInt(p[7]) || 0;

                            // ========== STEP 2: APPLY (TOZA UNDO GROUP) ==========
                            const step2 = `(function(){
                                var undoStarted = false;
                                try {
                                    var comp = app.project.activeItem;
                                    if (!comp || !(comp instanceof CompItem)) return "Error: No Comp";

                                    // srcComp topish
                                    var srcComp = null;
                                    for (var i = 1; i <= app.project.numItems; i++) {
                                        if (app.project.item(i).id == ${srcId}) { srcComp = app.project.item(i); break; }
                                    }
                                    if (!srcComp) return "Error: srcComp not found";

                                    // Imported item topish (papkaga ko'chirish uchun)
                                    var importedItem = null;
                                    for (var i = 1; i <= app.project.numItems; i++) {
                                        if (app.project.item(i).id == ${importedId}) { importedItem = app.project.item(i); break; }
                                    }

                                    var targetLayer = comp.layer(${tIdx});
                                    if (!targetLayer) return "Error: Target not found";

                                    app.beginUndoGroup("Apply Smart Preset");
                                    undoStarted = true;

                                    // === PAPKA TASHKIL QILISH ===
                                    // "darkPanel" papkasini topish yoki yaratish
                                    var dpFolder = null;
                                    for (var i = 1; i <= app.project.numItems; i++) {
                                        var itm = app.project.item(i);
                                        if (itm instanceof FolderItem && itm.name === "darkPanel") {
                                            dpFolder = itm; break;
                                        }
                                    }
                                    if (!dpFolder) {
                                        dpFolder = app.project.items.addFolder("darkPanel");
                                    }

                                    // Import qilingan itemni papkaga ko'chirish
                                    if (importedItem) {
                                        importedItem.parentFolder = dpFolder;
                                    }
                                    // srcComp ham papkaga
                                    try { srcComp.parentFolder = dpFolder; } catch(e){}

                                    var isAdjustment = ${isAdj ? 'true' : 'false'};
                                    var targetHasSource = ${hasSource ? 'true' : 'false'};

                                    if (isAdjustment) {
                                        // === ADJUSTMENT LAYER REJIMI ===
                                        // srcComp ichidagi adjustment layerning effectlarini
                                        // haqiqiy adjustment layer ga ko'chirish (COMP EMAS!)

                                        var srcLayer = srcComp.layer(1);
                                        var srcEffects = srcLayer.property("ADBE Effect Parade");

                                        // 1) Haqiqiy adjustment layer yaratish (comp o'lchamida)
                                        var adjLayer = comp.layers.addSolid(
                                            [1,1,1],
                                            srcComp.name || "Adjustment",
                                            comp.width, comp.height, 1,
                                            comp.duration
                                        );
                                        adjLayer.adjustmentLayer = true;

                                        // 2) Effectlarni ko'chirish
                                        if (srcEffects && srcEffects.numProperties > 0) {
                                            var adjEffects = adjLayer.property("ADBE Effect Parade");

                                            function copyProp(src, dst) {
                                                try {
                                                    if (src.propertyType === PropertyType.PROPERTY) {
                                                        var vt = src.propertyValueType;
                                                        if (vt === PropertyValueType.NO_VALUE || vt === PropertyValueType.CUSTOM_VALUE) return;

                                                        // Keyframelar
                                                        if (src.isTimeVarying && src.numKeys > 0) {
                                                            for (var k = 1; k <= src.numKeys; k++) {
                                                                try { dst.setValueAtTime(src.keyTime(k), src.keyValue(k)); } catch(e){}
                                                            }
                                                            for (var k = 1; k <= src.numKeys; k++) {
                                                                try { dst.setInterpolationTypeAtKey(k, src.keyInInterpolationType(k), src.keyOutInterpolationType(k)); } catch(e){}
                                                                try {
                                                                    var ie = src.keyInTemporalEase(k), oe = src.keyOutTemporalEase(k);
                                                                    var ni=[], no=[];
                                                                    for(var j=0;j<ie.length;j++){ni.push(new KeyframeEase(ie[j].speed,ie[j].influence));no.push(new KeyframeEase(oe[j].speed,oe[j].influence));}
                                                                    dst.setTemporalEaseAtKey(k,ni,no);
                                                                } catch(e){}
                                                            }
                                                        } else {
                                                            try { dst.setValue(src.value); } catch(e){}
                                                        }
                                                        // Expression
                                                        try { if(src.expressionEnabled && src.expression) dst.expression = src.expression; } catch(e){}
                                                    } else if (src.propertyType === PropertyType.NAMED_GROUP || src.propertyType === PropertyType.INDEXED_GROUP) {
                                                        for (var i = 1; i <= src.numProperties; i++) {
                                                            try {
                                                                var sp = src.property(i);
                                                                var dp = null;
                                                                try { dp = dst.property(sp.name); } catch(e){}
                                                                if (!dp) { try { dp = dst.property(i); } catch(e){} }
                                                                if (dp) copyProp(sp, dp);
                                                            } catch(e){}
                                                        }
                                                    }
                                                } catch(e){}
                                            }

                                            for (var ef = 1; ef <= srcEffects.numProperties; ef++) {
                                                try {
                                                    var srcEff = srcEffects.property(ef);
                                                    var newEff = adjEffects.addProperty(srcEff.matchName);
                                                    if (newEff) copyProp(srcEff, newEff);
                                                } catch(e){}
                                            }
                                        }

                                        // 3) Timing — tanlangan layer bilan bir xil
                                        adjLayer.startTime = targetLayer.startTime;
                                        adjLayer.inPoint = targetLayer.inPoint;
                                        adjLayer.outPoint = targetLayer.outPoint;

                                        // 4) Tanlangan layerning USTIGA qo'yish
                                        var curIdx = targetLayer.index;
                                        if (adjLayer.index > curIdx) {
                                            adjLayer.moveBefore(comp.layer(curIdx));
                                        }

                                        // 5) Tanlash
                                        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
                                        adjLayer.selected = true;
                                        try { adjLayer.name = srcComp.name || "Adjustment"; } catch(e){}

                                    } else if (targetHasSource) {
                                        // === NORMAL REJIM ===
                                        // TUZILMA:
                                        // Main Comp (1080×1920)
                                        //   └── srcComp (1080×1920) + effectlar
                                        //         └── innerComp (1080×1920) ← LAYER BOUNDS KATTA
                                        //               └── PNG (540×250) markazda
                                        //
                                        // SABAB: effectlar LAYER BOUNDS ichida ishlaydi
                                        // Agar PNG 540×250 bo'lsa → effect faqat 540×250 da
                                        // innerComp = 1080×1920 → effect BUTUN COMP da tarqaladi
                                        
                                        var srcLayer = srcComp.layer(1);
                                        var lw = ${layerW};
                                        var lh = ${layerH};
                                        
                                        // 1) innerComp yaratish (MAIN COMP o'lchamida)
                                        var innerComp = app.project.items.addComp(
                                            targetLayer.name + "_inner",
                                            comp.width, comp.height,
                                            comp.pixelAspect,
                                            comp.duration,
                                            comp.frameRate
                                        );
                                        try { innerComp.parentFolder = dpFolder; } catch(e){}

                                        // 2) Layer source ni innerComp ichiga qo'shish
                                        var innerLayer = innerComp.layers.add(targetLayer.source);
                                        // Markazga joylash
                                        innerLayer.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2, comp.height/2]);

                                        // 3) replaceSource — innerComp (1080×1920) ni srcComp ichiga
                                        //    Endi layer bounds = 1080×1920 → effectlar to'liq ishlaydi!
                                        srcLayer.replaceSource(innerComp, false);
                                        
                                        // 4) srcComp ni MAIN COMP o'lchamiga resize
                                        srcComp.width = comp.width;
                                        srcComp.height = comp.height;
                                        srcComp.frameDuration = comp.frameDuration;
                                        srcComp.duration = comp.duration;

                                        // 5) Ichki layer markazga
                                        try {
                                            var inner = srcComp.layer(1);
                                            inner.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2, comp.height/2]);
                                        } catch(e){}

                                        // 6) srcComp ni main comp ga qo'shish
                                        var newLayer = comp.layers.add(srcComp);
                                        newLayer.collapseTransformation = true;

                                        // 5) Timing ko'chirish
                                        newLayer.startTime = targetLayer.startTime;
                                        newLayer.inPoint = targetLayer.inPoint;
                                        newLayer.outPoint = targetLayer.outPoint;

                                        // 6) BARCHA TRANSFORM ko'chirish
                                        try {
                                            var sT = targetLayer.property("ADBE Transform Group");
                                            var dT = newLayer.property("ADBE Transform Group");
                                            var tProps = ["ADBE Position","ADBE Scale","ADBE Rotate Z","ADBE Opacity"];
                                            try { if(targetLayer.threeDLayer) { tProps.push("ADBE Rotate X","ADBE Rotate Y"); newLayer.threeDLayer = true; } } catch(e){}
                                            for (var pi = 0; pi < tProps.length; pi++) {
                                                try {
                                                    var sp = sT.property(tProps[pi]);
                                                    var dp = dT.property(tProps[pi]);
                                                    if (!sp || !dp) continue;
                                                    if (sp.numKeys > 0) {
                                                        for (var k = 1; k <= sp.numKeys; k++) {
                                                            dp.setValueAtTime(sp.keyTime(k), sp.keyValue(k));
                                                            try { dp.setInterpolationTypeAtKey(k, sp.keyInInterpolationType(k), sp.keyOutInterpolationType(k)); } catch(e){}
                                                        }
                                                    } else {
                                                        dp.setValue(sp.value);
                                                    }
                                                    try { if(sp.expressionEnabled && sp.expression) dp.expression = sp.expression; } catch(e){}
                                                } catch(e){}
                                            }
                                        } catch(e){}

                                        // 7) Layer tartibini to'g'rilash
                                        var curIdx = targetLayer.index;
                                        if (curIdx > 1) {
                                            newLayer.moveAfter(comp.layer(curIdx));
                                        }

                                        // 8) Eski layerni o'chirish
                                        targetLayer.remove();

                                        // 9) Tanlash
                                        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
                                        newLayer.selected = true;
                                        try { newLayer.name = srcComp.name; } catch(e){}

                                    } else {
                                        // === SOURCE YO'Q (text, shape, null, camera) ===
                                        // srcComp ni oddiy layer sifatida qo'shish
                                        var newLayer = comp.layers.add(srcComp);
                                        newLayer.startTime = comp.time;

                                        var curIdx = targetLayer.index;
                                        if (newLayer.index !== curIdx) {
                                            newLayer.moveBefore(comp.layer(curIdx));
                                        }

                                        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
                                        newLayer.selected = true;
                                        try { newLayer.name = srcComp.name; } catch(e){}
                                        newLayer.collapseTransformation = true;
                                    }

                                    // Temp faylni o'chirish
                                    try { var tf = new File("${escapedPath}"); tf.remove(); } catch(e){}

                                    app.endUndoGroup();
                                    undoStarted = false;
                                    return "Success";
                                } catch(err) {
                                    if (undoStarted) { try{app.endUndoGroup();}catch(x){} }
                                    return "Error: " + err.toString();
                                }
                            })()`;

                            const r2 = await evalP(step2);
                            console.log('[dp step2]', r2);

                            if (r2.indexOf('Success') !== -1) {
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
                                throw new Error(r2);
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
                        return;
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

            const ownerBtn = document.getElementById('ownerBtn');

            if (ownerBtn) {
                ownerBtn.addEventListener('click', () => {
                    closeInfoModal();
                    const ownerPanel = document.getElementById('dp-owner-panel');
                    if (ownerPanel) {
                        ownerPanel.classList.add('show');
                        // Real-time subscriber count olish
                        fetchSubscriberCount();
                    }
                });
            }

            // Subscriber count fetch
            async function fetchSubscriberCount() {
                const el = document.getElementById('owner-sub-count');
                if (!el) return;

                try {
                    el.textContent = '...';
                    el.classList.add('loading');
                    const res = await fetch(
                        API_BASE.replace('/api', '') + '/api/telegram/subscribers',
                        {
                            cache: 'no-store',
                        }
                    );
                    if (!res.ok) throw new Error('API error');
                    const data = await res.json();
                    el.classList.remove('loading');
                    if (data.count) {
                        el.textContent = data.count.toLocaleString();
                    } else {
                        el.textContent = '—';
                    }
                } catch (e) {
                    console.warn('Subscriber count fetch failed:', e);
                    el.classList.remove('loading');
                    el.textContent = '—';
                }
            }

            // Owner panel Back tugmasi
            const ownerBackBtn = document.getElementById('ownerBackBtn');
            if (ownerBackBtn) {
                ownerBackBtn.addEventListener('click', () => {
                    const ownerPanel = document.getElementById('dp-owner-panel');
                    if (ownerPanel) ownerPanel.classList.remove('show');
                });
            }

            // Owner panel — tashqi linklar (default brauzerda ochish)
            document.querySelectorAll('.owner-link-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const url = btn.dataset.url;
                    if (!url) return;
                    try {
                        if (csInterface) {
                            csInterface.openURLInDefaultBrowser(url);
                        } else {
                            window.open(url, '_blank');
                        }
                    } catch (e) {
                        window.open(url, '_blank');
                    }
                });
            });

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
