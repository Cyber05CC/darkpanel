document.addEventListener('DOMContentLoaded', function () {
    const csInterface = new CSInterface();

    // ----------------------- UPDATE CONFIG -----------------------
    const REMOTE_BASE = 'https://darkpanel-coral.vercel.app';
    const UPDATE_URL = REMOTE_BASE + '/update.json';
    const BUNDLE_VERSION = '1.3';
    const LS_INSTALLED = 'darkpanel_installed_version';
    const SUPPORTED_TEXT_FILES = ['index.html', 'css/style.css', 'js/main.js', 'CSXS/manifest.xml'];
    // -------------------------------------------------------------

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

    // ----------------------- BOOT -----------------------
    init();
    safeCheckForUpdates();
    // ---------------------------------------------------

    // ===================== UPDATE SYSTEM =====================
    async function safeCheckForUpdates() {
        try {
            const res = await fetch(UPDATE_URL + '?t=' + Date.now());
            if (!res.ok) throw new Error('update.json not found');
            const remote = await res.json();
            const installed = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

            if (remote?.version && remote.version !== installed) {
                showUpdatePopup(remote.version, remote.files);
            } else {
                console.log('✅ Up to date:', installed);
            }
        } catch (e) {
            console.log('Update check skipped:', e);
        }
    }

    function showUpdatePopup(version, files) {
        const existing = document.querySelector('.custom-alert.update');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'custom-alert update visible';
        popup.innerHTML = `
            <div class="alert-content">
                <div class="alert-message">🆕 New update available (v${version})</div>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:8px">
                    <button id="updateNow" class="alert-close">Update Now</button>
                    <button id="updateLater" class="alert-close" style="background:#3b3b3b">Later</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('updateLater').addEventListener('click', () => popup.remove());

        document.getElementById('updateNow').addEventListener('click', async () => {
            setStatus('⏳ Downloading & applying…');
            try {
                const ok = await tryWriteToExtension(files);
                if (ok) {
                    localStorage.setItem(LS_INSTALLED, version);
                    setStatus('✅ Update complete. Reloading…');
                    setTimeout(() => location.reload(), 1000);
                    return;
                }

                await applyRemoteOverlay(files);
                localStorage.setItem(LS_INSTALLED, version);
                setStatus('✅ Update applied (overlay). Restart AE to fully apply.');
            } catch (err) {
                console.error(err);
                setStatus('❌ Update failed: ' + err.message);
            }
        });

        function setStatus(msg) {
            popup.querySelector('.alert-message').textContent = msg;
        }
    }

    async function tryWriteToExtension(files) {
        const extRoot = csInterface.getSystemPath(SystemPath.EXTENSION);

        // JSON.stringify qilingan textni JSX uchun xavfsiz qiladi
        function escapeJSX(text) {
            return text
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '\\"')
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n');
        }

        const ensureFoldersScript = (fullPath) => `
            (function(){
                function ensureFolder(path){
                    var parts = path.split(/[\\\\/]/);
                    var acc = parts.shift();
                    while(parts.length){
                        acc += "/" + parts.shift();
                        var f = new Folder(acc);
                        if(!f.exists){ try{ f.create(); }catch(e){ return "ERR:"+e; } }
                    }
                    return "OK";
                }
                return ensureFolder("${fullPath.replace(/"/g, '\\"')}");
            })();
        `;

        for (const [rel, info] of Object.entries(files || {})) {
            if (!SUPPORTED_TEXT_FILES.includes(rel)) continue;
            const url = info.url + '?t=' + Date.now();
            const text = await (await fetch(url)).text();
            const safeText = escapeJSX(text);

            const dir = rel.split('/').slice(0, -1).join('/');
            if (dir) {
                const targetDir = `${extRoot}/${dir}`;
                const ok = await new Promise((resolve) => {
                    csInterface.evalScript(ensureFoldersScript(targetDir), (res) =>
                        resolve(res === 'OK')
                    );
                });
                if (!ok) return false;
            }

            const targetFile = `${extRoot}/${rel}`;
            const writeScript = `
                (function(){
                    try{
                        var f = new File("${targetFile.replace(/"/g, '\\"')}");
                        f.encoding = "UTF-8";
                        f.open("w");
                        f.write("${safeText}");
                        f.close();
                        return "OK";
                    }catch(e){ return "ERR:"+e.toString(); }
                })();
            `;
            const wrote = await new Promise((resolve) => {
                csInterface.evalScript(writeScript, (res) => resolve(res === 'OK'));
            });
            if (!wrote) return false;
        }
        return true;
    }

    async function applyRemoteOverlay(files) {
        // CSS yangilanishi
        if (files['css/style.css']) {
            const id = 'overlay-style';
            let link = document.getElementById(id);
            if (!link) {
                link = document.createElement('link');
                link.rel = 'stylesheet';
                link.id = id;
                document.head.appendChild(link);
            }
            link.href = files['css/style.css'].url + '?t=' + Date.now();
        }

        // HTML (UI) yangilanishi — endi to‘liq sahifani hot-reload qiladi
        if (files['index.html']) {
            try {
                const html = await (
                    await fetch(files['index.html'].url + '?t=' + Date.now())
                ).text();
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(html, 'text/html');

                const newMain = newDoc.querySelector('main');
                const curMain = document.querySelector('main');
                if (newMain && curMain) {
                    curMain.innerHTML = newMain.innerHTML;
                    console.log('✅ UI updated (overlay)');
                }

                // yangi JS-ni ham hot-reload
                if (files['js/main.js']) {
                    const script = document.createElement('script');
                    script.src = files['js/main.js'].url + '?t=' + Date.now();
                    document.body.appendChild(script);
                }
            } catch (e) {
                console.warn('Overlay HTML swap skipped:', e);
            }
        }
    }
    // =================== END UPDATE SYSTEM ===================

    // ---------------------- UI LOGIKA -------------------------
    function init() {
        updatePackUI();
        createPresets();
        setupEventListeners();
        setupPresetSelection();
        setupGridControl();
        if (status) status.textContent = 'No items selected';
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
            preset.innerHTML = `
                <div class="preset-thumb">
                    <video muted loop playsinline>
                        <source src="./assets/videos/${currentPack}_${i}.mp4?t=${Date.now()}" type="video/mp4" />
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
        const filteredPresets = filterPresets();
        currentPage = page;
        totalPages = Math.ceil(filteredPresets.length / itemsPerPage) || 1;
        presets.forEach((p) => (p.style.display = 'none'));
        filteredPresets
            .slice((page - 1) * itemsPerPage, page * itemsPerPage)
            .forEach((p) => (p.style.display = 'block'));
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        manageVideos();
    }

    function manageVideos() {
        const filtered = filterPresets();
        const current = filtered.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );
        current.forEach((p) => {
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
                if (status) {
                    status.textContent = `Selected: ${
                        preset.querySelector('.preset-name').textContent
                    }`;
                }
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
            presetsContainer.dataset.cols = cols;
        }
    }

    function switchPack(packType) {
        if (currentPack === packType) return;
        document.querySelectorAll('.preset video').forEach((v) => {
            v.pause();
            v.currentTime = 0;
        });
        currentPack = packType;
        localStorage.setItem('currentPack', packType);
        selectedPreset = null;
        if (status) status.textContent = 'No items selected';
        updatePackUI();
        createPresets();
    }

    function switchTab(tabType) {
        if (currentView === tabType) return;
        currentView = tabType;
        allTab?.classList.toggle('active', tabType === 'all');
        favoritesTab?.classList.toggle('active', tabType === 'favorites');
        selectedPreset = null;
        if (status) status.textContent = 'No items selected';
        showPage(1);
    }

    function applyPreset() {
        if (!selectedPreset) {
            showCustomAlert('Please select a preset first!', false);
            return;
        }

        const isTextPreset = selectedPreset.startsWith('text_');
        const script = `
            (function() {
                try {
                    var presetPath = '${csInterface.getSystemPath(
                        SystemPath.EXTENSION
                    )}/presets/${selectedPreset}';
                    var presetFile = new File(presetPath);
                    if (!presetFile.exists) return "Error: Preset file not found";
                    var activeItem = app.project.activeItem;
                    if (!activeItem || !(activeItem instanceof CompItem)) return "Error: No active composition";
                    var selectedLayers = activeItem.selectedLayers;
                    if (selectedLayers.length === 0) return "Error: Please select at least one layer";

                    var successCount = 0;
                    for (var i = 0; i < selectedLayers.length; i++) {
                        var layer = selectedLayers[i];
                        ${
                            isTextPreset
                                ? `if (!(layer instanceof TextLayer)) continue;`
                                : `if (!layer.property("ADBE Effect Parade")) continue;`
                        }
                        layer.applyPreset(presetFile);
                        successCount++;
                    }
                    return "Success:" + successCount;
                } catch(err) { return "Error: " + err.toString(); }
            })();
        `;

        csInterface.evalScript(script, function (result) {
            if (result.startsWith('Success:')) {
                showCustomAlert('Applied to ' + result.split(':')[1] + ' layer(s)', true);
            } else {
                showCustomAlert(result, false);
            }
        });
    }

    function showCustomAlert(message, isSuccess) {
        const existing = document.querySelector('.custom-alert:not(.update)');
        if (existing) existing.remove();
        const videoPath = isSuccess ? './assets/videos/gojo.mp4' : './assets/videos/social.mp4';
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
            </div>
        `;
        document.body.appendChild(alertBox);
        setTimeout(() => alertBox.classList.add('visible'), 10);
        alertBox.querySelector('.alert-close').addEventListener('click', () => {
            alertBox.classList.remove('visible');
            setTimeout(() => alertBox.remove(), 300);
        });
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
            if (status) status.textContent = 'No items selected';
            showPage(1);
        });
        applyBtn?.addEventListener('click', applyPreset);
        allTab?.addEventListener('click', () => switchTab('all'));
        favoritesTab?.addEventListener('click', () => switchTab('favorites'));
        textPackBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            switchPack('text');
            document.querySelector('.pack-dropdown-content')?.classList.remove('show');
        });
        effectPackBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            switchPack('effect');
            document.querySelector('.pack-dropdown-content')?.classList.remove('show');
        });
        document.querySelector('.pack-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelector('.pack-dropdown-content')?.classList.toggle('show');
        });
        window.addEventListener('click', () =>
            document.querySelector('.pack-dropdown-content')?.classList.remove('show')
        );
    }
});
