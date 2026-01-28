function getExtensionFolder() {
    try {
        var scriptFile = new File($.fileName);
        if (scriptFile && scriptFile.exists) {
            return scriptFile.parent.parent;
        }
    } catch (e) {}

    try {
        if (typeof CSInterface !== 'undefined') {
            var csInterface = new CSInterface();
            var extensionPath = csInterface.getSystemPath('extension');
            return new Folder(extensionPath);
        }
    } catch (e) {}

    var standardPath = 'C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/darkPanel';
    return new Folder(standardPath);
}

function applyPreset(presetName) {
    try {
        if (typeof app === 'undefined' || !app.project) {
            return 'Error: After Effects is not available';
        }

        var extensionFolder = getExtensionFolder();
        if (!extensionFolder.exists) {
            return 'Error: Cannot locate extension folder at: ' + extensionFolder.fsName;
        }

        var presetsFolder = new Folder(extensionFolder.fsName + '/presets');
        if (!presetsFolder.exists) {
            return 'Error: Presets folder not found at: ' + presetsFolder.fsName;
        }

        var presetFile = new File(presetsFolder.fsName + '/' + presetName);
        if (!presetFile.exists) {
            return 'Error: Preset file not found: ' + presetName;
        }

        if (!app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return 'Error: Please open and select a composition';
        }

        var activeItem = app.project.activeItem;
        if (!activeItem.selectedLayers || activeItem.selectedLayers.length === 0) {
            return 'Error: Please select at least one layer';
        }

        var isTextPreset = presetName.toLowerCase().startsWith('text_');
        var successCount = 0;
        var errorMessages = [];

        for (var i = 0; i < activeItem.selectedLayers.length; i++) {
            var layer = activeItem.selectedLayers[i];
            try {
                if (isTextPreset) {
                    if (!(layer instanceof TextLayer)) {
                        errorMessages.push(
                            layer.name + ": Text preset faqat text layerlarga qo'llanadi"
                        );
                        continue;
                    }
                } else {
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

        var result = 'Successfully applied to ' + successCount + ' layer(s)';
        if (errorMessages.length > 0) {
            result += '\n\nErrors:\n- ' + errorMessages.join('\n- ');
        }
        return result;
    } catch (e) {
        return 'Critical error: ' + e.message;
    }
}

function getAvailablePresets() {
    try {
        var extensionFolder = getExtensionFolder();
        var presetsFolder = new Folder(extensionFolder.fsName + '/presets');
        if (!presetsFolder.exists) return JSON.stringify([]);

        var presets = [];
        var files = presetsFolder.getFiles();

        for (var i = 0; i < files.length; i++) {
            if (files[i] instanceof File && files[i].name.toLowerCase().endsWith('.ffx')) {
                var isText = files[i].name.toLowerCase().startsWith('te xt_');
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
/**
 * Speed Graph Pro - AE Engine
 */
function applySpeedGraph(influenceIn, influenceOut) {
    app.beginUndoGroup('Apply Speed Graph Pro');

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        app.endUndoGroup();
        return 'ERROR: No composition.';
    }

    var selectedProps = comp.selectedProperties;
    if (selectedProps.length === 0) {
        app.endUndoGroup();
        return 'ERROR: Select keyframes.';
    }

    var count = 0;
    var infIn = parseFloat(influenceIn);
    var infOut = parseFloat(influenceOut);

    // AE 0.1 influence dan kichigini yoqtirmaydi ba'zan
    if (infIn < 0.1) infIn = 0.1;
    if (infOut < 0.1) infOut = 0.1;

    for (var i = 0; i < selectedProps.length; i++) {
        var prop = selectedProps[i];

        if (prop.propertyType === PropertyType.PROPERTY) {
            var keys = prop.selectedKeys;
            if (keys.length === 0 && prop.numKeys > 0) {
                for (var k = 1; k <= prop.numKeys; k++) keys.push(k);
            }

            for (var j = 0; j < keys.length; j++) {
                var keyIndex = keys[j];

                // Set to Bezier
                prop.setInterpolationTypeAtKey(
                    keyIndex,
                    KeyframeInterpolationType.BEZIER,
                    KeyframeInterpolationType.BEZIER
                );

                var currentIn = prop.keyInTemporalEase(keyIndex);
                var currentOut = prop.keyOutTemporalEase(keyIndex);

                var newIn = [];
                var newOut = [];

                for (var v = 0; v < currentIn.length; v++) {
                    // Tezlik (speed) 0 bo'lsa haqiqiy "Ease" bo'ladi
                    var sIn = 0;
                    var sOut = 0;

                    var fIn = currentIn[v].influence;
                    var fOut = currentOut[v].influence;

                    // Mantiq: diapazon boshiga va oxiriga qarab
                    if (keys.length === 1) {
                        fIn = infIn;
                        fOut = infOut;
                    } else {
                        if (j === 0) {
                            fOut = infOut;
                        } else if (j === keys.length - 1) {
                            fIn = infIn;
                        } else {
                            fIn = infIn;
                            fOut = infOut;
                        }
                    }

                    newIn.push(new KeyframeEase(sIn, fIn));
                    newOut.push(new KeyframeEase(sOut, fOut));
                }

                try {
                    prop.setTemporalEaseAtKey(keyIndex, newIn, newOut);
                    count++;
                } catch (err) {
                    /* ignore errors for specific props */
                }
            }
        }
    }

    app.endUndoGroup();
    return count > 0 ? 'SUCCESS' : 'ERROR: No properties updated.';
}
