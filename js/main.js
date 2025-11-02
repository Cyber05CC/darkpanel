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

            if (remote && remote.version && remote.version !== installed) {
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
        popup.innerHTML =
            '<div class="alert-content"><div class="alert-message">🆕 New update available (v' +
            version +
            ')</div><div style="display:flex;gap:10px;justify-content:center;margin-top:8px"><button id="updateNow" class="alert-close">Update Now</button><button id="updateLater" class="alert-close" style="background:#3b3b3b">Later</button></div></div>';
        document.body.appendChild(popup);

        document.getElementById('updateLater').addEventListener('click', function () {
            popup.remove();
        });

        document.getElementById('updateNow').addEventListener('click', function () {
            setUpdateStatus('⏳ Downloading & applying…');
            tryUpdate();
        });

        function setUpdateStatus(msg) {
            var messageEl = popup.querySelector('.alert-message');
            if (messageEl) messageEl.textContent = msg;
        }

        async function tryUpdate() {
            try {
                var ok = await tryWriteToExtension(files);
                if (ok) {
                    localStorage.setItem(LS_INSTALLED, version);
                    setUpdateStatus('✅ Update complete. Reloading…');
                    setTimeout(function () {
                        location.reload();
                    }, 900);
                    return;
                }

                await applyRemoteOverlay(files);
                localStorage.setItem(LS_INSTALLED, version);
                setUpdateStatus('✅ Update applied (overlay). Please restart AE.');
            } catch (err) {
                console.error(err);
                setUpdateStatus('❌ Update failed: ' + err.message);
            }
        }
    }

    async function tryWriteToExtension(files) {
        var extRoot = csInterface.getSystemPath(SystemPath.EXTENSION);

        var ensureFoldersScript = function (fullPath) {
            return (
                '(function() { function ensureFolder(path) { var parts = path.split(/[\\\\/]/); var acc = parts.shift(); while (parts.length) { acc += "/" + parts.shift(); var f = new Folder(acc); if (!f.exists) { try { f.create(); } catch(e) { return "ERR:" + e; } } } return "OK"; } return ensureFolder("' +
                fullPath.replace(/"/g, '\\"') +
                '"); })();'
            );
        };

        for (var rel in files) {
            if (!files.hasOwnProperty(rel)) continue;
            if (SUPPORTED_TEXT_FILES.indexOf(rel) === -1) continue;

            var info = files[rel];
            var url = info.url + '?t=' + Date.now();

            var response = await fetch(url);
            var text = await response.text();

            var dir = rel.split('/').slice(0, -1).join('/');
            if (dir) {
                var targetDir = extRoot + '/' + dir;
                var ok = await new Promise(function (resolve) {
                    csInterface.evalScript(ensureFoldersScript(targetDir), function (res) {
                        resolve(res === 'OK');
                    });
                });
                if (!ok) return false;
            }

            var targetFile = extRoot + '/' + rel;
            var writeScript =
                '(function() { try { var f = new File("' +
                targetFile.replace(/"/g, '\\"') +
                '"); f.encoding = "UTF-8"; f.open("w"); f.write(' +
                JSON.stringify(text) +
                '); f.close(); return "OK"; } catch(e) { return "ERR:" + e; } })();';

            var wrote = await new Promise(function (resolve) {
                csInterface.evalScript(writeScript, function (res) {
                    resolve(res === 'OK');
                });
            });
            if (!wrote) return false;
        }
        return true;
    }

    async function applyRemoteOverlay(files) {
        if (files['css/style.css']) {
            var id = 'overlay-style';
            var link = document.getElementById(id);
            if (!link) {
                link = document.createElement('link');
                link.rel = 'stylesheet';
                link.id = id;
                document.head.appendChild(link);
            }
            link.href = files['css/style.css'].url + '?t=' + Date.now();
        }

        if (files['index.html']) {
            try {
                var response = await fetch(files['index.html'].url + '?t=' + Date.now());
                var html = await response.text();

                var tmp = document.createElement('div');
                tmp.innerHTML = html;
                var newMain = tmp.querySelector('main');
                var curMain = document.querySelector('main');
                if (newMain && curMain) {
                    curMain.innerHTML = newMain.innerHTML;
                }
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
        var packBtn = document.querySelector('.pack-btn');
        if (!packBtn) return;
        if (currentPack === 'text') {
            packBtn.textContent = 'Text Pack ▼';
            if (textPackBtn) textPackBtn.classList.add('active');
            if (effectPackBtn) effectPackBtn.classList.remove('active');
        } else {
            packBtn.textContent = 'Effect Pack ▼';
            if (effectPackBtn) effectPackBtn.classList.add('active');
            if (textPackBtn) textPackBtn.classList.remove('active');
        }
    }

    function createPresets() {
        if (!presetList) return;
        presetList.innerHTML = '';
        var presetCount = currentPack === 'text' ? 30 : 15;
        var packType = currentPack === 'text' ? 'Text' : 'Effect';

        for (var i = 1; i <= presetCount; i++) {
            var preset = document.createElement('div');
            preset.className = 'preset';
            preset.dataset.file = currentPack + '_' + i + '.ffx';
            preset.innerHTML =
                '<div class="preset-thumb"><video muted loop playsinline><source src="./assets/videos/' +
                currentPack +
                '_' +
                i +
                '.mp4?t=' +
                Date.now() +
                '" type="video/mp4" /></video><input type="checkbox" class="favorite-check" data-file="' +
                currentPack +
                '_' +
                i +
                '.ffx"></div><div class="preset-name">' +
                packType +
                ' ' +
                i +
                '</div>';
            presetList.appendChild(preset);
        }

        presets = document.querySelectorAll('.preset');
        initializeFavorites();
        setupVideoHover();
        setupPresetSelection();
        showPage(1);
    }

    function setupVideoHover() {
        presets.forEach(function (preset) {
            var video = preset.querySelector('video');
            preset.addEventListener('mouseenter', function () {
                if (!autoPlayCheckbox || !autoPlayCheckbox.checked) {
                    video.currentTime = 0;
                    video.play().catch(function () {});
                }
            });
            preset.addEventListener('mouseleave', function () {
                if (!autoPlayCheckbox || !autoPlayCheckbox.checked) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        });
    }

    function initializeFavorites() {
        presets.forEach(function (preset) {
            var file = preset.dataset.file;
            var checkbox = preset.querySelector('.favorite-check');
            if (!checkbox) return;
            checkbox.checked = favorites.indexOf(file) !== -1;
            checkbox.addEventListener('change', function () {
                toggleFavorite(file, this.checked);
            });
        });
    }

    function toggleFavorite(file, isFavorite) {
        if (isFavorite && favorites.indexOf(file) === -1) {
            favorites.push(file);
        } else if (!isFavorite) {
            favorites = favorites.filter(function (f) {
                return f !== file;
            });
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));
        if (currentView === 'favorites') showPage(1);
    }

    function showPage(page) {
        var filteredPresets = filterPresets();
        currentPage = page;
        totalPages = Math.ceil(filteredPresets.length / itemsPerPage) || 1;
        presets.forEach(function (p) {
            p.style.display = 'none';
        });
        filteredPresets.slice((page - 1) * itemsPerPage, page * itemsPerPage).forEach(function (p) {
            p.style.display = 'block';
        });
        if (pageInfo) pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        manageVideos();
    }

    function manageVideos() {
        var filtered = filterPresets();
        var current = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        current.forEach(function (p) {
            var v = p.querySelector('video');
            if (autoPlayCheckbox && autoPlayCheckbox.checked) {
                v.play().catch(function () {});
            } else {
                v.pause();
            }
        });
    }

    function filterPresets() {
        return Array.from(presets).filter(function (preset) {
            return currentView === 'all' || favorites.indexOf(preset.dataset.file) !== -1;
        });
    }

    function setupPresetSelection() {
        presets.forEach(function (preset) {
            preset.addEventListener('click', function (e) {
                if (e.target.classList.contains('favorite-check')) return;
                presets.forEach(function (p) {
                    p.classList.remove('selected');
                });
                preset.classList.add('selected');
                selectedPreset = preset.dataset.file;
                if (status) {
                    status.textContent =
                        'Selected: ' + preset.querySelector('.preset-name').textContent;
                }
            });
        });
    }

    function setupGridControl() {
        var gridButtons = document.querySelectorAll('.grid-btn');
        var presetsContainer = document.querySelector('.presets');
        if (!presetsContainer) return;

        var savedCols = parseInt(localStorage.getItem('gridCols')) || 2;
        applyGrid(savedCols);

        gridButtons.forEach(function (btn) {
            if (parseInt(btn.dataset.cols) === savedCols) btn.classList.add('active');

            btn.addEventListener('click', function () {
                gridButtons.forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                var cols = parseInt(btn.dataset.cols);
                localStorage.setItem('gridCols', cols);
                applyGrid(cols);
            });
        });

        function applyGrid(cols) {
            presetsContainer.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
            presetsContainer.dataset.cols = cols;
        }

        window.addEventListener('resize', function () {
            if (window.innerWidth <= 420) {
                presetsContainer.style.gridTemplateColumns = 'repeat(1, 1fr)';
            } else if (window.innerWidth <= 640) {
                presetsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            } else {
                var cols = parseInt(localStorage.getItem('gridCols')) || 2;
                presetsContainer.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
            }
        });
    }

    function switchPack(packType) {
        if (currentPack === packType) return;
        document.querySelectorAll('.preset video').forEach(function (v) {
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
        if (allTab) allTab.classList.toggle('active', tabType === 'all');
        if (favoritesTab) favoritesTab.classList.toggle('active', tabType === 'favorites');
        selectedPreset = null;
        if (status) status.textContent = 'No items selected';
        showPage(1);
    }

    function applyPreset() {
        if (!selectedPreset) {
            showCustomAlert('Please select a preset first!', false);
            return;
        }

        var isTextPreset = selectedPreset.startsWith('text_');
        var script =
            '(function() { try { var presetPath = "' +
            csInterface.getSystemPath(SystemPath.EXTENSION) +
            '/presets/' +
            selectedPreset +
            '"; var presetFile = new File(presetPath); if (!presetFile.exists) return "Error: Preset file not found"; var activeItem = app.project.activeItem; if (!activeItem || !(activeItem instanceof CompItem)) return "Error: No active composition"; var selectedLayers = activeItem.selectedLayers; if (selectedLayers.length === 0) return "Error: Please select at least one layer"; var successCount = 0; for (var i = 0; i < selectedLayers.length; i++) { var layer = selectedLayers[i]; ' +
            (isTextPreset
                ? 'if (!(layer instanceof TextLayer)) continue;'
                : 'if (!layer.property("ADBE Effect Parade")) continue;') +
            ' layer.applyPreset(presetFile); successCount++; } return "Success:" + successCount; } catch(err) { return "Error: " + err.toString(); } })();';

        csInterface.evalScript(script, function (result) {
            if (result && result.startsWith('Success:')) {
                showCustomAlert('Applied to ' + result.split(':')[1] + ' layer(s)', true);
            } else {
                showCustomAlert(result || 'Unknown error', false);
            }
        });
    }

    function showCustomAlert(message, isSuccess) {
        var existing = document.querySelector('.custom-alert:not(.update)');
        if (existing) existing.remove();
        var videoPath = isSuccess ? './assets/videos/gojo.mp4' : './assets/videos/social.mp4';
        var alertBox = document.createElement('div');
        alertBox.className = 'custom-alert';
        alertBox.innerHTML =
            '<div class="alert-content"><div class="alert-icon"><video autoplay muted loop playsinline class="alert-video"><source src="' +
            videoPath +
            '" type="video/mp4" /></video></div><div class="alert-message">' +
            message +
            '</div><button class="alert-close">OK</button></div>';
        document.body.appendChild(alertBox);
        setTimeout(function () {
            alertBox.classList.add('visible');
        }, 10);
        alertBox.querySelector('.alert-close').addEventListener('click', function () {
            alertBox.classList.remove('visible');
            setTimeout(function () {
                alertBox.remove();
            }, 300);
        });
    }

    function setupEventListeners() {
        if (autoPlayCheckbox) {
            autoPlayCheckbox.addEventListener('change', manageVideos);
        }
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function () {
                if (currentPage > 1) showPage(currentPage - 1);
            });
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function () {
                if (currentPage < totalPages) showPage(currentPage + 1);
            });
        }
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                selectedPreset = null;
                presets.forEach(function (p) {
                    p.classList.remove('selected');
                });
                if (status) status.textContent = 'No items selected';
                showPage(1);
            });
        }
        if (applyBtn) {
            applyBtn.addEventListener('click', applyPreset);
        }
        if (allTab) {
            allTab.addEventListener('click', function () {
                switchTab('all');
            });
        }
        if (favoritesTab) {
            favoritesTab.addEventListener('click', function () {
                switchTab('favorites');
            });
        }
        if (textPackBtn) {
            textPackBtn.addEventListener('click', function (e) {
                e.preventDefault();
                switchPack('text');
                var dropdown = document.querySelector('.pack-dropdown-content');
                if (dropdown) dropdown.classList.remove('show');
            });
        }
        if (effectPackBtn) {
            effectPackBtn.addEventListener('click', function (e) {
                e.preventDefault();
                switchPack('effect');
                var dropdown = document.querySelector('.pack-dropdown-content');
                if (dropdown) dropdown.classList.remove('show');
            });
        }
        var packBtn = document.querySelector('.pack-btn');
        if (packBtn) {
            packBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var dropdown = document.querySelector('.pack-dropdown-content');
                if (dropdown) dropdown.classList.toggle('show');
            });
        }
        window.addEventListener('click', function () {
            var dropdown = document.querySelector('.pack-dropdown-content');
            if (dropdown) dropdown.classList.remove('show');
        });
    }
    // -------------------- END UI LOGIKA --------------------
});
