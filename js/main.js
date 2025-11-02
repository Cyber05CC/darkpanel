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

    // 🔹 Check for updates on load
    checkForUpdates();

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
    }

    // 🔹 UPDATE SYSTEM
    async function checkForUpdates() {
        const currentVersion = '1.5'; // manifest.xml bilan bir xil bo‘lishi kerak
        const updateURL = 'https://darkpanel-coral.vercel.app/update.json?t=' + Date.now();

        try {
            const res = await fetch(updateURL);
            if (!res.ok) throw new Error('update.json not found');
            const data = await res.json();

            console.log('Checking updates...');
            console.log('Local version:', currentVersion, '| Remote:', data.version);

            if (data.version !== currentVersion) {
                showUpdatePopup(data.version, data.files);
            } else {
                console.log('✅ darkPanel is up-to-date');
            }
        } catch (err) {
            console.error('❌ Update check failed:', err);
        }
    }

    function showUpdatePopup(version, files) {
        const popup = document.createElement('div');
        popup.className = 'custom-alert visible';
        popup.innerHTML = `
            <div class="alert-content">
                <div class="alert-message">🆕 New update available (v${version})</div>
                <button id="updateNow" class="alert-close">Update Now</button>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('updateNow').addEventListener('click', () => {
            popup.querySelector('.alert-message').textContent = '⏳ Updating...';
            downloadFiles(files, popup);
        });
    }

    async function downloadFiles(files, popup) {
        for (const [path, file] of Object.entries(files)) {
            try {
                const res = await fetch(file.url + '?t=' + Date.now());
                const content = await res.text();

                const saveScript = `
                    (function() {
                        var f = new File("${csInterface.getSystemPath(
                            SystemPath.EXTENSION
                        )}/${path}");
                        f.encoding = "UTF-8";
                        f.open("w");
                        f.write(${JSON.stringify(content)});
                        f.close();
                        return "Updated: ${path}";
                    })();
                `;
                await new Promise((resolve) => csInterface.evalScript(saveScript, () => resolve()));
                console.log('✅ Updated:', path);
            } catch (err) {
                console.error('❌ Failed to update:', path, err);
            }
        }

        popup.querySelector('.alert-message').textContent =
            '✅ Update complete! Restart After Effects.';
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
                    if (!activeItem || !(activeItem instanceof CompItem)) return "Error: No composition";
                    var selectedLayers = activeItem.selectedLayers;
                    if (selectedLayers.length === 0) return "Error: Select a layer first";
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
            </div>
        `;
        document.body.appendChild(alertBox);
        setTimeout(() => alertBox.classList.add('visible'), 10);
        alertBox.querySelector('.alert-close').addEventListener('click', () => {
            alertBox.classList.remove('visible');
            setTimeout(() => alertBox.remove(), 300);
        });
    }

    // 🔹 EVENTS
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

    init();
});
