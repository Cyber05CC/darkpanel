document.addEventListener('DOMContentLoaded', function () {
    const csInterface = new CSInterface();
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

    // 🔹 INIT
    function init() {
        updatePackUI();
        createPresets();
        setupEventListeners();
        setupPresetSelection();
        setupGridControl();
        status.textContent = 'No items selected';
        checkForSmartUpdates(); // 🆕 Avtomatik update tekshiruvi
    }

    // 🔹 PACK UI
    function updatePackUI() {
        const packBtn = document.querySelector('.pack-btn');
        if (currentPack === 'text') {
            packBtn.textContent = 'Text Pack ▼';
            textPackBtn.classList.add('active');
            effectPackBtn.classList.remove('active');
        } else {
            packBtn.textContent = 'Effect Pack ▼';
            effectPackBtn.classList.add('active');
            textPackBtn.classList.remove('active');
        }
    }

    // 🔹 PRESETS
    function createPresets() {
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

    // 🔹 VIDEO HOVER
    function setupVideoHover() {
        presets.forEach((preset) => {
            const video = preset.querySelector('video');
            preset.addEventListener('mouseenter', () => {
                if (!autoPlayCheckbox.checked) {
                    video.currentTime = 0;
                    video.play().catch(() => {});
                }
            });
            preset.addEventListener('mouseleave', () => {
                if (!autoPlayCheckbox.checked) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        });
    }

    // 🔹 FAVORITES
    function initializeFavorites() {
        presets.forEach((preset) => {
            const file = preset.dataset.file;
            const checkbox = preset.querySelector('.favorite-check');
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

    // 🔹 PAGINATION
    function showPage(page) {
        const filteredPresets = filterPresets();
        currentPage = page;
        totalPages = Math.ceil(filteredPresets.length / itemsPerPage) || 1;
        presets.forEach((p) => (p.style.display = 'none'));
        filteredPresets
            .slice((page - 1) * itemsPerPage, page * itemsPerPage)
            .forEach((p) => (p.style.display = 'block'));
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
        manageVideos();
    }

    // 🔹 VIDEO CONTROL
    function manageVideos() {
        const filtered = filterPresets();
        const current = filtered.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );
        current.forEach((p) => {
            const v = p.querySelector('video');
            if (autoPlayCheckbox.checked) v.play().catch(() => {});
            else v.pause();
        });
    }

    // 🔹 FILTER
    function filterPresets() {
        return Array.from(presets).filter(
            (preset) => currentView === 'all' || favorites.includes(preset.dataset.file)
        );
    }

    // 🔹 SELECT PRESET
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

    // 🔹 GRID CONTROL
    function setupGridControl() {
        const gridButtons = document.querySelectorAll('.grid-btn');
        const presetsContainer = document.querySelector('.presets');

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

    // 🔹 PACK SWITCH
    function switchPack(packType) {
        if (currentPack === packType) return;
        document.querySelectorAll('.preset video').forEach((v) => {
            v.pause();
            v.currentTime = 0;
        });
        currentPack = packType;
        localStorage.setItem('currentPack', packType);
        selectedPreset = null;
        status.textContent = 'No items selected';
        updatePackUI();
        createPresets();
    }

    // 🔹 TABS
    function switchTab(tabType) {
        if (currentView === tabType) return;
        currentView = tabType;
        allTab.classList.toggle('active', tabType === 'all');
        favoritesTab.classList.toggle('active', tabType === 'favorites');
        selectedPreset = null;
        status.textContent = 'No items selected';
        showPage(1);
    }

    // 🔹 APPLY PRESET
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
                    if (!presetFile.exists) return "Error: Preset not found";
                    var activeItem = app.project.activeItem;
                    if (!activeItem || !(activeItem instanceof CompItem)) return "Error: No comp";
                    var selectedLayers = activeItem.selectedLayers;
                    if (selectedLayers.length === 0) return "Error: No layer selected";
                    var success = 0;
                    for (var i = 0; i < selectedLayers.length; i++) {
                        var l = selectedLayers[i];
                        ${
                            isTextPreset
                                ? `if (!(l instanceof TextLayer)) continue;`
                                : `if (!l.property("ADBE Effect Parade")) continue;`
                        }
                        l.applyPreset(presetFile);
                        success++;
                    }
                    return "Success:" + success;
                } catch(err) {
                    return "Error:" + err.toString();
                }
            })();
        `;

        csInterface.evalScript(script, (result) => {
            if (result.startsWith('Success:')) {
                showCustomAlert('Applied to ' + result.split(':')[1] + ' layer(s)', true);
            } else {
                showCustomAlert(result, false);
            }
        });
    }

    // 🔹 ALERT
    function showCustomAlert(message, isSuccess) {
        const existing = document.querySelector('.custom-alert');
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
            </div>`;
        document.body.appendChild(alertBox);
        setTimeout(() => alertBox.classList.add('visible'), 10);
        alertBox.querySelector('.alert-close').addEventListener('click', () => {
            alertBox.classList.remove('visible');
            setTimeout(() => alertBox.remove(), 300);
        });
    }

    // 🔹 EVENT LISTENERS
    function setupEventListeners() {
        autoPlayCheckbox.addEventListener('change', manageVideos);
        prevPageBtn.addEventListener('click', () => currentPage > 1 && showPage(currentPage - 1));
        nextPageBtn.addEventListener(
            'click',
            () => currentPage < totalPages && showPage(currentPage + 1)
        );
        refreshBtn.addEventListener('click', () => {
            selectedPreset = null;
            presets.forEach((p) => p.classList.remove('selected'));
            status.textContent = 'No items selected';
            showPage(1);
        });
        applyBtn.addEventListener('click', applyPreset);
        allTab.addEventListener('click', () => switchTab('all'));
        favoritesTab.addEventListener('click', () => switchTab('favorites'));
        textPackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchPack('text');
            document.querySelector('.pack-dropdown-content').classList.remove('show');
        });
        effectPackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchPack('effect');
            document.querySelector('.pack-dropdown-content').classList.remove('show');
        });
        document.querySelector('.pack-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelector('.pack-dropdown-content').classList.toggle('show');
        });
        window.addEventListener('click', () =>
            document.querySelector('.pack-dropdown-content').classList.remove('show')
        );
    }

    // 🆕 SMART UPDATE SYSTEM
    async function checkForSmartUpdates() {
        const cs = new CSInterface();
        const extPath = cs.getSystemPath(SystemPath.EXTENSION);
        const currentVersion = '1.2'; // manifest.xml versiya

        try {
            const response = await fetch(
                'https://darkpanel-coral.vercel.app/update.json?t=' + Date.now()
            );
            const remote = await response.json();
            if (!remote || !remote.files) return;

            if (remote.version !== currentVersion) {
                await updateChangedFiles(remote.files, extPath);
            }
        } catch (err) {
            console.log('Update check failed:', err);
        }
    }

    async function updateChangedFiles(fileList, basePath) {
        for (const [path, info] of Object.entries(fileList)) {
            const localFile = new File(basePath + '/' + path);
            if (!localFile.exists) {
                await downloadFile(info.url, localFile);
                continue;
            }
            localFile.open('r');
            const data = localFile.read();
            localFile.close();
            const hash = calcHash(data);
            if (hash !== info.hash) await downloadFile(info.url, localFile);
        }
        showCustomAlert('✅ darkPanel updated successfully. Restart AE.', true);
    }

    async function downloadFile(url, destFile) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.overrideMimeType('text/plain; charset=x-user-defined');
            xhr.send(null);
            if (xhr.status === 200) {
                destFile.encoding = 'BINARY';
                destFile.open('w');
                destFile.write(xhr.responseText);
                destFile.close();
            }
        } catch (err) {
            console.log('Download failed for', url, err);
        }
    }

    function calcHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(16);
    }

    init();
});
