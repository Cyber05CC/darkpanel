document.addEventListener('DOMContentLoaded', function () {
    var csInterface = new CSInterface();

    // ----------------------- UPDATE CONFIG -----------------------
    var REMOTE_BASE = 'https://darkpanel-coral.vercel.app';
    var UPDATE_URL = REMOTE_BASE + '/update.json';
    var BUNDLE_VERSION = '1.3';
    var LS_INSTALLED = 'darkpanel_installed_version';
    var SUPPORTED_TEXT_FILES = ['index.html', 'css/style.css', 'js/main.js', 'CSXS/manifest.xml'];
    // -------------------------------------------------------------

    var selectedPreset = null;
    var autoPlayCheckbox = document.getElementById('autoPlay');
    var presetList = document.getElementById('presetList');
    var prevPageBtn = document.getElementById('prevPage');
    var nextPageBtn = document.getElementById('nextPage');
    var pageInfo = document.getElementById('pageInfo');
    var allTab = document.getElementById('allTab');
    var favoritesTab = document.getElementById('favoritesTab');
    var refreshBtn = document.getElementById('refresh');
    var applyBtn = document.getElementById('apply');
    var status = document.getElementById('status');
    var textPackBtn = document.getElementById('textPackBtn');
    var effectPackBtn = document.getElementById('effectPackBtn');

    var itemsPerPage = 10;
    var currentPage = 1;
    var totalPages = 1;
    var currentView = 'all';
    var currentPack = localStorage.getItem('currentPack') || 'text';
    var favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    var presets = [];

    // ----------------------- BOOT -----------------------
    init();
    safeCheckForUpdates();
    // ---------------------------------------------------

    // ===================== UPDATE SYSTEM =====================
    function safeCheckForUpdates() {
        fetch(UPDATE_URL + '?t=' + Date.now())
            .then(function (response) {
                if (!response.ok) throw new Error('update.json not found');
                return response.json();
            })
            .then(function (remote) {
                var installed = localStorage.getItem(LS_INSTALLED) || BUNDLE_VERSION;

                if (remote && remote.version && remote.version !== installed) {
                    showUpdatePopup(remote.version, remote.files);
                } else {
                    console.log('✅ Up to date:', installed);
                }
            })
            .catch(function (e) {
                console.log('Update check skipped:', e);
            });
    }

    function showUpdatePopup(version, files) {
        var existing = document.querySelector('.custom-alert.update');
        if (existing) existing.remove();

        var popup = document.createElement('div');
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

        function tryUpdate() {
            tryWriteToExtension(files)
                .then(function (ok) {
                    if (ok) {
                        localStorage.setItem(LS_INSTALLED, version);
                        setUpdateStatus('✅ Update complete. Reloading…');
                        setTimeout(function () {
                            location.reload();
                        }, 900);
                        return;
                    }
                    return applyRemoteOverlay(files);
                })
                .then(function () {
                    localStorage.setItem(LS_INSTALLED, version);
                    setUpdateStatus('✅ Update applied (overlay). Please restart AE.');
                })
                .catch(function (err) {
                    console.error(err);
                    setUpdateStatus('❌ Update failed: ' + err.message);
                });
        }
    }

    function tryWriteToExtension(files) {
        return new Promise(function (resolve) {
            var extRoot = csInterface.getSystemPath(csInterface.systemPath.EXTENSION);
            var fileKeys = Object.keys(files || {});
            var processed = 0;
            var success = true;

            function processNext() {
                if (processed >= fileKeys.length) {
                    resolve(success);
                    return;
                }

                var rel = fileKeys[processed];
                processed++;

                if (SUPPORTED_TEXT_FILES.indexOf(rel) === -1) {
                    processNext();
                    return;
                }

                var info = files[rel];
                var url = info.url + '?t=' + Date.now();

                fetch(url)
                    .then(function (response) {
                        return response.text();
                    })
                    .then(function (text) {
                        var dir = rel.split('/').slice(0, -1).join('/');
                        if (dir) {
                            var targetDir = extRoot + '/' + dir;
                            var ensureScript =
                                '(function() { function ensureFolder(path) { var parts = path.split(/[\\\\/]/); var acc = parts.shift(); while (parts.length) { acc += "/" + parts.shift(); var f = new Folder(acc); if (!f.exists) { try { f.create(); } catch(e) { return "ERR:" + e; } } } return "OK"; } return ensureFolder("' +
                                targetDir.replace(/"/g, '\\"') +
                                '"); })();';

                            csInterface.evalScript(ensureScript, function (res) {
                                if (res !== 'OK') {
                                    success = false;
                                    processNext();
                                    return;
                                }
                                writeFile();
                            });
                        } else {
                            writeFile();
                        }

                        function writeFile() {
                            var targetFile = extRoot + '/' + rel;
                            var writeScript =
                                '(function() { try { var f = new File("' +
                                targetFile.replace(/"/g, '\\"') +
                                '"); f.encoding = "UTF-8"; f.open("w"); f.write(' +
                                JSON.stringify(text) +
                                '); f.close(); return "OK"; } catch(e) { return "ERR:" + e; } })();';

                            csInterface.evalScript(writeScript, function (res) {
                                if (res !== 'OK') success = false;
                                processNext();
                            });
                        }
                    })
                    .catch(function () {
                        success = false;
                        processNext();
                    });
            }

            processNext();
        });
    }

    function applyRemoteOverlay(files) {
        return new Promise(function (resolve) {
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
                fetch(files['index.html'].url + '?t=' + Date.now())
                    .then(function (response) {
                        return response.text();
                    })
                    .then(function (html) {
                        var tmp = document.createElement('div');
                        tmp.innerHTML = html;
                        var newMain = tmp.querySelector('main');
                        var curMain = document.querySelector('main');
                        if (newMain && curMain) {
                            curMain.innerHTML = newMain.innerHTML;
                        }
                        resolve();
                    })
                    .catch(function (e) {
                        console.log('Overlay HTML swap skipped:', e);
                        resolve();
                    });
            } else {
                resolve();
            }
        });
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
        for (var i = 0; i < presets.length; i++) {
            (function () {
                var preset = presets[i];
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
            })();
        }
    }

    function initializeFavorites() {
        for (var i = 0; i < presets.length; i++) {
            var preset = presets[i];
            var file = preset.dataset.file;
            var checkbox = preset.querySelector('.favorite-check');
            if (!checkbox) continue;
            checkbox.checked = favorites.indexOf(file) !== -1;
            checkbox.addEventListener('change', function () {
                toggleFavorite(this.getAttribute('data-file'), this.checked);
            });
        }
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
        for (var i = 0; i < presets.length; i++) {
            presets[i].style.display = 'none';
        }
        var startIndex = (page - 1) * itemsPerPage;
        var endIndex = page * itemsPerPage;
        var currentPresets = filteredPresets.slice(startIndex, endIndex);
        for (var j = 0; j < currentPresets.length; j++) {
            currentPresets[j].style.display = 'block';
        }
        if (pageInfo) pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        manageVideos();
    }

    function manageVideos() {
        var filtered = filterPresets();
        var startIndex = (currentPage - 1) * itemsPerPage;
        var endIndex = currentPage * itemsPerPage;
        var currentPresets = filtered.slice(startIndex, endIndex);
        for (var i = 0; i < currentPresets.length; i++) {
            var v = currentPresets[i].querySelector('video');
            if (autoPlayCheckbox && autoPlayCheckbox.checked) {
                v.play().catch(function () {});
            } else {
                v.pause();
            }
        }
    }

    function filterPresets() {
        var filtered = [];
        for (var i = 0; i < presets.length; i++) {
            var preset = presets[i];
            if (currentView === 'all' || favorites.indexOf(preset.dataset.file) !== -1) {
                filtered.push(preset);
            }
        }
        return filtered;
    }

    function setupPresetSelection() {
        for (var i = 0; i < presets.length; i++) {
            (function () {
                var preset = presets[i];
                preset.addEventListener('click', function (e) {
                    if (e.target.classList.contains('favorite-check')) return;
                    for (var j = 0; j < presets.length; j++) {
                        presets[j].classList.remove('selected');
                    }
                    preset.classList.add('selected');
                    selectedPreset = preset.dataset.file;
                    if (status) {
                        status.textContent =
                            'Selected: ' + preset.querySelector('.preset-name').textContent;
                    }
                });
            })();
        }
    }

    function setupGridControl() {
        var gridButtons = document.querySelectorAll('.grid-btn');
        var presetsContainer = document.querySelector('.presets');
        if (!presetsContainer) return;

        var savedCols = parseInt(localStorage.getItem('gridCols')) || 2;
        applyGrid(savedCols);

        for (var i = 0; i < gridButtons.length; i++) {
            var btn = gridButtons[i];
            if (parseInt(btn.getAttribute('data-cols')) === savedCols) btn.classList.add('active');

            btn.addEventListener('click', function () {
                for (var j = 0; j < gridButtons.length; j++) {
                    gridButtons[j].classList.remove('active');
                }
                this.classList.add('active');
                var cols = parseInt(this.getAttribute('data-cols'));
                localStorage.setItem('gridCols', cols);
                applyGrid(cols);
            });
        }

        function applyGrid(cols) {
            presetsContainer.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
            presetsContainer.setAttribute('data-cols', cols);
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
        var allVideos = document.querySelectorAll('.preset video');
        for (var i = 0; i < allVideos.length; i++) {
            allVideos[i].pause();
            allVideos[i].currentTime = 0;
        }
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
            csInterface.getSystemPath(csInterface.systemPath.EXTENSION) +
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
        if (autoPlayCheckbox) autoPlayCheckbox.addEventListener('change', manageVideos);
        if (prevPageBtn)
            prevPageBtn.addEventListener('click', function () {
                if (currentPage > 1) showPage(currentPage - 1);
            });
        if (nextPageBtn)
            nextPageBtn.addEventListener('click', function () {
                if (currentPage < totalPages) showPage(currentPage + 1);
            });
        if (refreshBtn)
            refreshBtn.addEventListener('click', function () {
                selectedPreset = null;
                for (var i = 0; i < presets.length; i++) {
                    presets[i].classList.remove('selected');
                }
                if (status) status.textContent = 'No items selected';
                showPage(1);
            });
        if (applyBtn) applyBtn.addEventListener('click', applyPreset);
        if (allTab)
            allTab.addEventListener('click', function () {
                switchTab('all');
            });
        if (favoritesTab)
            favoritesTab.addEventListener('click', function () {
                switchTab('favorites');
            });
        if (textPackBtn)
            textPackBtn.addEventListener('click', function (e) {
                e.preventDefault();
                switchPack('text');
                hideDropdown();
            });
        if (effectPackBtn)
            effectPackBtn.addEventListener('click', function (e) {
                e.preventDefault();
                switchPack('effect');
                hideDropdown();
            });
        var packBtn = document.querySelector('.pack-btn');
        if (packBtn)
            packBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var dropdown = document.querySelector('.pack-dropdown-content');
                if (dropdown) dropdown.classList.toggle('show');
            });
        window.addEventListener('click', hideDropdown);

        function hideDropdown() {
            var dropdown = document.querySelector('.pack-dropdown-content');
            if (dropdown) dropdown.classList.remove('show');
        }
    }
});
