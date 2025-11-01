/**
 * Extension papkasini topish
 * @returns {Folder} Extension papkasi obyekti
 */
function getExtensionFolder() {
    // 1. Birinchi usul - $.fileName orqali
    try {
        var scriptFile = new File($.fileName);
        if (scriptFile && scriptFile.exists) {
            return scriptFile.parent.parent;
        }
    } catch (e) {
        /* ignore */
    }

    // 2. Ikkinchi usul - CSInterface orqali
    try {
        if (typeof CSInterface !== 'undefined') {
            var csInterface = new CSInterface();
            var extensionPath = csInterface.getSystemPath('extension');
            return new Folder(extensionPath);
        }
    } catch (e) {
        /* ignore */
    }

    // 3. Standart yo'l
    var standardPath = 'C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/darkPanel';
    return new Folder(standardPath);
}

/**
 * FFX presetni tanlangan qatlamlarga qo'llash
 * @param {string} presetName - preset fayl nomi
 * @returns {string} - Natija xabari
 */
function applyPreset(presetName) {
    try {
        // 1. Dastur muhitini tekshirish
        if (typeof app === 'undefined' || !app.project) {
            return 'Error: After Effects is not available';
        }

        // 2. Extension va presetlar papkasini topish
        var extensionFolder = getExtensionFolder();
        if (!extensionFolder.exists) {
            return 'Error: Cannot locate extension folder at: ' + extensionFolder.fsName;
        }

        var presetsFolder = new Folder(extensionFolder.fsName + '/presets');
        if (!presetsFolder.exists) {
            return 'Error: Presets folder not found at: ' + presetsFolder.fsName;
        }

        // 3. Preset faylini topish
        var presetFile = new File(presetsFolder.fsName + '/' + presetName);
        if (!presetFile.exists) {
            return 'Error: Preset file not found: ' + presetName;
        }

        // 4. Faol kompozitsiya va tanlangan qatlamlarni tekshirish
        if (!app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return 'Error: Please open and select a composition';
        }

        var activeItem = app.project.activeItem;
        if (!activeItem.selectedLayers || activeItem.selectedLayers.length === 0) {
            return 'Error: Please select at least one layer';
        }

        // 5. Preset turini aniqlash (text yoki effect)
        var isTextPreset = presetName.toLowerCase().startsWith('text_');
        var successCount = 0;
        var errorMessages = [];

        // 6. Har bir tanlangan qatlamga presetni qo'llash
        for (var i = 0; i < activeItem.selectedLayers.length; i++) {
            var layer = activeItem.selectedLayers[i];
            try {
                if (isTextPreset) {
                    // TEXT PRESET QO'LLASH
                    if (!(layer instanceof TextLayer)) {
                        errorMessages.push(
                            layer.name + ": Text preset faqat text layerlarga qo'llanadi"
                        );
                        continue;
                    }
                } else {
                    // EFFECT PRESET QO'LLASH
                    if (!layer.property('ADBE Effect Parade')) {
                        errorMessages.push(
                            layer.name +
                                ": Effect preset faqat effect qabul qiluvchi layerlarga qo'llanadi"
                        );
                        continue;
                    }
                }

                layer.applyPreset(presetFile);
                successCount++;
            } catch (e) {
                errorMessages.push(layer.name + ': ' + e.message);
            }
        }

        // 7. Natijani qaytarish
        var result = 'Successfully applied to ' + successCount + ' layer(s)';
        if (errorMessages.length > 0) {
            result += '\n\nErrors:\n- ' + errorMessages.join('\n- ');
        }
        return result;
    } catch (e) {
        return 'Critical error: ' + e.message;
    }
}

/**
 * Presetlar ro'yxatini olish
 * @returns {string} JSON formatida presetlar ro'yxati
 */
function getAvailablePresets() {
    try {
        var extensionFolder = getExtensionFolder();
        var presetsFolder = new Folder(extensionFolder.fsName + '/presets');
        if (!presetsFolder.exists) return JSON.stringify([]);

        var presets = [];
        var files = presetsFolder.getFiles();

        for (var i = 0; i < files.length; i++) {
            if (files[i] instanceof File && files[i].name.toLowerCase().endsWith('.ffx')) {
                var isText = files[i].name.toLowerCase().startsWith('text_');
                presets.push({
                    name: files[i].name.replace(/\.ffx$/i, '').replace(/_/g, ' '),
                    file: files[i].name,
                    type: isText ? 'text' : 'effect',
                });
            }
        }

        return JSON.stringify(presets);
    } catch (e) {
        return JSON.stringify([]);
    }
}
