document.addEventListener('DOMContentLoaded', function () {
    const csInterface = new CSInterface();

    // ----------------------- UPDATE CONFIG -----------------------
    const REMOTE_BASE = 'https://darkpanel-coral.vercel.app';
    const UPDATE_URL = REMOTE_BASE + '/update.json';
    const BUNDLE_VERSION = '1.4'; // CSXS/manifest.xml dagisi bilan mos
    const LS_INSTALLED = 'darkpanel_installed_version'; // localStorage kalit
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
    safeCheckForUpdates(); // sahifa ochilganda tekshir
    // ---------------------------------------------------

    // ===================== UPDATE SYSTEM =====================
    async function safeCheckForUpdates() {
        try {
            const res = await fetch(UPDATE_URL + '?t=' + Date.now());
            if (!res.ok) throw new Error('update.json not found');
            const remote = await res.json();

            const installed = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

            // Agar remote versiya KATTA bo'lsa (yoki boshqa) — prompt chiqsin
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

        document.getElementById('updateLater').addEventListener('click', () => {
            popup.remove();
        });

        document.getElementById('updateNow').addEventListener('click', async () => {
            setUpdateStatus('⏳ Downloading & applying…');
            try {
                // 1) Avval extension papkaga yozishga urinib ko'ramiz
                const ok = await tryWriteToExtension(files);
                if (ok) {
                    // muvaffaqiyat — versiyani saqlaymiz, va qayta yuklaymiz
                    localStorage.setItem(LS_INSTALLED, version);
                    setUpdateStatus('✅ Update complete. Reloading…');
                    setTimeout(() => location.reload(), 900);
                    return;
                }

                // 2) Agar yozish ruxsati bo'lmasa — remote overlay rejimi
                await applyRemoteOverlay(files);
                localStorage.setItem(LS_INSTALLED, version);
                setUpdateStatus('✅ Update applied (overlay). Please restart AE.');
            } catch (err) {
                console.error(err);
                setUpdateStatus('❌ Update failed: ' + err.message);
            }
        });

        function setUpdateStatus(msg) {
            popup.querySelector('.alert-message').textContent = msg;
        }
    }

    async function tryWriteToExtension(files) {
        // Faqat matnli fayllarni yozamiz (bizning ro'yxat)
        // muvaffaqiyat bo'lsa true qaytadi
        const extRoot = csInterface.getSystemPath(SystemPath.EXTENSION);

        const ensureFoldersScript = (fullPath) => `
            (function() {
                function ensureFolder(path) {
                    var parts = path.split(/[\\\/]/);
                    var acc = parts.shift(); // c: yoki birinchi bo'lak
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
            if (!SUPPORTED_TEXT_FILES.includes(rel)) continue; // faqat shu fayllar
            const url = info.url + '?t=' + Date.now();

            const text = await (await fetch(url)).text();

            // papkani yaratish (agar mavjud bo'lmasa)
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

            // Faylni yozish (bo'laklarga bo'lib, chunki evalScript uzunlik limiti bor)
            const targetFile = `${extRoot}/${rel}`;
            const wrote = await writeFileInChunks(targetFile, text);
            if (!wrote) return false; // bitta ham yozilmasa — demak ruxsat yo‘q
        }
        return true;
    }

    async function writeFileInChunks(targetFile, text) {
        const chunkSize = 30000; // Xavfsiz chegara, evalScript ~65k limitidan pastroq
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }

        let mode = 'w'; // Birinchi bo'lak uchun yozish (truncate)
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
            mode = 'a'; // Keyingi bo'laklar uchun qo'shish (append)
        }
        return true;
    }

    async function applyRemoteOverlay(files) {
        // Yozish bo'lmasa: CSS/HTML’ni serverdan yuklab ichida qo‘llaymiz
        // 1) CSS’ni hot-swap
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

        // 2) index.html ichidagi <main>ni yangilash (agar bor bo'lsa)
        if (files['index.html']) {
            try {
                const html = await (
                    await fetch(files['index.html'].url + '?t=' + Date.now())
                ).text();
                // faqat <main> kontentini almashtiramiz
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const newMain = tmp.querySelector('main');
                const curMain = document.querySelector('main');
                if (newMain && curMain) curMain.innerHTML = newMain.innerHTML;
            } catch (e) {
                console.log('Overlay HTML swap skipped:', e);
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

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 420) {
                presetsContainer.style.gridTemplateColumns = 'repeat(1, 1fr)';
            } else if (window.innerWidth <= 640) {
                presetsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            } else {
                const cols = parseInt(localStorage.getItem('gridCols')) || 2;
                presetsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            }
        });
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
    // -------------------- END UI LOGIKA --------------------
});
