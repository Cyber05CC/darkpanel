/* global app, KeyframeEase, PropertyValueType, CompItem */

// Funksiyani global scope ga chiqarish (CEP xavfsizligi uchun)
$.global.applySpeedGraph = function(inInfluence, outInfluence) {
    app.beginUndoGroup("Apply Speed Graph Pro");
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return "ERROR: Please select a composition";

        var selectedProperties = comp.selectedProperties;
        if (!selectedProperties || selectedProperties.length === 0) return "ERROR: Select keyframes or properties";

        // Influence qiymatlarini 0.1 va 100 oralig'ida bo'lishini ta'minlash
        var inInf = Math.max(0.1, Math.min(100, Number(inInfluence)));
        var outInf = Math.max(0.1, Math.min(100, Number(outInfluence)));

        var appliedCount = 0;

        for (var i = 0; i < selectedProperties.length; i++) {
            var prop = selectedProperties[i];
            
            // Faqat vaqt bo'yicha o'zgaradigan va keyfremi bor propertylarni tekshiramiz
            if (prop.canVaryOverTime && prop.numKeys > 0) {
                var selectedKeys = prop.selectedKeys;
                if (selectedKeys.length === 0) continue;

                // Property necha o'lchamli ekanligini aniqlash (1D, 2D yoki 3D)
                var dim = 1;
                var vt = prop.propertyValueType;
                if (vt === PropertyValueType.TwoD_Spatial || vt === PropertyValueType.TwoD) {
                    dim = 2;
                } else if (vt === PropertyValueType.ThreeD_Spatial || vt === PropertyValueType.ThreeD) {
                    dim = 3;
                }

                // Har bir o'lcham uchun Ease obyektlarini yaratish
                var inEaseArr = [];
                var outEaseArr = [];
                var inEaseObj = new KeyframeEase(0, inInf);
                var outEaseObj = new KeyframeEase(0, outInf);

                for (var d = 0; d < dim; d++) {
                    inEaseArr.push(inEaseObj);
                    outEaseArr.push(outEaseObj);
                }

                // Tanlangan keyfremlarga qo'llash
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyIdx = selectedKeys[k];
                    try {
                        prop.setTemporalEaseAtKey(keyIdx, inEaseArr, outEaseArr);
                        appliedCount++;
                    } catch (e) {
                        // Ba'zi propertylar (masalan, Path) ease ni qo'llab quvvatlamasligi mumkin
                        continue;
                    }
                }
            }
        }

        if (appliedCount === 0) return "ERROR: No keyframes selected";
        return "SUCCESS: Applied to " + appliedCount + " keys";

    } catch (err) {
        return "ERROR: " + err.toString();
    } finally {
        app.endUndoGroup();
    }
};