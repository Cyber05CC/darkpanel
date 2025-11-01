document.addEventListener('DOMContentLoaded', () => {
    const csInterface = new CSInterface();
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
    let selectedPreset = null;
    let presets = [];

    // 🔹 INIT
    function init() {
        updatePackUI();
        createPresets();
        setupGridControl();
        setupEventListeners();
        setupPresetSelection();
        status.textContent = 'No items selected';
    }

    // 🔹 UPDATE PACK UI
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

    // 🔹 CREATE PRESETS
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
                        <source src="https://darkpanel-coral.vercel.app/assets/videos/${currentPack}_${i}.mp4?t=${Date.now()}" type="video/mp4" />
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
                if (!autoPlayCheckbox.checked) video.play().catch(() => {});
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
    }

    function filterPresets() {
        return Array.from(presets).filter(
            (preset) => currentView === 'all' || favorites.includes(preset.dataset.file)
        );
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
        }
    }

    // 🔹 APPLY PRESET
    function applyPreset() {
        if (!selectedPreset) {
            showCustomAlert('Please select a preset first!', false);
            return;
        }

        const script = `
            (function() {
                try {
                    var presetPath = '${csInterface.getSystemPath(
                        SystemPath.EXTENSION
                    )}/presets/${selectedPreset}';
                    var presetFile = new File(presetPath);
                    if (!presetFile.exists) return "Error: Preset not found";
                    var comp = app.project.activeItem;
                    if (!comp || !(comp instanceof CompItem)) return "Error: No active composition";
                    var layers = comp.selectedLayers;
                    if (!layers.length) return "Error: No layers selected";
                    for (var i = 0; i < layers.length; i++) {
                        layers[i].applyPreset(presetFile);
                    }
                    return "Success:" + layers.length;
                } catch(e) { return "Error:" + e.message; }
            })();
        `;

        csInterface.evalScript(script, (result) => {
            if (result.startsWith('Success:')) showCustomAlert('Applied successfully!', true);
            else showCustomAlert(result, false);
        });
    }

    // 🔹 ALERT
    function showCustomAlert(message, isSuccess) {
        const existing = document.querySelector('.custom-alert');
        if (existing) existing.remove();
        const videoPath = isSuccess
            ? 'https://darkpanel-coral.vercel.app/assets/videos/gojo.mp4'
            : 'https://darkpanel-coral.vercel.app/assets/videos/social.mp4';
        const alertBox = document.createElement('div');
        alertBox.className = 'custom-alert visible';
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
        alertBox.querySelector('.alert-close').addEventListener('click', () => alertBox.remove());
    }

    // 🔹 AUTO-UPDATE SYSTEM
    async function checkForUpdates() {
        try {
            const localVersion = localStorage.getItem('darkpanel_version') || '0.0.0';
            const res = await fetch(
                'https://darkpanel-coral.vercel.app/version.json?t=' + Date.now()
            );
            const data = await res.json();
            if (data.version !== localVersion) {
                showUpdateAlert(data.version, data.changelog);
            }
        } catch (e) {
            console.log('Update check failed:', e);
        }
    }

    function showUpdateAlert(newVersion, changelog) {
        const box = document.createElement('div');
        box.className = 'custom-alert visible';
        box.innerHTML = `
            <div class="alert-content">
                <div class="alert-message">
                    <strong>New version available!</strong><br>
                    Version: ${newVersion}<br>
                    <small>${changelog}</small>
                </div>
                <div style="display:flex;justify-content:center;gap:0.5rem;margin-top:10px;">
                    <button class="alert-close">Later</button>
                    <button class="alert-update">Update Now</button>
                </div>
            </div>
        `;
        document.body.appendChild(box);
        box.querySelector('.alert-close').addEventListener('click', () => box.remove());
        box.querySelector('.alert-update').addEventListener('click', () => {
            localStorage.setItem('darkpanel_version', newVersion);
            window.location.reload(true);
        });
    }

    // 🔹 EVENT LISTENERS
    function setupEventListeners() {
        autoPlayCheckbox.addEventListener('change', () => manageVideos());
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

    // 🔹 SWITCH FUNCTIONS
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

    function switchTab(tabType) {
        if (currentView === tabType) return;
        currentView = tabType;
        allTab.classList.toggle('active', tabType === 'all');
        favoritesTab.classList.toggle('active', tabType === 'favorites');
        selectedPreset = null;
        status.textContent = 'No items selected';
        showPage(1);
    }

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

    init();
    setTimeout(checkForUpdates, 1500);
});
