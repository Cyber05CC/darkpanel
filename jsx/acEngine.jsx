function applyACPreset(presetName) {
    app.beginUndoGroup('darkPanel AC Apply');

    if (!app.project) {
        alert('No project');
        return;
    }

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert('Open a composition and select a layer');
        return;
    }

    if (comp.selectedLayers.length === 0) {
        alert('Select at least one layer');
        return;
    }

    var targetLayer = comp.selectedLayers[0];

    // 🔥 TO‘G‘RI EXTENSION PATH (ENG MUHIM FIX)
    var extPath = Folder.appPackage.fsName + '/extensions/darkPanel';
    var presetFile = new File(extPath + '/presets/' + presetName + '.aep');

    if (!presetFile.exists) {
        alert('Preset .aep NOT FOUND:\n' + presetFile.fsName);
        return;
    }

    // IMPORT AEP
    app.project.importFile(new ImportOptions(presetFile));

    // FIND TEMPLATE COMP
    var template = null;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof CompItem && it.name === 'AC_TEMPLATE') {
            template = it;
            break;
        }
    }

    if (!template) {
        alert('AC_TEMPLATE comp not found inside AEP');
        return;
    }

    // FIND EFFECT LAYER
    var srcLayer = null;
    for (var l = 1; l <= template.numLayers; l++) {
        if (template.layer(l).name === 'EFFECT') {
            srcLayer = template.layer(l);
            break;
        }
    }

    if (!srcLayer) {
        alert('EFFECT layer not found in template');
        return;
    }

    var srcFx = srcLayer.property('ADBE Effect Parade');
    var dstFx = targetLayer.property('ADBE Effect Parade');

    if (!srcFx || srcFx.numProperties === 0) {
        alert('No effects in template EFFECT layer');
        return;
    }

    // COPY EFFECTS
    for (var e = 1; e <= srcFx.numProperties; e++) {
        var fx = srcFx.property(e);
        var newFx = dstFx.addProperty(fx.matchName);

        for (var p = 1; p <= fx.numProperties; p++) {
            try {
                newFx.property(p).setValue(fx.property(p).value);
            } catch (_) {}
            try {
                if (fx.property(p).expression) {
                    newFx.property(p).expression = fx.property(p).expression;
                }
            } catch (_) {}
        }
    }

    app.endUndoGroup();
}
