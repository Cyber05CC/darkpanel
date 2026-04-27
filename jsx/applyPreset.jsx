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

function cloneSimpleValue(value) {
    if (value instanceof Array) {
        var arr = [];
        for (var i = 0; i < value.length; i++) arr.push(cloneSimpleValue(value[i]));
        return arr;
    }
    return value;
}

function serializeEaseArray(eases) {
    var result = [];
    if (!eases) return result;
    for (var i = 0; i < eases.length; i++) {
        result.push({
            speed: eases[i].speed,
            influence: eases[i].influence,
        });
    }
    return result;
}

function deserializeEaseArray(eases) {
    var result = [];
    if (!eases) return result;
    for (var i = 0; i < eases.length; i++) {
        result.push(new KeyframeEase(eases[i].speed, eases[i].influence));
    }
    return result;
}

function snapshotLeafProperty(prop) {
    var snap = {
        matchName: prop.matchName,
        keys: [],
        hasValue: false,
    };

    try {
        if (prop.canSetExpression) {
            snap.expression = prop.expression;
            snap.expressionEnabled = prop.expressionEnabled;
        }
    } catch (e) {}

    var keyCount = 0;
    try {
        keyCount = prop.numKeys;
    } catch (e) {}

    if (keyCount > 0) {
        for (var i = 1; i <= keyCount; i++) {
            var key = {
                time: prop.keyTime(i),
                value: cloneSimpleValue(prop.keyValue(i)),
            };

            try {
                key.inInterpolationType = prop.keyInInterpolationType(i);
                key.outInterpolationType = prop.keyOutInterpolationType(i);
            } catch (e) {}

            try {
                key.inTemporalEase = serializeEaseArray(prop.keyInTemporalEase(i));
                key.outTemporalEase = serializeEaseArray(prop.keyOutTemporalEase(i));
            } catch (e) {}

            try {
                key.temporalAutoBezier = prop.keyTemporalAutoBezier(i);
            } catch (e) {}

            try {
                key.temporalContinuous = prop.keyTemporalContinuous(i);
            } catch (e) {}

            try {
                key.spatialAutoBezier = prop.keySpatialAutoBezier(i);
            } catch (e) {}

            try {
                key.spatialContinuous = prop.keySpatialContinuous(i);
            } catch (e) {}

            try {
                key.inSpatialTangent = cloneSimpleValue(prop.keyInSpatialTangent(i));
                key.outSpatialTangent = cloneSimpleValue(prop.keyOutSpatialTangent(i));
            } catch (e) {}

            try {
                key.roving = prop.keyRoving(i);
            } catch (e) {}

            snap.keys.push(key);
        }
    } else {
        try {
            snap.value = cloneSimpleValue(prop.value);
            snap.hasValue = true;
        } catch (e) {}
    }

    return snap;
}

function snapshotTransformProperties(group, result) {
    if (!group) return;
    for (var i = 1; i <= group.numProperties; i++) {
        var child = group.property(i);
        if (!child) continue;

        if (child.propertyType === PropertyType.PROPERTY) {
            result[child.matchName] = snapshotLeafProperty(child);
        } else {
            snapshotTransformProperties(child, result);
        }
    }
}

function snapshotLayerLayout(layer) {
    var snap = {
        startTime: layer.startTime,
        inPoint: layer.inPoint,
        outPoint: layer.outPoint,
        stretch: layer.stretch,
        parentIndex: layer.parent ? layer.parent.index : 0,
        threeDLayer: false,
        transform: {},
    };

    try {
        snap.threeDLayer = layer.threeDLayer;
    } catch (e) {}

    try {
        snapshotTransformProperties(layer.property('ADBE Transform Group'), snap.transform);
    } catch (e) {}

    return snap;
}

function removeAllKeys(prop) {
    try {
        for (var i = prop.numKeys; i >= 1; i--) prop.removeKey(i);
    } catch (e) {}
}

function restoreLeafProperty(prop, snap) {
    if (!prop || !snap) return;

    removeAllKeys(prop);

    if (snap.keys && snap.keys.length) {
        var keyIndexes = [];

        for (var i = 0; i < snap.keys.length; i++) {
            var keyData = snap.keys[i];
            var keyIndex = prop.addKey(keyData.time);
            keyIndexes.push(keyIndex);
            try {
                prop.setValueAtKey(keyIndex, keyData.value);
            } catch (e) {}
        }

        for (var j = 0; j < snap.keys.length; j++) {
            var restoreData = snap.keys[j];
            var restoreIndex = keyIndexes[j];

            try {
                if (
                    restoreData.inInterpolationType !== undefined &&
                    restoreData.outInterpolationType !== undefined
                ) {
                    prop.setInterpolationTypeAtKey(
                        restoreIndex,
                        restoreData.inInterpolationType,
                        restoreData.outInterpolationType
                    );
                }
            } catch (e) {}

            try {
                if (restoreData.inTemporalEase && restoreData.outTemporalEase) {
                    prop.setTemporalEaseAtKey(
                        restoreIndex,
                        deserializeEaseArray(restoreData.inTemporalEase),
                        deserializeEaseArray(restoreData.outTemporalEase)
                    );
                }
            } catch (e) {}

            try {
                if (
                    restoreData.inSpatialTangent !== undefined &&
                    restoreData.outSpatialTangent !== undefined
                ) {
                    prop.setSpatialTangentsAtKey(
                        restoreIndex,
                        restoreData.inSpatialTangent,
                        restoreData.outSpatialTangent
                    );
                }
            } catch (e) {}

            try {
                if (restoreData.temporalAutoBezier !== undefined) {
                    prop.setTemporalAutoBezierAtKey(
                        restoreIndex,
                        restoreData.temporalAutoBezier
                    );
                }
            } catch (e) {}

            try {
                if (restoreData.temporalContinuous !== undefined) {
                    prop.setTemporalContinuousAtKey(
                        restoreIndex,
                        restoreData.temporalContinuous
                    );
                }
            } catch (e) {}

            try {
                if (restoreData.spatialAutoBezier !== undefined) {
                    prop.setSpatialAutoBezierAtKey(
                        restoreIndex,
                        restoreData.spatialAutoBezier
                    );
                }
            } catch (e) {}

            try {
                if (restoreData.spatialContinuous !== undefined) {
                    prop.setSpatialContinuousAtKey(
                        restoreIndex,
                        restoreData.spatialContinuous
                    );
                }
            } catch (e) {}

            try {
                if (restoreData.roving !== undefined) {
                    prop.setRovingAtKey(restoreIndex, restoreData.roving);
                }
            } catch (e) {}
        }
    } else if (snap.hasValue) {
        try {
            prop.setValue(snap.value);
        } catch (e) {}
    }

    try {
        if (prop.canSetExpression) {
            prop.expression = snap.expression || '';
            prop.expressionEnabled = !!snap.expressionEnabled && !!snap.expression;
        }
    } catch (e) {}
}

function restoreTransformProperties(group, snapMap) {
    if (!group || !snapMap) return;
    for (var i = 1; i <= group.numProperties; i++) {
        var child = group.property(i);
        if (!child) continue;

        if (child.propertyType === PropertyType.PROPERTY) {
            restoreLeafProperty(child, snapMap[child.matchName]);
        } else {
            restoreTransformProperties(child, snapMap);
        }
    }
}

function restoreLayerLayout(layer, snap) {
    if (!layer || !snap) return;

    try {
        if (snap.parentIndex > 0) {
            layer.parent = layer.containingComp.layer(snap.parentIndex);
        } else {
            layer.parent = null;
        }
    } catch (e) {}

    try {
        layer.threeDLayer = !!snap.threeDLayer;
    } catch (e) {}

    try {
        layer.startTime = snap.startTime;
    } catch (e) {}

    try {
        layer.inPoint = snap.inPoint;
    } catch (e) {}

    try {
        layer.outPoint = snap.outPoint;
    } catch (e) {}

    try {
        layer.stretch = snap.stretch;
    } catch (e) {}

    try {
        restoreTransformProperties(layer.property('ADBE Transform Group'), snap.transform);
    } catch (e) {}
}

function getFileNameOnly(filePath) {
    var normalized = String(filePath || '').replace(/\\/g, '/');
    var parts = normalized.split('/');
    return parts.length ? parts[parts.length - 1] : normalized;
}

function getPresetBaseName(filePath) {
    return getFileNameOnly(filePath).replace(/\.[^\.]+$/i, '');
}

function shouldUseCompSpaceWrapper(filePath, presetKind) {
    if (presetKind !== 'effect') return false;
    return getPresetBaseName(filePath).toLowerCase() === 'effect_5';
}

function isFullCompPrecompLayer(layer) {
    try {
        if (!layer || !(layer.source instanceof CompItem)) return false;
        var srcComp = layer.source;
        var hostComp = layer.containingComp;
        return srcComp.width === hostComp.width && srcComp.height === hostComp.height;
    } catch (e) {
        return false;
    }
}

function prepareCompSpaceLayer(layer, presetFile) {
    if (!layer) return null;
    if (isFullCompPrecompLayer(layer)) return layer;

    var hostComp = layer.containingComp;
    if (!hostComp) return layer;

    var originalIndex = layer.index;
    var originalName = layer.name;
    var precompName = originalName + ' [' + getPresetBaseName(presetFile.fsName) + ']';
    var wrappedComp = hostComp.layers.precompose([originalIndex], precompName, true);
    var wrappedLayer = null;

    try {
        wrappedLayer = hostComp.layer(originalIndex);
    } catch (e) {}

    if (!wrappedLayer || wrappedLayer.source !== wrappedComp) {
        for (var i = 1; i <= hostComp.numLayers; i++) {
            try {
                if (hostComp.layer(i).source === wrappedComp) {
                    wrappedLayer = hostComp.layer(i);
                    break;
                }
            } catch (e) {}
        }
    }

    if (wrappedLayer) {
        try {
            wrappedLayer.name = originalName;
        } catch (e) {}
        try {
            for (var s = 1; s <= hostComp.numLayers; s++) hostComp.layer(s).selected = false;
            wrappedLayer.selected = true;
        } catch (e) {}
    }

    return wrappedLayer || layer;
}

function findPropertyDeep(group, name) {
    if (!group || !name) return null;
    try {
        var direct = group.property(name);
        if (direct) return direct;
    } catch (e) {}

    try {
        for (var i = 1; i <= group.numProperties; i++) {
            var child = group.property(i);
            if (!child) continue;
            if (child.name === name || child.matchName === name) return child;
            if (child.propertyType !== PropertyType.PROPERTY) {
                var nested = findPropertyDeep(child, name);
                if (nested) return nested;
            }
        }
    } catch (e) {}

    return null;
}

function isShatterEffect(effect) {
    if (!effect) return false;
    try {
        if (effect.matchName === 'ADBE Escher') return true;
    } catch (e) {}
    try {
        if (effect.name === 'Shatter') return true;
    } catch (e) {}
    return (
        !!findPropertyDeep(effect, 'Layer to Reveal') &&
        !!findPropertyDeep(effect, 'Force 1') &&
        !!findPropertyDeep(effect, 'Camera System')
    );
}

function trySetNamedProp(group, propName, value) {
    var prop = findPropertyDeep(group, propName);
    if (!prop) return false;
    try {
        prop.setValue(value);
        return true;
    } catch (e) {
        return false;
    }
}

function normalizeShatterEffect(layer) {
    if (!layer) return;
    var fxParade = null;
    try {
        fxParade = layer.property('ADBE Effect Parade');
    } catch (e) {}
    if (!fxParade) return;

    for (var i = 1; i <= fxParade.numProperties; i++) {
        var fx = fxParade.property(i);
        if (!isShatterEffect(fx)) continue;

        // Reset compound-layer references so the preset uses the current layer/comp instead of the authoring file.
        trySetNamedProp(fx, 'Layer to Reveal', 0);
        trySetNamedProp(fx, 'Gradient Layer', 0);
        trySetNamedProp(fx, 'Custom Shatter Map', 0);
        trySetNamedProp(fx, 'Front Layer', 0);
        trySetNamedProp(fx, 'Side Layer', 0);
        trySetNamedProp(fx, 'Back Layer', 0);
    }
}

function applyPresetFromFilePath(filePath, protectLayout, presetKind) {
    try {
        if (typeof app === 'undefined' || !app.project) {
            return 'Error: After Effects is not available';
        }

        var presetFile = new File(filePath);
        if (!presetFile.exists) {
            return 'Error: Preset file not found';
        }

        var activeItem = app.project.activeItem;
        if (!activeItem || !(activeItem instanceof CompItem)) {
            return 'Error: Please open and select a composition';
        }

        if (!activeItem.selectedLayers || activeItem.selectedLayers.length === 0) {
            return 'Error: Please select at least one layer';
        }

        var isTextPreset = presetKind === 'text';
        var selectedLayers = [];
        for (var s = 0; s < activeItem.selectedLayers.length; s++) {
            selectedLayers.push(activeItem.selectedLayers[s]);
        }
        var successCount = 0;
        var errorMessages = [];

        app.beginUndoGroup('Apply Preset');

        try {
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                try {
                    if (isTextPreset) {
                        if (!(layer instanceof TextLayer)) {
                            errorMessages.push(
                                layer.name + ": Text preset faqat text layerlarga qo'llanadi"
                            );
                            continue;
                        }
                    } else if (!layer.property('ADBE Effect Parade')) {
                        errorMessages.push(
                            layer.name +
                                ": Effect preset faqat effect qabul qiluvchi layerlarga qo'llanadi"
                        );
                        continue;
                    }

                    var targetLayer = layer;
                    if (shouldUseCompSpaceWrapper(filePath, presetKind)) {
                        // Shatter stores key controls in layer space, so effect_5 must run on a comp-sized layer.
                        targetLayer = prepareCompSpaceLayer(layer, presetFile);
                        if (!targetLayer) {
                            throw new Error('Failed to prepare comp-sized layer for Shatter preset');
                        }
                    }

                    var layoutSnapshot = null;
                    if (protectLayout) layoutSnapshot = snapshotLayerLayout(targetLayer);

                    targetLayer.applyPreset(presetFile);

                    if (shouldUseCompSpaceWrapper(filePath, presetKind)) {
                        normalizeShatterEffect(targetLayer);
                    }

                    if (layoutSnapshot) restoreLayerLayout(targetLayer, layoutSnapshot);

                    successCount++;
                } catch (e) {
                    errorMessages.push(layer.name + ': ' + e.message);
                }
            }
        } finally {
            app.endUndoGroup();
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

        var isTextPreset = presetName.toLowerCase().indexOf('text_') === 0;
        return applyPresetFromFilePath(
            presetFile.fsName,
            !isTextPreset,
            isTextPreset ? 'text' : 'effect'
        );
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
                var isText = files[i].name.toLowerCase().indexOf('text_') === 0;
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
