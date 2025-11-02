document.addEventListener('DOMContentLoaded', function () {
    const csInterface = new CSInterface();

    // ----------------------- CONFIG -----------------------
    const GITHUB_RAW = 'https://raw.githubusercontent.com/Cyber05CC/darkpanel/main'; // 🔥 GitHub Raw manziling
    const UPDATE_URL = GITHUB_RAW + '/update.json'; // update.json ham GitHub'dan o'qiladi
    const BUNDLE_VERSION = '1.3';
    const LS_INSTALLED = 'darkpanel_installed_version';
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

    // -------------------- STARTUP --------------------
    setupConnectionWatcher();
    init();
    checkForUpdates();
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
            showConnectionAlert('Siz hozir oflayndasiz! Internetni tekshiring.', 'error');
        });

        window.addEventListener('online', () => {
            showConnectionAlert('Internet tiklandi! Sahifa qayta yuklanmoqda...', 'success');
            setTimeout(() => location.reload(), 1500);
        });

        if (!navigator.onLine) {
            showConnectionAlert('Siz hozir oflayndasiz! Internetni tekshiring.', 'error');
        }
    }
    // =============================================================

    // ===================== UPDATE SYSTEM =====================
    async function checkForUpdates() {
        try {
            const res = await fetch(UPDATE_URL + '?t=' + Date.now());
            if (!res.ok) throw new Error('update.json topilmadi');
            const remote = await res.json();

            const installed = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

            if (remote?.version && remote.version !== installed) {
                showUpdatePopup(remote.version);
            } else {
                console.log('✅ Versiya yangilangan:', installed);
            }
        } catch (e) {
            console.warn('❌ Update check xatosi:', e);
        }
    }

    function showUpdatePopup(version) {
        const popup = document.createElement('div');
        popup.className = 'custom-alert update visible';
        popup.innerHTML = `
            <div class="alert-content">
                <div class="alert-message">🆕 Yangi versiya mavjud (v${version})</div>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:8px">
                    <button id="updateNow" class="alert-close">Yangilash</button>
                    <button id="updateLater" class="alert-close" style="background:#3b3b3b">Keyinroq</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('updateLater').onclick = () => popup.remove();
        document.getElementById('updateNow').onclick = () => {
            popup.querySelector('.alert-message').textContent = '⏳ Yangilanmoqda...';
            setTimeout(() => {
                localStorage.setItem(LS_INSTALLED, version);
                popup.querySelector('.alert-message').textContent =
                    '✅ Yangilandi! Iltimos, qayta oching.';
                setTimeout(() => location.reload(), 1000);
            }, 1000);
        };
    }
    // ==========================================================

    // ---------------------- UI LOGIKA -------------------------
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

    function applyPreset() {
        if (!selectedPreset) {
            showCustomAlert('Please select a preset first!', false);
            return;
        }

        const remotePresetUrl = `${GITHUB_RAW}/presets/${selectedPreset}`;
        fetch(remotePresetUrl)
            .then((res) => {
                if (!res.ok) throw new Error('Preset not found on GitHub');
                return res.blob();
            })
            .then((blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64data = reader.result.split(',')[1];
                    const jsxScript = `
(function() {
    try {
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

        // ✅ TEMP path to‘g‘rilandi
        var presetPath = Folder.temp.fsName + "/temp.ffx";
        var f = new File(presetPath);
        var bin = b64decode('${base64data}');
        f.encoding = 'BINARY';
        f.open('w');
        f.write(bin);
        f.close();

        var item = app.project.activeItem;
        if(!item || !(item instanceof CompItem)) return 'Error: No comp';
        var layers = item.selectedLayers;
        if(layers.length === 0) return 'Error: No layers selected';
        for(var i=0;i<layers.length;i++){layers[i].applyPreset(f);}
        try{f.remove();}catch(e){}
        return 'Success:' + layers.length;
    }catch(e){return 'Error:' + e.toString();}
})();`;

                    csInterface.evalScript(jsxScript, (result) => {
                        if (result.startsWith('Success:'))
                            showCustomAlert('✅ Preset applied successfully!', true);
                        else showCustomAlert(result, false);
                    });
                };
                reader.readAsDataURL(blob);
            })
            .catch((err) => showCustomAlert('❌ Failed: ' + err.message, false));
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
