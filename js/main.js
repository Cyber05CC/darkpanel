document.addEventListener('DOMContentLoaded', function () {
    const csInterface = new CSInterface();

    // ----------------------- CONFIG -----------------------
    const GITHUB_RAW = 'https://raw.githubusercontent.com/Cyber05CC/darkpanel/main';
    const VERCEL_BASE = 'https://darkpanel-coral.vercel.app';
    const UPDATE_URL = VERCEL_BASE + '/update.json';
    const BUNDLE_VERSION = '1.0';
    const LS_INSTALLED = 'darkpanel_installed_version';
    const SUPPORTED_TEXT_FILES = ['index.html', 'css/style.css', 'js/main.js', 'CSXS/manifest.xml'];
    // -------------------------------------------------------

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

    const itemsPerPage = 10;
    let currentPage = 1;
    let totalPages = 1;
    let currentView = 'all';
    let currentPack = localStorage.getItem('currentPack') || 'text';
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    let presets = [];
    let currentVersion = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

    // -------------------- STARTUP --------------------
    setupConnectionWatcher();
    init();
    safeCheckForUpdates();
    // -------------------------------------------------

    // ===================== INTERNET WATCHER =====================
    function setupConnectionWatcher() {
        function showConnectionAlert(message, type = 'error') {
            const existing = document.querySelector('.net-alert');
            if (existing) existing.remove();

            const alert = document.createElement('div');
            alert.className = `net-alert ${type}`;
            alert.innerHTML = `
                <div class="net-alert-content">
                    ${type === 'error' ? '📡' : '🌐'} ${message}
                </div>
            `;
            document.body.appendChild(alert);
            setTimeout(() => alert.classList.add('visible'), 10);
            if (type === 'success') {
                setTimeout(() => {
                    alert.classList.remove('visible');
                    setTimeout(() => alert.remove(), 400);
                }, 2000);
            }
        }

        window.addEventListener('offline', () => {
            showConnectionAlert('Internet uzildi.', 'error');
        });

        window.addEventListener('online', () => {
            showConnectionAlert('Internet tiklandi, sahifa yangilanmoqda...', 'success');
            setTimeout(() => location.reload(true), 1500);
        });

        if (!navigator.onLine) {
            showConnectionAlert('Internet ulanmagan.', 'error');
        }
    }
    // =============================================================

    // ===================== UPDATE SYSTEM =====================
    async function safeCheckForUpdates() {
        try {
            const res = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) throw new Error('update.json not found');
            const remote = await res.json();

            const installed = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

            if (remote?.version && remote.version !== installed) {
                showUpdatePopup(remote.version, remote.files);
            } else {
                console.log('✅ Up to date:', installed);
                updateVersionDisplay();
            }
        } catch (e) {
            console.warn('❌ Update check xatosi:', e);
        }
    }

    function showUpdatePopup(version, files) {
        const existing = document.querySelector('.custom-alert.update');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'custom-alert update visible';
        popup.innerHTML = `
            <div class="alert-content">
                <div class="alert-message">🆕 Yangi versiya topildi (v${version})</div>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:8px">
                    <button id="updateNow" class="alert-close">Yangilash</button>
                    <button id="updateLater" class="alert-close" style="background:#3b3b3b">Keyinroq</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('updateLater').addEventListener('click', () => popup.remove());

        document.getElementById('updateNow').addEventListener('click', async () => {
            setUpdateStatus('⏳ Yuklanmoqda...');
            try {
                clearOldCache();
                const ok = await tryWriteToExtension(files);
                localStorage.setItem(LS_INSTALLED, version);
                currentVersion = version;
                if (ok) {
                    setUpdateStatus('✅ Yangilandi! Qayta yuklanmoqda...');
                    setTimeout(() => location.reload(true), 1000);
                } else {
                    await applyRemoteOverlay(files);
                    setUpdateStatus('✅ Overlay yangilandi, sahifa qayta yuklanmoqda...');
                    setTimeout(() => location.reload(true), 1000);
                }
            } catch (err) {
                setUpdateStatus('❌ Xatolik: ' + err.message);
            }
        });

        function setUpdateStatus(msg) {
            popup.querySelector('.alert-message').textContent = msg;
        }
    }

    function clearOldCache() {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('darkpanel') || key.startsWith('favorites')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🧹 LocalStorage tozalandi');
    }

    async function tryWriteToExtension(files) {
        const extRoot = csInterface.getSystemPath(SystemPath.EXTENSION);

        for (const [rel, info] of Object.entries(files || {})) {
            if (!SUPPORTED_TEXT_FILES.includes(rel)) continue;
            const url = info.url + '?t=' + Date.now();
            const text = await (await fetch(url, { cache: 'no-store' })).text();

            const targetFile = `${extRoot}/${rel}`;
            const wrote = await writeFileInChunks(targetFile, text);
            if (!wrote) return false;
        }
        return true;
    }

    async function writeFileInChunks(targetFile, text) {
        const chunkSize = 30000;
        for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.substring(i, i + chunkSize);
            const mode = i === 0 ? 'w' : 'a';
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
            const result = await new Promise((resolve) =>
                csInterface.evalScript(writeChunkScript, (res) => resolve(res === 'OK'))
            );
            if (!result) return false;
        }
        return true;
    }

    async function applyRemoteOverlay(files) {
        // CSS
        if (files['css/style.css']) {
            const link =
                document.querySelector('link[rel="stylesheet"]') || document.createElement('link');
            link.rel = 'stylesheet';
            link.href = files['css/style.css'].url + '?t=' + Date.now();
            document.head.appendChild(link);
        }

        // HTML
        if (files['index.html']) {
            try {
                const html = await (
                    await fetch(files['index.html'].url + '?t=' + Date.now())
                ).text();
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const newMain = tmp.querySelector('main');
                const curMain = document.querySelector('main');
                if (newMain && curMain) {
                    curMain.innerHTML = newMain.innerHTML;
                    console.log('🔄 UI yangilandi (overlay)');
                    init();
                }
            } catch (e) {
                console.log('⚠️ Overlay HTML yangilashda xato:', e);
            }
        }
    }
    // ==========================================================

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
            document.body.appendChild(versionEl);
        }
        versionEl.textContent = `v${currentVersion}`;
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

            const videoSrc = `${GITHUB_RAW}/assets/videos/${currentPack}_${i}.mp4?t=${Date.now()}`;
            preset.innerHTML = `
                <div class="preset-thumb">
                    <video muted loop playsinline>
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
                    video.currentTime = 0;
                    video.play().catch(() => {});
                }
            });
            preset.addEventListener('mouseleave', () => {
                if (!autoPlayCheckbox?.checked) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        });
    }

    function initializeFavorites() {
        presets.forEach((preset) => {
            const file = preset.dataset.file;
            const checkbox = preset.querySelector('.favorite-check');
            checkbox.checked = favorites.includes(file);
            checkbox.addEventListener('change', () => toggleFavorite(file, checkbox.checked));
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
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
        manageVideos();
    }

    function manageVideos() {
        const filtered = filterPresets().slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );
        filtered.forEach((p) => {
            const v = p.querySelector('video');
            if (autoPlayCheckbox?.checked) v.play().catch(() => {});
            else v.pause();
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

        let savedCols = parseInt(localStorage.getItem('gridCols')) || 2;
        applyGrid(savedCols);

        gridButtons.forEach((btn) => {
            if (parseInt(btn.dataset.cols) === savedCols) btn.classList.add('active');
            btn.addEventListener('click', () => {
                gridButtons.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const cols = parseInt(btn.dataset.cols);
                localStorage.setItem('gridCols', cols);
                applyGrid(cols);
            });
        });

        function applyGrid(cols) {
            presetsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        }
    }

    async function applyPreset() {
        if (!selectedPreset) {
            showCustomAlert('Please select a preset first!', false);
            return;
        }

        const remotePresetUrl = `${GITHUB_RAW}/presets/${selectedPreset}`;
        try {
            const res = await fetch(remotePresetUrl);
            if (!res.ok) throw new Error('Preset not found on GitHub');
            const blob = await res.blob();
            const base64 = await blobToBase64(blob);
            const chunkSize = 20000;
            const chunks = [];
            for (let i = 0; i < base64.length; i += chunkSize) {
                chunks.push(base64.slice(i, i + chunkSize));
            }

            // Open file
            const openScript = `
                (function() {
                    try {
                        var presetPath = Folder.temp.fsName + "\\\\temp.ffx";
                        var f = new File(presetPath);
                        f.encoding = "BINARY";
                        if (!f.open("w")) return "Error: Cannot open file for writing";
                        f.close();
                        return presetPath;
                    } catch(e) { return "Error: " + e; }
                })();
            `;
            const openResult = await new Promise((resolve) => {
                csInterface.evalScript(openScript, resolve);
            });
            if (openResult.startsWith('Error:')) {
                showCustomAlert(openResult, false);
                return;
            }
            const presetPath = openResult;

            // Append chunks
            for (const chunk of chunks) {
                const appendScript = `
                    (function() {
                        function b64decode(b64) {
                            var chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                            var out="", buffer=0, bits=0, c;
                            for (var i=0;i<b64.length;i++){c=b64.charAt(i);
                                if(c==='=')break;
                                var idx=chars.indexOf(c);
                                if(idx===-1)continue;
                                buffer=(buffer<<6)|idx; bits+=6;
                                if(bits>=8){bits-=8;out+=String.fromCharCode((buffer>>bits)&0xFF);}
                            } return out;
                        }
                        try {
                            var f = new File("${presetPath.replace(/\\/g, '\\\\')}");
                            f.encoding = "BINARY";
                            if (!f.open("a")) return "Error: Cannot open file for append";
                            var bin = b64decode('${chunk}');
                            f.write(bin);
                            f.close();
                            return "OK";
                        } catch(e) { return "Error: " + e; }
                    })();
                `;
                const appendResult = await new Promise((resolve) => {
                    csInterface.evalScript(appendScript, resolve);
                });
                if (appendResult !== 'OK') {
                    showCustomAlert(appendResult, false);
                    return;
                }
            }

            // Apply preset
            const applyScript = `
                (function() {
                    try {
                        var f = new File("${presetPath.replace(/\\/g, '\\\\')}");
                        if (!f.exists) return "Error: File not found";
                        var activeItem = app.project.activeItem;
                        if (!activeItem || !(activeItem instanceof CompItem)) return "Error: No active composition";
                        var selectedLayers = activeItem.selectedLayers;
                        if (selectedLayers.length === 0) return "Error: Please select at least one layer";
                        var successCount = 0;
                        for (var i = 0; i < selectedLayers.length; i++) {
                            var layer = selectedLayers[i];
                            layer.applyPreset(f);
                            successCount++;
                        }
                        f.remove();
                        return "Success:" + successCount;
                    } catch(err) { return "Error: " + err.toString(); }
                })();
            `;
            csInterface.evalScript(applyScript, (result) => {
                if (result.startsWith('Success:')) {
                    showCustomAlert('Applied to ' + result.split(':')[1] + ' layer(s)', true);
                } else {
                    showCustomAlert(result, false);
                }
            });
        } catch (err) {
            showCustomAlert('❌ Failed: ' + err.message, false);
        }
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function showCustomAlert(message, isSuccess) {
        const existing = document.querySelector('.custom-alert:not(.update)');
        if (existing) existing.remove();
        const videoPath = isSuccess
            ? `${GITHUB_RAW}/assets/videos/gojo.mp4`
            : `${GITHUB_RAW}/assets/videos/social.mp4`;
        const alertBox = document.createElement('div');
        alertBox.className = 'custom-alert';
        alertBox.innerHTML = `
            <div class="alert-content">
                <div class="alert-icon">
                    <video autoplay muted loop playsinline class="alert-video">
                        <source src="${videoPath}" type="video/mp4" />
                    </video>
                </div>
                <div class="alert-message">${message}</div>
                <button class="alert-close">OK</button>
            </div>`;
        document.body.appendChild(alertBox);
        setTimeout(() => alertBox.classList.add('visible'), 10);
        alertBox.querySelector('.alert-close').onclick = () => {
            alertBox.classList.remove('visible');
            setTimeout(() => alertBox.remove(), 300);
        };
    }

    function setupEventListeners() {
        autoPlayCheckbox?.addEventListener('change', manageVideos);
        prevPageBtn?.addEventListener('click', () => currentPage > 1 && showPage(currentPage - 1));
        nextPageBtn?.addEventListener(
            'click',
            () => currentPage < totalPages && showPage(currentPage + 1)
        );
        refreshBtn?.addEventListener('click', () => {
            selectedPreset = null;
            presets.forEach((p) => p.classList.remove('selected'));
            status.textContent = 'No items selected';
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
        currentPack = type;
        localStorage.setItem('currentPack', type);
        updatePackUI();
        createPresets();
    }

    function switchTab(type) {
        currentView = type;
        allTab.classList.toggle('active', type === 'all');
        favoritesTab.classList.toggle('active', type === 'favorites');
        showPage(1);
    }
});
