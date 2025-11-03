/* darkPanel main.js — FULL build with Firebase key activation (trial + lifetime)
 * Drop-in replacement for js/main.js
 * Works with your existing index.html (no extra changes required)
 */

document.addEventListener('DOMContentLoaded', async function () {
    'use strict';

    // -------------------- Helpers --------------------
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // CEP guard
    let csInterface = null;
    try {
        csInterface = new CSInterface();
    } catch (_) {
        console.warn('CSInterface not available. Running in browser preview mode.');
    }

    // -------------------- Firebase Loader --------------------
    async function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(s);
        });
    }

    async function ensureFirebaseLoaded() {
        if (window.firebase?.apps?.length) return;
        // Use Firebase v8 compat API (database())
        await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
        await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
        const firebaseConfig = {
            apiKey: 'AIzaSyC07km-qBiZkQnu-DtrpLIwVvbxjoMQzGg',
            authDomain: 'darkpanelauth.firebaseapp.com',
            databaseURL: 'https://darkpanelauth-default-rtdb.europe-west1.firebasedatabase.app',
            projectId: 'darkpanelauth',
            storageBucket: 'darkpanelauth.appspot.com',
            messagingSenderId: '315614713241',
            appId: '1:315614713241:web:78121bfb3ee9258f3d2f08',
        };
        window.firebase.initializeApp(firebaseConfig);
    }

    // -------------------- Device Fingerprint --------------------
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

    // -------------------- License Layer --------------------
    const LOCAL_KEY = 'darkpanel_license_key';
    const deviceId = await getDeviceId();
    await ensureFirebaseLoaded();
    const db = firebase.database();

    async function readKey(key) {
        try {
            const snap = await db.ref('keys/' + key).get();
            if (!snap.exists()) return null;
            return snap.val();
        } catch (e) {
            console.warn('Firebase read error:', e);
            return null;
        }
    }

    async function validateStoredKey() {
        const key = localStorage.getItem(LOCAL_KEY);
        if (!key) return false;
        const data = await readKey(key);
        if (!data) return false;
        const now = Date.now();
        if (data.deviceId && data.deviceId !== deviceId) return false;
        if (data.type === 'trial') {
            if (!data.expiresAt) return false;
            if (Number(data.expiresAt) < now) return false;
        }
        return true;
    }

    function renderActivationUI() {
        const overlay = document.createElement('div');
        overlay.id = 'dp-activation';
        overlay.style.cssText = `
            position:fixed;inset:0;background:#0f0f10;display:flex;align-items:center;justify-content:center;
            z-index:999999;color:#fff;font-family:Inter,system-ui,Arial,sans-serif;
        `;
        overlay.innerHTML = `
            <div style="width:min(420px,90vw);padding:22px 20px;border:1px solid #2a2a2a;border-radius:14px;background:linear-gradient(180deg,#141416,#0f0f10)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                    <div style="width:32px;height:32px;border-radius:8px;background:#3537ff;display:flex;align-items:center;justify-content:center;">🔐</div>
                    <h2 style="margin:0;font-size:18px;font-weight:700">DarkPanel Activation</h2>
                </div>
                <p style="margin:6px 0 14px;color:#bdbdbd;font-size:12px">Enter your license key. Trial keys work for 7 days on a single device. Lifetime keys bind to one device.</p>
                <input id="dp-key" placeholder="XXXX-XXXX-XXXX" spellcheck="false"
                       style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2b2b2b;background:#131318;color:#eaeaea;outline:none;font-size:13px">
                <div style="display:flex;gap:10px;margin-top:12px">
                    <button id="dp-activate" style="flex:1;padding:10px 12px;border:0;border-radius:10px;background:#4a6cff;color:#fff;font-weight:600;cursor:pointer">Activate</button>
                    <button id="dp-exit" style="padding:10px 12px;border:1px solid #2b2b2b;border-radius:10px;background:#16161a;color:#ddd;cursor:pointer">Close</button>
                </div>
                <div id="dp-msg" style="margin-top:10px;color:#9ca3af;font-size:12px;min-height:16px"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('dp-exit').onclick = () => {
            document.getElementById('dp-msg').textContent = 'Activation required to continue.';
        };

        document.getElementById('dp-activate').onclick = async () => {
            const el = document.getElementById('dp-key');
            const msg = document.getElementById('dp-msg');
            const key = (el.value || '').trim();
            if (!key) return (msg.textContent = 'Please paste your key.');

            msg.textContent = 'Checking key…';
            const data = await readKey(key);
            if (!data) {
                msg.textContent = '❌ Invalid key.';
                return;
            }
            const now = Date.now();
            if (data.deviceId && data.deviceId !== deviceId) {
                msg.textContent = '⚠️ This key is already used on another device.';
                return;
            }
            if (data.type === 'trial') {
                let expiresAt = Number(data.expiresAt || 0);
                if (!expiresAt) {
                    expiresAt = now + 7 * 24 * 60 * 60 * 1000;
                    await db.ref('keys/' + key).update({ deviceId, createdAt: now, expiresAt });
                } else if (expiresAt < now) {
                    msg.textContent = '⏰ Trial expired.';
                    return;
                } else {
                    if (!data.deviceId) await db.ref('keys/' + key).update({ deviceId });
                }
            }
            if (data.type === 'lifetime') {
                if (!data.deviceId) await db.ref('keys/' + key).update({ deviceId });
            }

            localStorage.setItem(LOCAL_KEY, key);
            msg.textContent = '✅ Activated! Loading…';
            await sleep(500);
            overlay.remove();
            startApp();
        };
    }

    if (!(await validateStoredKey())) {
        renderActivationUI();
        return;
    }

    startApp();

    // =================== APP CORE ===================
    function startApp() {
        // ----------------------- CONFIG -----------------------
        const GITHUB_RAW = 'https://raw.githubusercontent.com/Cyber05CC/darkpanel/main';
        const VERCEL_BASE = 'https://darkpanel-coral.vercel.app';
        const UPDATE_URL = VERCEL_BASE + '/update.json';
        const BUNDLE_VERSION = '1.1';
        const LS_INSTALLED = 'darkpanel_installed_version';
        const LS_LAST_APPLIED = 'darkpanel_last_applied_version';
        const SUPPORTED_TEXT_FILES = [
            'index.html',
            'css/style.css',
            'js/main.js',
            'CSXS/manifest.xml',
        ];

        // UI elementlar
        let selectedPreset = null;
        const autoPlayCheckbox = document.getElementById('autoPlay');
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

        // UI holat
        const itemsPerPage = 10;
        let currentPage = 1;
        let totalPages = 1;
        let currentView = 'all';
        let currentPack = localStorage.getItem('currentPack') || 'text';
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        let presets = [];
        let currentVersion = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

        // -------------------- STARTUP --------------------
        setupConnectionWatcher();
        init();
        safeCheckForUpdates();

        // ===================== INTERNET WATCHER =====================
        function setupConnectionWatcher() {
            function showConnectionAlert(message, type = 'error') {
                const existing = document.querySelector('.net-alert');
                if (existing) existing.remove();
                const alert = document.createElement('div');
                alert.className = `net-alert ${type}`;
                alert.style.cssText = `position:fixed;left:50%;transform:translateX(-50%);bottom:16px;padding:10px 14px;border-radius:10px;background:${
                    type === 'error' ? '#311' : '#133'
                };color:#fff;z-index:9999;opacity:0;transition:.25s`;
                alert.innerHTML = `<div class="net-alert-content">${
                    type === 'error' ? '📡' : '🌐'
                } ${message}</div>`;
                document.body.appendChild(alert);
                requestAnimationFrame(() => (alert.style.opacity = 1));
                if (type === 'success') {
                    setTimeout(() => {
                        alert.style.opacity = 0;
                        setTimeout(() => alert.remove(), 400);
                    }, 1800);
                }
            }

            window.addEventListener('offline', () => {
                showConnectionAlert('There is no internet.', 'error');
            });

            window.addEventListener('online', () => {
                showConnectionAlert('Connecting...', 'success');
                setTimeout(() => location.reload(true), 1200);
            });

            if (!navigator.onLine) showConnectionAlert('There is no internet.', 'error');
        }

        // ===================== UPDATE SYSTEM =====================
        async function safeCheckForUpdates() {
            try {
                const res = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
                if (!res.ok) throw new Error('update.json not found');
                const remote = await res.json();

                const installed =
                    localStorage.getItem(LS_LAST_APPLIED) ||
                    localStorage.getItem(LS_INSTALLED) ||
                    BUNDLE_VERSION;

                if (remote?.version && remote.version !== installed) {
                    showUpdatePopup(remote.version, remote.files || {});
                } else {
                    console.log('✅ Version is up to date:', installed);
                    currentVersion = installed;
                    updateVersionDisplay();
                    if (
                        remote?.version &&
                        remote.version !== localStorage.getItem(LS_LAST_APPLIED)
                    ) {
                        localStorage.removeItem('darkpanel_cache_bust');
                        localStorage.setItem('darkpanel_cache_bust', Date.now());
                    }
                }
            } catch (e) {
                console.warn('❌ Update check error:', e);
            }
        }

        function showUpdatePopup(version, files) {
            const existing = document.querySelector('.custom-alert.update');
            if (existing) existing.remove();

            const popup = document.createElement('div');
            popup.className = 'custom-alert update visible';
            popup.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999`;
            popup.innerHTML = `
                <div class="alert-content" style="background:#151518;border:1px solid #2b2b2b;border-radius:14px;padding:18px 16px;color:#eaeaea;min-width:280px;max-width:360px;">
                    <div class="alert-message" style="font-weight:700">New version found (v${version})</div>
                    <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
                        <button id="updateNow" class="alert-close" style="padding:8px 14px;border:0;border-radius:10px;background:#4a6cff;color:#fff;cursor:pointer">Update</button>
                        <button id="updateLater" class="alert-close" style="padding:8px 14px;border:1px solid #3b3b3b;border-radius:10px;background:#1b1b1f;color:#ddd;cursor:pointer">Later</button>
                    </div>
                </div>
            `;
            document.body.appendChild(popup);

            document.getElementById('updateLater').addEventListener('click', () => popup.remove());

            document.getElementById('updateNow').addEventListener('click', async () => {
                setUpdateStatus('Downloading...');
                try {
                    const ok = await tryWriteToExtension(files);
                    localStorage.setItem(LS_INSTALLED, version);
                    localStorage.setItem(LS_LAST_APPLIED, version);
                    currentVersion = version;
                    updateVersionDisplay();

                    if (ok) {
                        setUpdateStatus('Updated! The panel is restarting...');
                        setTimeout(() => hardReloadExtension(), 1000);
                        return;
                    }
                    await applyRemoteOverlay(files, version);
                    setUpdateStatus('Overlay updated! Reloading UI…');
                    setTimeout(() => {
                        hardReloadUI(version);
                    }, 900);
                } catch (err) {
                    console.error(err);
                    setUpdateStatus('Update error: ' + err.message);
                }
            });

            function setUpdateStatus(msg) {
                popup.querySelector('.alert-message').textContent = msg;
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

        // ------ Overlay: index.html & style.css hot-swap ------
        async function applyRemoteOverlay(files, version) {
            if (files['css/style.css']) {
                hotSwapCss(files['css/style.css'].url, version);
            }
            if (files['index.html']) {
                try {
                    const html = await (
                        await fetch(
                            files['index.html'].url + '?v=' + version + '&t=' + Date.now(),
                            { cache: 'no-store' }
                        )
                    ).text();
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html;
                    const newMain = tmp.querySelector('main');
                    const curMain = document.querySelector('main');
                    if (newMain && curMain) {
                        curMain.innerHTML = newMain.innerHTML;
                        bustAllAssets(curMain, version);
                    }
                    localStorage.setItem(LS_LAST_APPLIED, version);
                    currentVersion = version;
                    updateVersionDisplay();
                    init();
                } catch (e) {
                    console.log('Overlay HTML swap skipped:', e);
                }
            }
        }

        function hotSwapCss(remoteCssUrl, version) {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            let replaced = false;
            links.forEach((lnk) => {
                const href = lnk.getAttribute('href') || '';
                if (href.includes('css/style.css')) {
                    const newHref =
                        remoteCssUrl + `?v=${encodeURIComponent(version)}&t=${Date.now()}`;
                    lnk.href = newHref;
                    replaced = true;
                }
            });
            if (!replaced) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = remoteCssUrl + `?v=${encodeURIComponent(version)}&t=${Date.now()}`;
                document.head.appendChild(link);
            }
        }

        function bustAllAssets(scopeEl, version) {
            const bust = (url) => {
                if (!url) return url;
                const sep = url.includes('?') ? '&' : '?';
                return (
                    url +
                    `${sep}v=${encodeURIComponent(version)}&cb=${localStorage.getItem(
                        'darkpanel_cache_bust'
                    )}`
                );
            };
            scopeEl.querySelectorAll('img').forEach((img) => {
                if (img.src) img.src = bust(img.src);
            });
            scopeEl.querySelectorAll('video').forEach((vid) => {
                const src = vid.getAttribute('src');
                if (src) vid.setAttribute('src', bust(src));
                vid.querySelectorAll('source').forEach((s) => {
                    const ssrc = s.getAttribute('src');
                    if (ssrc) s.setAttribute('src', bust(ssrc));
                });
                try {
                    vid.load();
                } catch (_) {}
            });
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
            const bustUrl = (url) => {
                if (!url) return url;
                const sep = url.includes('?') ? '&' : '?';
                return url + `${sep}v=${encodeURIComponent(version)}&t=${Date.now()}`;
            };
            document.querySelectorAll('link[rel="stylesheet"]').forEach((lnk) => {
                lnk.href = bustUrl(lnk.href);
            });
            bustAllAssets(document, version);
            setTimeout(() => location.reload(true), 300);
        }

        // ---------------------- UI LOGIKA -------------------------
        function init() {
            updatePackUI();
            createPresets();
            setupEventListeners();
            setupGridControl();
            if (status) status.textContent = 'No items selected';
            updateVersionDisplay();
        }

        function updateVersionDisplay() {
            let versionEl = document.getElementById('version-display');
            if (!versionEl) {
                versionEl = document.createElement('div');
                versionEl.id = 'version-display';
                versionEl.style.position = 'absolute';
                versionEl.style.bottom = '10px';
                versionEl.style.right = '10px';
                versionEl.style.color = '#888';
                versionEl.style.fontSize = '12px';
                versionEl.style.opacity = '0.7';
                versionEl.style.pointerEvents = 'none';
                document.body.appendChild(versionEl);
            }
            const shown = localStorage.getItem(LS_LAST_APPLIED) || currentVersion || BUNDLE_VERSION;
            versionEl.textContent = `v${shown}`;
        }

        function updatePackUI() {
            const packBtn = document.querySelector('.pack-btn');
            if (!packBtn) return;
            if (currentPack === 'text') {
                packBtn.textContent = 'Text Pack ▼';
                textPackBtn?.classList.add('active');
                effectPackBtn?.classList.remove('active');
            } else {
                packBtn.textContent = 'Effect Pack ▼';
                effectPackBtn?.classList.add('active');
                textPackBtn?.classList.remove('active');
            }
        }

        function createPresets() {
            if (!presetList) return;
            presetList.innerHTML = '';
            const presetCount = currentPack === 'text' ? 30 : 15;
            const packType = currentPack === 'text' ? 'Text' : 'Effect';

            for (let i = 1; i <= presetCount; i++) {
                const preset = document.createElement('div');
                preset.className = 'preset';
                preset.dataset.file = `${currentPack}_${i}.ffx`;

                const videoSrc = `${GITHUB_RAW}/assets/videos/${currentPack}_${i}.mp4?v=${encodeURIComponent(
                    localStorage.getItem(LS_LAST_APPLIED) || currentVersion
                )}&t=${Date.now()}`;
                preset.innerHTML = `
                    <div class="preset-thumb">
                        <video muted loop playsinline preload="metadata">
                            <source src="${videoSrc}" type="video/mp4" />
                        </video>
                        <input type="checkbox" class="favorite-check" data-file="${currentPack}_${i}.ffx">
                    </div>
                    <div class="preset-name">${packType} ${i}</div>
                `;
                presetList.appendChild(preset);
            }

            presets = document.querySelectorAll('.preset');
            initializeFavorites();
            setupVideoHover();
            setupPresetSelection();
            showPage(1);
        }

        function setupVideoHover() {
            presets.forEach((preset) => {
                const video = preset.querySelector('video');
                preset.addEventListener('mouseenter', () => {
                    if (!autoPlayCheckbox?.checked) {
                        try {
                            video.currentTime = 0;
                            video.play().catch(() => {});
                        } catch (_) {}
                    }
                });
                preset.addEventListener('mouseleave', () => {
                    if (!autoPlayCheckbox?.checked) {
                        try {
                            video.pause();
                            video.currentTime = 0;
                        } catch (_) {}
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

        function showPage(page) {
            const filtered = filterPresets();
            currentPage = page;
            totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
            presets.forEach((p) => (p.style.display = 'none'));
            filtered
                .slice((page - 1) * itemsPerPage, page * itemsPerPage)
                .forEach((p) => (p.style.display = 'block'));
            if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
            if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
            manageVideos();
        }

        function manageVideos() {
            const filtered = filterPresets().slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage
            );
            filtered.forEach((p) => {
                const v = p.querySelector('video');
                if (!v) return;
                if (autoPlayCheckbox?.checked) {
                    try {
                        v.play().catch(() => {});
                    } catch (_) {}
                } else {
                    try {
                        v.pause();
                    } catch (_) {}
                }
            });
        }

        function filterPresets() {
            return Array.from(presets).filter(
                (preset) => currentView === 'all' || favorites.includes(preset.dataset.file)
            );
        }

        function setupPresetSelection() {
            presets.forEach((preset) => {
                preset.addEventListener('click', (e) => {
                    if (e.target.classList.contains('favorite-check')) return;
                    presets.forEach((p) => p.classList.remove('selected'));
                    preset.classList.add('selected');
                    selectedPreset = preset.dataset.file;
                    if (status)
                        status.textContent = `Selected: ${
                            preset.querySelector('.preset-name').textContent
                        }`;
                });
            });
        }

        function setupGridControl() {
            const gridButtons = document.querySelectorAll('.grid-btn');
            const presetsContainer = document.querySelector('.presets');
            if (!presetsContainer) return;

            let savedCols = parseInt(localStorage.getItem('gridCols') || '2', 10);
            applyGrid(savedCols);

            gridButtons.forEach((btn) => {
                if (parseInt(btn.dataset.cols, 10) === savedCols) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    gridButtons.forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                    const cols = parseInt(btn.dataset.cols, 10);
                    localStorage.setItem('gridCols', String(cols));
                    applyGrid(cols);
                });
            });

            function applyGrid(cols) {
                presetsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            }

            window.addEventListener('resize', () => {
                if (window.innerWidth <= 420) {
                    presetsContainer.style.gridTemplateColumns = 'repeat(1, 1fr)';
                } else if (window.innerWidth <= 640) {
                    presetsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
                } else {
                    const cols = parseInt(localStorage.getItem('gridCols') || '2', 10);
                    presetsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                }
            });
        }

        async function applyPreset() {
            if (!selectedPreset) {
                showCustomAlert('Choose a preset first!', false);
                return;
            }

            const remotePresetUrl = `${GITHUB_RAW}/presets/${selectedPreset}`;
            try {
                const res = await fetch(remotePresetUrl, { cache: 'no-store' });
                if (!res.ok) throw new Error('Preset not found on GitHub');
                const blob = await res.blob();
                const base64 = await blobToBase64(blob);

                const chunkSize = 20000; // safe for evalScript payload
                const chunks = [];
                for (let i = 0; i < base64.length; i += chunkSize) {
                    chunks.push(base64.slice(i, i + chunkSize));
                }

                // 1) Create temp file once
                const openScript = `
                    (function() {
                        try {
                            var presetPath = Folder.temp.fsName + "/darkpanel_temp.ffx";
                            var f = new File(presetPath);
                            f.encoding = "BINARY";
                            if (!f.open("w")) return "Error: Cannot open file for writing";
                            f.close();
                            return presetPath;
                        } catch(e) { return "Error: " + e; }
                    })();
                `;
                const openResult = await new Promise((resolve) =>
                    csInterface
                        ? csInterface.evalScript(openScript, resolve)
                        : resolve('Error: CSInterface not available')
                );
                if (typeof openResult !== 'string' || openResult.indexOf('Error:') === 0) {
                    showCustomAlert(openResult || 'Error: Failed to create temp file', false);
                    return;
                }
                const presetPath = openResult;
                const escapedPresetPath = presetPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

                // 2) Append all chunks
                for (const chunk of chunks) {
                    const appendScript = `
                        (function() {
                            function b64decode(b64) {
                                var chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                                var out="", buffer=0, bits=0, c;
                                for (var i=0;i<b64.length;i++){
                                    c=b64.charAt(i);
                                    if(c==='=')break;
                                    var idx=chars.indexOf(c);
                                    if(idx===-1)continue;
                                    buffer=(buffer<<6)|idx; bits+=6;
                                    if(bits>=8){bits-=8;out+=String.fromCharCode((buffer>>bits)&0xFF);}
                                }
                                return out;
                            }
                            try {
                                var f = new File("${escapedPresetPath}");
                                f.encoding = "BINARY";
                                if (!f.open("a")) return "Error: Cannot open file for append";
                                var bin = b64decode("${chunk}");
                                f.write(bin);
                                f.close();
                                return "OK";
                            } catch(e) { return "Error: " + e; }
                        })();
                    `;
                    const appendResult = await new Promise((resolve) =>
                        csInterface
                            ? csInterface.evalScript(appendScript, resolve)
                            : resolve('Error: CSInterface not available')
                    );
                    if (appendResult !== 'OK') {
                        showCustomAlert(appendResult || 'Error: write failed', false);
                        return;
                    }
                }

                // 3) Apply preset to selected layers
                const applyScript = `
                    (function() {
                        try {
                            var f = new File("${escapedPresetPath}");
                            if (!f.exists) return "Error: File not found";
                            var activeItem = app.project.activeItem;
                            if (!activeItem || !(activeItem instanceof CompItem)) return "Error: No active composition";
                            var selectedLayers = activeItem.selectedLayers;
                            if (selectedLayers.length === 0) return "Error: Please select at least one layer";
                            var successCount = 0;
                            for (var i = 0; i < selectedLayers.length; i++) {
                                selectedLayers[i].applyPreset(f);
                                successCount++;
                            }
                            try { f.remove(); } catch(_) {}
                            return "Success:" + successCount;
                        } catch(err) { return "Error: " + err.toString(); }
                    })();
                `;
                if (!csInterface) {
                    showCustomAlert('CSInterface not available (browser preview).', false);
                    return;
                }
                csInterface.evalScript(applyScript, (result) => {
                    if (result && result.indexOf('Success:') === 0) {
                        showCustomAlert(' ' + result.split(':')[1] + ' Applied to layer', true);
                    } else {
                        showCustomAlert(result || 'Unknown error', false);
                    }
                });
            } catch (err) {
                showCustomAlert('Error loading: ' + err.message, false);
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

        function showCustomAlert(message, isSuccess) {
            const existing = document.querySelector('.custom-alert:not(.update)');
            if (existing) existing.remove();
            const videoPath = isSuccess
                ? `${GITHUB_RAW}/assets/videos/gojo.mp4?v=${encodeURIComponent(
                      localStorage.getItem(LS_LAST_APPLIED) || currentVersion
                  )}`
                : `${GITHUB_RAW}/assets/videos/social.mp4?v=${encodeURIComponent(
                      localStorage.getItem(LS_LAST_APPLIED) || currentVersion
                  )}`;
            const alertBox = document.createElement('div');
            alertBox.className = 'custom-alert';
            alertBox.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99998`;
            alertBox.innerHTML = `
                <div class="alert-content" style="background:#141416;border:1px solid #2b2b2b;border-radius:14px;padding:16px 14px;color:#eaeaea;min-width:260px;max-width:360px;">
                    <div class="alert-icon" style="margin-bottom:8px">
                        <video autoplay muted loop playsinline class="alert-video" style="width:100%;border-radius:10px;display:block">
                            <source src="${videoPath}&t=${Date.now()}" type="video/mp4" />
                        </video>
                    </div>
                    <div class="alert-message" style="font-weight:600;margin-bottom:10px">${message}</div>
                    <button class="alert-close" style="padding:8px 14px;border:0;border-radius:10px;background:#4a6cff;color:#fff;cursor:pointer;width:100%">OK</button>
                </div>`;
            document.body.appendChild(alertBox);
            requestAnimationFrame(() => alertBox.classList.add('visible'));
            alertBox.querySelector('.alert-close').onclick = () => {
                alertBox.classList.remove('visible');
                setTimeout(() => alertBox.remove(), 280);
            };
        }

        function setupEventListeners() {
            autoPlayCheckbox?.addEventListener('change', manageVideos);
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
        }

        function switchPack(type) {
            if (currentPack === type) return;
            document.querySelectorAll('.preset video').forEach((v) => {
                try {
                    v.pause();
                    v.currentTime = 0;
                } catch (_) {}
            });
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
    }
});
