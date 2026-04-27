document.addEventListener('keydown', (e) => {
    if (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        e.key === 'F12'
    ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
    }
});

document.addEventListener('DOMContentLoaded', async function () {
    'use strict';

    // ==================== SIMPLE PERFORMANCE MANAGER ====================
    class SimplePerformanceManager {
        constructor() {
            this.fps = 60;
            this.lastTime = performance.now();
            this.frameCount = 0;
            this.lowFPSThreshold = 45;
            this.performanceMode = false;
            this.init();
        }
        init() {
            this.startFPSMonitoring();
        }
        startFPSMonitoring() {
            const measureFPS = (currentTime) => {
                this.frameCount++;
                if (currentTime - this.lastTime >= 1000) {
                    this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                    const fpsEl = document.getElementById('dp-fps');
                    if (fpsEl) fpsEl.textContent = this.fps;
                    if (this.fps < this.lowFPSThreshold && !this.performanceMode)
                        this.enablePerformanceMode();
                    else if (this.fps > 55 && this.performanceMode) this.disablePerformanceMode();
                    this.frameCount = 0;
                    this.lastTime = currentTime;
                }
                requestAnimationFrame(measureFPS);
            };
            requestAnimationFrame(measureFPS);
        }
        enablePerformanceMode() {
            if (this.performanceMode) return;
            this.performanceMode = true;
            document.body.classList.add('performance-mode');
            console.log('🔧 Performance mode enabled - FPS:', this.fps);
        }
        disablePerformanceMode() {
            if (!this.performanceMode) return;
            this.performanceMode = false;
            document.body.classList.remove('performance-mode');
        }
    }
    const perfManager = new SimplePerformanceManager();

    // ==================== IMPROVED LAZY LOADER ====================
    class ImprovedLazyLoader {
        constructor() {
            this.observer = null;
            this.init();
        }
        init() {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            this.loadImage(entry.target);
                            this.observer.unobserve(entry.target);
                        }
                    });
                },
                { root: null, rootMargin: '300px 0px', threshold: 0.1 }
            );
        }
        loadImage(img) {
            const src = img.dataset.src;
            if (!src || img.classList.contains('preset-img')) return;
            img.src = src;
            img.classList.remove('lazy');
            img.onload = () => {
                requestAnimationFrame(() => {
                    img.style.transition = 'opacity 0.3s ease';
                    img.style.opacity = '1';
                });
            };
        }
        observe(images) {
            images.forEach((img, i) => {
                if (i < 4) this.loadImage(img);
                else this.observer.observe(img);
            });
        }
    }

    // ==================== MAIN APPLICATION ====================
    const API_BASE = 'https://darkpanel-backend-swart.vercel.app/api';
    let csInterface = null;
    try {
        csInterface = new CSInterface();
    } catch (_) {
        console.warn('CSInterface not available.');
    }

    let isSleeping = false;
    let lazyLoader = null;
    let mediaUnlocked = false;
    let idleTimer = null;
    let idleOverlayEl = null;
    let idleVideoEl = null;
    let idleAudioEl = null;
    let isIdleOverlayVisible = false;
    const IDLE_TIMEOUT_MS = 600000;

    // ==================== OFFLINE ASSET CACHE ====================
    const BOOT_ASSETS = {
        loadingGif:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/a0da100633f7eb4a0b0335138f864ab7bc77d566/assets/icon/loading.gif',
        loadingchaGif:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/60483a657710b9eea363040df42fee945ef75a1c/assets/icon/loadingcha.gif',
        lockWebp:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/03ea76a4a76680970d737fefe3a599e90e71cd3e/assets/icon/lock.webp',
        ownerAvatarPng:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/a354e8da82662f88ec5f4e1c7a621fba0c24bf1e/main/assets/icon/owner_avatar.png',
        chumo1Png:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/86a929382b407e7574501733d57645d5516e11d9/assets/icon/chumo1.png',
        chumo2Png:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/86a929382b407e7574501733d57645d5516e11d9/assets/icon/chumo2.png',
        lordiconJs: 'https://cdn.lordicon.com/lordicon.js',
        jezazvlxJson: 'https://cdn.lordicon.com/jezazvlx.json',
        rqqkvjqfJson: 'https://cdn.lordicon.com/rqqkvjqf.json',
        warimiocJson: 'https://cdn.lordicon.com/warimioc.json',
        nfuackpvJson: 'https://cdn.lordicon.com/nfuackpv.json',
        telegramWebp:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/7b2e2124825e04e437cf98a6faea194649715be9/assets/icon/telegram.webp',
        introVideoMp4:
            'https://github.com/Cyber05CC/darkpanel/raw/f3bdf4a8ef5e445d5994822d62bbef1875560329/assets/intro/intro.mp4',
        introSfxMp3:
            'https://github.com/Cyber05CC/darkpanel/raw/3c23197379d0491aa3bc541c931926b04b504f02/assets/intro/intro-sfx.mp3',
        idleVideoMp4:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/163bd6cf6ec71677f346e162f6b851bb4c5c5b24/assets/iddle/idle.mp4',
        idleSfxMp3:
            'https://raw.githubusercontent.com/Cyber05CC/darkpanel/163bd6cf6ec71677f346e162f6b851bb4c5c5b24/assets/iddle/idle-sfx.mp3',
    };
    const ASSET_CACHE_VERSION = 'v2';
    let DP_ASSETS = Object.assign({}, BOOT_ASSETS);

    function normalizeSystemPath(path) {
        if (!path) return '';
        let p = decodeURI(String(path));
        if (p.indexOf('file:///') === 0) {
            p = p.replace('file:///', '');
            if (!/^[A-Za-z]:/.test(p)) p = '/' + p;
        } else if (p.indexOf('file://') === 0) {
            p = p.replace('file://', '');
        }
        return p;
    }
    function escES(str) {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }
    function evalES(script) {
        return new Promise((resolve) => {
            if (!csInterface) return resolve('');
            csInterface.evalScript(script, resolve);
        });
    }
    function bytesToBase64(uint8) {
        let b = '';
        const cs = 0x8000;
        for (let i = 0; i < uint8.length; i += cs)
            b += String.fromCharCode.apply(null, uint8.subarray(i, i + cs));
        return btoa(b);
    }
    function absPathToFileUrl(absPath) {
        let p = String(absPath).replace(/\\/g, '/');
        if (!p.startsWith('/')) p = '/' + p;
        return encodeURI('file://' + p);
    }

    async function getAssetCacheDir() {
        if (!csInterface) return null;
        let base = normalizeSystemPath(csInterface.getSystemPath(SystemPath.USER_DATA));
        const isWin = /win/i.test(navigator.platform || '');
        if (isWin) base = base.replace(/\//g, '\\');
        const sep = isWin ? '\\' : '/';
        return base + sep + 'darkPanelAssets' + sep + ASSET_CACHE_VERSION;
    }

    async function ensureFolderExists(absDir) {
        const res = await evalES(
            `(function(){try{function e(p){var n=p.replace(/\\\\\\\\/g,"/"),a=n.split("/"),c=a.shift();if(c==="")c="/";while(a.length){var t=a.shift();if(!t)continue;c=c==="/"?c+t:c+"/"+t;var f=new Folder(c);if(!f.exists&&!f.create())return"ERR";}return"OK";}return e("${escES(absDir)}");}catch(e){return"ERR";}})();`
        );
        return String(res).indexOf('OK') === 0;
    }
    async function fileExists(absPath) {
        return (
            (await evalES(
                `(function(){try{return new File("${escES(absPath)}").exists?"1":"0";}catch(e){return"0";}})();`
            )) === '1'
        );
    }

    async function writeBase64Binary(absPath, base64) {
        const CHUNK = 24000;
        const opened = await evalES(
            `(function(){try{var f=new File("${escES(absPath)}");f.encoding="BINARY";f.open("w");f.close();return"OK";}catch(e){return"ERR";}})();`
        );
        if (String(opened).indexOf('OK') !== 0) return false;
        for (let i = 0; i < base64.length; i += CHUNK) {
            const part = base64.slice(i, i + CHUNK);
            const res = await evalES(
                `(function(){try{function b64d(s){var k="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",o="",b=0,x=0,c,v;for(var i=0;i<s.length;i++){c=s.charAt(i);if(c==='=')break;v=k.indexOf(c);if(v<0)continue;b=(b<<6)|v;x+=6;if(x>=8){x-=8;o+=String.fromCharCode((b>>x)&0xFF);}}return o;}var f=new File("${escES(absPath)}");f.encoding="BINARY";f.open("a");f.write(b64d("${part}"));f.close();return"OK";}catch(e){return"ERR";}})();`
            );
            if (String(res).indexOf('OK') !== 0) return false;
        }
        return true;
    }

    async function ensureCachedAsset(key, remoteUrl, localFileName) {
        try {
            const cacheDir = await getAssetCacheDir();
            if (!cacheDir) return remoteUrl;
            const isWin = /win/i.test(navigator.platform || '');
            const sep = isWin ? '\\' : '/';
            const absPath = cacheDir + sep + localFileName;
            if (!(await ensureFolderExists(cacheDir))) return remoteUrl;
            if (await fileExists(absPath)) return absPathToFileUrl(absPath);
            if (!navigator.onLine) return remoteUrl;
            const res = await fetch(remoteUrl, { cache: 'no-store' });
            if (!res.ok) throw new Error('Download failed');
            const buffer = await res.arrayBuffer();
            const b64 = bytesToBase64(new Uint8Array(buffer));
            if (!(await writeBase64Binary(absPath, b64))) return remoteUrl;
            if (await fileExists(absPath)) return absPathToFileUrl(absPath);
            return remoteUrl;
        } catch (e) {
            console.warn('Asset cache error:', key, e);
            return remoteUrl;
        }
    }

    async function bootstrapLocalAssets() {
        const map = {
            loadingGif: 'loading.gif',
            loadingchaGif: 'loadingcha.gif',
            lockWebp: 'lock.webp',
            ownerAvatarPng: 'owner_avatar.png',
            chumo1Png: 'chumo1.png',
            chumo2Png: 'chumo2.png',
            lordiconJs: 'lordicon.js',
            jezazvlxJson: 'jezazvlx.json',
            rqqkvjqfJson: 'rqqkvjqf.json',
            warimiocJson: 'warimioc.json',
            nfuackpvJson: 'nfuackpv.json',
            telegramWebp: 'telegram.webp',
            introVideoMp4: 'intro.mp4',
            introSfxMp3: 'intro-sfx.mp3',
            idleVideoMp4: 'idle.mp4',
            idleSfxMp3: 'idle-sfx.mp3',
        };
        for (const [key, file] of Object.entries(map)) {
            DP_ASSETS[key] = await ensureCachedAsset(key, BOOT_ASSETS[key], file);
        }
        try {
            localStorage.setItem('dp_cached_assets', JSON.stringify(DP_ASSETS));
        } catch (e) {}
    }

    function patchExistingStaticImgs() {
        document
            .querySelectorAll('img.empty-state-img')
            .forEach((i) => (i.src = DP_ASSETS.loadingGif));
        document
            .querySelectorAll('img.dp-offline-img')
            .forEach((i) => (i.src = DP_ASSETS.loadingchaGif));
        document
            .querySelectorAll('#dp-owner-panel .owner-avatar img')
            .forEach((i) => (i.src = DP_ASSETS.ownerAvatarPng));
        document.querySelectorAll('.activate-lock').forEach((i) => (i.src = DP_ASSETS.lockWebp));
        document.querySelectorAll('#chumo-1').forEach((i) => (i.src = DP_ASSETS.chumo1Png));
        document.querySelectorAll('#chumo-2').forEach((i) => (i.src = DP_ASSETS.chumo2Png));
        document
            .querySelectorAll('.owner-dm img[alt="message"]')
            .forEach((i) => (i.src = DP_ASSETS.telegramWebp));
    }

    // ==================== MEDIA / IDLE / INTRO ====================
    async function unlockMediaPlayback() {
        if (mediaUnlocked) return true;
        try {
            if (!idleOverlayEl || !idleVideoEl || !idleAudioEl) createIdleOverlay();
            idleVideoEl.muted = true;
            idleVideoEl.currentTime = 0;
            await idleVideoEl.play();
            idleVideoEl.pause();
            idleVideoEl.currentTime = 0;
            idleAudioEl.volume = 0.01;
            idleAudioEl.currentTime = 0;
            await idleAudioEl.play();
            idleAudioEl.pause();
            idleAudioEl.currentTime = 0;
            idleAudioEl.volume = 1;
            mediaUnlocked = true;
            console.log('🔓 Media unlocked: SUCCESS');
            return true;
        } catch (e) {
            mediaUnlocked = false;
            return false;
        }
    }

    function createIdleOverlay() {
        if (idleOverlayEl) return;
        idleOverlayEl = document.createElement('div');
        idleOverlayEl.id = 'dp-idle-overlay';
        idleOverlayEl.style.cssText =
            'position:fixed;inset:0;z-index:1000002;display:flex;align-items:center;justify-content:center;background:rgba(7,7,10,0.40);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;visibility:hidden;transition:opacity 0.35s ease,visibility 0.35s ease;cursor:pointer;';
        const inner = document.createElement('div');
        inner.style.cssText =
            'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;pointer-events:none;';
        idleVideoEl = document.createElement('video');
        idleVideoEl.src = DP_ASSETS.idleVideoMp4;
        idleVideoEl.preload = 'auto';
        idleVideoEl.loop = true;
        idleVideoEl.playsInline = true;
        idleVideoEl.muted = true;
        idleVideoEl.controls = false;
        idleVideoEl.style.cssText =
            'width:min(360px,74vw);max-height:72vh;object-fit:contain;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,0.42);opacity:0;transform:scale(0.94);transition:opacity 0.35s ease,transform 0.35s ease;background:transparent;pointer-events:none;';
        const hint = document.createElement('div');
        hint.textContent = 'Go to Work';
        hint.style.cssText =
            'color:rgba(255,255,255,0.78);font:600 13px/1.2 cursive,sans-serif;letter-spacing:0.2px;text-shadow:0 1px 6px rgba(0,0,0,0.35);pointer-events:none;';
        idleAudioEl = document.createElement('audio');
        idleAudioEl.src = DP_ASSETS.idleSfxMp3;
        idleAudioEl.preload = 'auto';
        idleAudioEl.loop = true;
        idleAudioEl.volume = 1;
        inner.appendChild(idleVideoEl);
        inner.appendChild(hint);
        idleOverlayEl.appendChild(inner);
        idleOverlayEl.addEventListener('mousedown', hideIdleOverlay);
        idleOverlayEl.addEventListener('click', hideIdleOverlay);
        document.body.appendChild(idleOverlayEl);
    }
    function showIdleOverlay() {
        if (isIdleOverlayVisible || document.hidden) return;
        if (document.getElementById('dp-info-modal')?.classList.contains('show')) return;
        if (document.getElementById('dp-owner-panel')?.classList.contains('show')) return;
        createIdleOverlay();
        isIdleOverlayVisible = true;
        document.body.classList.add('dp-idle-active');
        idleOverlayEl.style.visibility = 'visible';
        requestAnimationFrame(() => {
            idleOverlayEl.style.opacity = '1';
            idleVideoEl.style.opacity = '1';
            idleVideoEl.style.transform = 'scale(1)';
        });
        try {
            idleVideoEl.currentTime = 0;
        } catch (_) {}
        try {
            idleAudioEl.currentTime = 0;
        } catch (_) {}
        idleVideoEl.play().catch(() => {});
        if (mediaUnlocked) {
            idleAudioEl.volume = 1;
            idleAudioEl.play().catch(() => {});
        }
    }
    function hideIdleOverlay() {
        if (!isIdleOverlayVisible || !idleOverlayEl) return;
        isIdleOverlayVisible = false;
        document.body.classList.remove('dp-idle-active');
        idleOverlayEl.style.opacity = '0';
        idleOverlayEl.style.visibility = 'hidden';
        if (idleVideoEl) {
            idleVideoEl.style.opacity = '0';
            idleVideoEl.style.transform = 'scale(0.96)';
            try {
                idleVideoEl.pause();
            } catch (_) {}
        }
        if (idleAudioEl) {
            try {
                idleAudioEl.pause();
            } catch (_) {}
        }
        resetIdleTimer();
    }
    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        if (isIdleOverlayVisible) return;
        idleTimer = setTimeout(showIdleOverlay, IDLE_TIMEOUT_MS);
    }
    function initIdleOverlaySystem() {
        createIdleOverlay();
        ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach((ev) =>
            window.addEventListener(
                ev,
                () => {
                    if (!isIdleOverlayVisible) resetIdleTimer();
                },
                { passive: true }
            )
        );
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearTimeout(idleTimer);
                hideIdleOverlay();
            } else resetIdleTimer();
        });
        resetIdleTimer();
    }
    async function playIntroOverlay() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'dp-intro-overlay';
            overlay.style.cssText =
                'position:fixed;inset:0;z-index:1000001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.58);backdrop-filter:blur(4px);opacity:0;transition:opacity 0.35s ease;';
            const video = document.createElement('video');
            video.src = DP_ASSETS.introVideoMp4;
            video.preload = 'auto';
            video.playsInline = true;
            video.muted = false;
            video.controls = false;
            video.style.cssText =
                'width:min(320px,72vw);max-height:72vh;object-fit:contain;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,0.45);opacity:0;transform:scale(0.92);transition:opacity 0.35s ease,transform 0.35s ease;pointer-events:none;background:transparent;';
            const sfx = document.createElement('audio');
            sfx.src = DP_ASSETS.introSfxMp3;
            sfx.preload = 'auto';
            let closed = false;
            function close() {
                if (closed) return;
                closed = true;
                overlay.style.opacity = '0';
                video.style.opacity = '0';
                video.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    try {
                        video.pause();
                    } catch (_) {}
                    try {
                        sfx.pause();
                    } catch (_) {}
                    try {
                        overlay.remove();
                    } catch (_) {}
                    resolve();
                }, 350);
            }
            overlay.appendChild(video);
            document.body.appendChild(overlay);
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                video.style.opacity = '1';
                video.style.transform = 'scale(1)';
            });
            Promise.allSettled([video.play().catch(() => {}), sfx.play().catch(() => {})]).then(
                () => {
                    video.addEventListener('ended', close, { once: true });
                    setTimeout(close, 7000);
                }
            );
        });
    }

    // ==================== SLEEP ====================
    function goSleep() {
        hideIdleOverlay();
        clearTimeout(idleTimer);
        if (isSleeping) return;
        if (document.getElementById('dp-info-modal')?.classList.contains('show')) return;
        isSleeping = true;
        document.body.classList.add('dp-sleep');
    }
    function wakeUp() {
        if (!isSleeping) return;
        isSleeping = false;
        document.body.classList.remove('dp-sleep');
        resetIdleTimer();
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) goSleep();
        else wakeUp();
    });
    window.addEventListener('blur', goSleep);
    window.addEventListener('focus', wakeUp);
    if (csInterface && typeof csInterface.addEventListener === 'function') {
        try {
            csInterface.addEventListener('com.adobe.csxs.events.ApplicationActivate', wakeUp);
            csInterface.addEventListener('com.adobe.csxs.events.ApplicationDeactivate', goSleep);
        } catch (e) {}
    }

    // ==================== DEVICE / API ====================
    async function getDeviceId() {
        try {
            if (csInterface) {
                const p = csInterface.getSystemPath(SystemPath.USER_DATA);
                if (p) return 'cep_' + String(p);
            }
        } catch (_) {}
        const STORAGE_KEY = 'dp_web_device_id';
        try {
            const existing = localStorage.getItem(STORAGE_KEY);
            if (existing) return existing;
        } catch (_) {}
        let token = '';
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                token = crypto.randomUUID();
            } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(16);
                crypto.getRandomValues(bytes);
                token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (_) {}
        if (!token) {
            token = Date.now().toString(36) + Math.random().toString(36).slice(2);
        }
        const id = 'web_' + token;
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch (_) {}
        return id;
    }
    const deviceId = await getDeviceId();
    async function apiPost(path, body) {
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
                cache: 'no-store',
            });
            return { ok: res.ok, data: await res.json().catch(() => ({})) };
        } catch (err) {
            return { ok: false, data: { error: 'network_error' } };
        }
    }

    // ==================== UPTIME ====================
    const startTime = Date.now();
    const uptimeEl = document.getElementById('dp-uptime');
    function updateUptime() {
        if (!uptimeEl) return;
        const d = Date.now() - startTime;
        uptimeEl.textContent = `${String(Math.floor(d / 3600000)).padStart(2, '0')}:${String(Math.floor((d % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((d % 60000) / 1000)).padStart(2, '0')}`;
    }
    setInterval(updateUptime, 1000);
    updateUptime();

    // ==================== LICENSE ====================
    const LOCAL_KEY = 'darkpanel_license_key';
    async function checkKey(key) {
        const { data } = await apiPost('/license/check', { key, deviceId });
        return data;
    }
    async function activateKey(key) {
        const { data } = await apiPost('/license/activate', { key, deviceId });
        return data;
    }
    async function validateStoredKey() {
        const key = localStorage.getItem(LOCAL_KEY);
        if (!key) return false;
        if (!navigator.onLine) return true;
        const data = await checkKey(key);
        return !!(data && (data.ok || data.valid));
    }

    const platformEl = document.getElementById('dp-platform');
    if (platformEl) platformEl.textContent = navigator.platform || 'Unknown';
    const panelStateEl = document.getElementById('dp-panel-state');
    if (panelStateEl) panelStateEl.textContent = document.hidden ? 'Idle' : 'Active';
    document.addEventListener('visibilitychange', () => {
        if (panelStateEl) panelStateEl.textContent = document.hidden ? 'Idle' : 'Active';
    });

    await bootstrapLocalAssets();
    patchExistingStaticImgs();

    // ==================== ACTIVATION UI ====================
    function renderActivationUI() {
        if (!navigator.onLine) {
            showOfflineNeedsNetOverlay();
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'dp-activation';
        overlay.style.cssText =
            'position:fixed;inset:0;background:#0f0f10;display:flex;align-items:center;justify-content:center;z-index:999999;color:#fff;font-family:Inter,system-ui,Arial,sans-serif;';
        overlay.innerHTML = `<div style="width:min(450px,90vw);border:1px solid #2a2a2a;border-radius:14px;background:linear-gradient(180deg,#141416,#0f0f10)"><div style="padding:22px 20px" class="dalbayop"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:32px;height:32px;border-radius:8px;background:#3537ff;display:flex;align-items:center;justify-content:center"><img class="activate-lock" src="${DP_ASSETS.lockWebp}" alt="lock"/></div><h2 style="margin:0;font-size:18px;font-weight:700">darkPanel Activation</h2></div><p style="margin:6px 0 14px;color:#bdbdbd;font-size:12px">Please enter your key.</p><input id="dp-key" placeholder="XXXX-XXXX-XXXX" spellcheck="false" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2b2b2b;background:#131318;color:#eaeaea;outline:none;font-size:13px"/><div style="display:flex;gap:10px;margin-top:12px"><button id="dp-activate" style="flex:1;padding:10px 12px;border:0;border-radius:10px;background:#4a6cff;color:#fff;font-weight:600;cursor:pointer">Activate</button></div><div id="dp-msg" style="margin-top:10px;color:#9ca3af;font-size:12px;min-height:16px"></div></div><div class="chumolar"><img style="margin-top:7.5px" id="chumo-1" src="${DP_ASSETS.chumo1Png}" alt="chumo1"/><h1 class="dp-brand">darkPanel</h1><img id="chumo-2" src="${DP_ASSETS.chumo2Png}" alt="chumo2"/></div></div>`;
        document.body.appendChild(overlay);
        document.getElementById('dp-activate').onclick = async () => {
            const el = document.getElementById('dp-key'),
                msg = document.getElementById('dp-msg');
            const key = (el?.value || '').trim().toUpperCase();
            if (!key) {
                msg.textContent = 'Please paste your key.';
                return;
            }
            msg.textContent = '🔄 Checking key…';
            const result = await activateKey(key);
            if (!result) {
                msg.textContent = '❌ No response.';
                return;
            }
            if (!result.ok) {
                msg.textContent =
                    '❌ ' +
                    (result.error === 'bound_to_other_device'
                        ? 'Key used on another device'
                        : result.error === 'trial_expired'
                          ? 'Trial expired'
                          : result.error === 'not_found'
                            ? 'Key not found'
                            : result.error || 'Invalid key');
                return;
            }
            localStorage.setItem(LOCAL_KEY, key);
            msg.textContent = '✅ Activated!';
            await bootstrapLocalAssets();
            await playIntroOverlay();
            overlay.remove();
            startApp();
        };
    }
    function showOfflineRibbon() {
        if (document.getElementById('offline-ribbon')) return;
        const b = document.createElement('div');
        b.id = 'offline-ribbon';
        b.style.cssText =
            'position:fixed;left:12px;right:12px;bottom:10rem;z-index:99999;background:#191a1f;border:1px solid #2b2b2b;color:#bbb;padding:6px 10px;border-radius:8px;font:12px/1.2 Inter,system-ui;text-align:center;';
        b.textContent = '📡 Offline mode';
        document.body.appendChild(b);
        window.addEventListener(
            'online',
            () => {
                b.remove();
                location.reload();
            },
            { once: true }
        );
    }
    function showOfflineNeedsNetOverlay() {
        const el = document.createElement('div');
        el.style.cssText =
            'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0f0f10;color:#fff;z-index:999999;font-family:Inter,system-ui;flex-direction:column;gap:8px;';
        el.innerHTML =
            '<div style="font-size:40px">📡</div><div style="font-size:16px;font-weight:700">No internet</div><div style="font-size:13px;color:#bdbdbd">Activation requires internet</div><button id="retryNet" style="margin-top:10px;padding:8px 14px;border-radius:10px;border:0;background:#4a6cff;color:#fff;font-weight:600">Try again</button>';
        document.body.appendChild(el);
        const go = () => {
            el.remove();
            location.reload();
        };
        document.getElementById('retryNet').onclick = go;
        window.addEventListener('online', go, { once: true });
    }

    // ==================== INFO MODAL ====================
    const infoModal = document.getElementById('dp-info-modal');
    const closeInfoBtn = infoModal?.querySelector('.close-info');
    const btnWrapper = document.querySelector('.btn-wrapper');
    function openInfoModal() {
        if (!infoModal) return;
        perfManager.disablePerformanceMode();
        infoModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        fillInfoModal();
    }
    function closeInfoModal() {
        if (!infoModal) return;
        infoModal.classList.remove('show');
        document.body.style.overflow = '';
    }
    if (btnWrapper) btnWrapper.addEventListener('click', openInfoModal);
    if (closeInfoBtn) closeInfoBtn.addEventListener('click', closeInfoModal);
    infoModal?.addEventListener('click', (e) => {
        if (e.target === infoModal) closeInfoModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && infoModal?.classList.contains('show')) closeInfoModal();
    });

    async function fillInfoModal() {
        const key = localStorage.getItem(LOCAL_KEY);
        const statusBadge = document.getElementById('modal-status'),
            licenseBadge = document.getElementById('modal-license-status'),
            trialBadge = document.getElementById('modal-trial-days'),
            versionBadge = document.getElementById('modal-version');
        if (!statusBadge || !licenseBadge) return;
        licenseBadge.textContent = 'Loading…';
        trialBadge.textContent = '…';
        statusBadge.textContent = navigator.onLine ? 'Online' : 'Offline';
        statusBadge.className = 'value-badge ' + (navigator.onLine ? 'online' : 'offline');
        checkKey(key).then((data) => {
            if (!data?.ok) {
                licenseBadge.textContent = 'Not Activated';
                licenseBadge.style.color = '#f00';
                trialBadge.textContent = '–';
                return;
            }
            if (data.type === 'lifetime') {
                licenseBadge.textContent = 'Lifetime';
                licenseBadge.style.color = '#0f0';
                trialBadge.textContent = 'Unlimited';
            }
            if (data.type === 'trial') {
                licenseBadge.textContent = 'Trial';
                licenseBadge.style.color = '#f80';
                trialBadge.textContent = data.remainingDays ?? '0';
            }
        });
        versionBadge.textContent =
            'v' +
            (localStorage.getItem('darkpanel_last_applied_version') ||
                localStorage.getItem('darkpanel_installed_version') ||
                '1.0.0');
        document.getElementById('modal-env').textContent = csInterface
            ? 'After Effects'
            : 'Browser';
        document.getElementById('modal-device').textContent = deviceId.slice(0, 10) + '…';
        document.getElementById('modal-net').textContent = navigator.onLine ? 'Stable' : 'Offline';
    }
    window.addEventListener('online', () => {
        const s = document.getElementById('modal-status');
        if (s) {
            s.textContent = 'Online';
            s.style.color = '#0f0';
        }
    });
    window.addEventListener('offline', () => {
        const s = document.getElementById('modal-status');
        if (s) {
            s.textContent = 'Offline';
            s.style.color = '#f00';
        }
    });

    // ==================== AUTOPLAY PREVIEW ====================
    let selectedPresetEl = null;
    let autoplayEnabled = localStorage.getItem('dp_autoplay') !== 'off';
    let autoplayObserver = null;
    const autoplayingSet = new Set();

    function playPreview(img) {
        const ph = img.parentElement?.querySelector('.image-placeholder');
        if (ph) ph.style.display = '';
        if (!autoplayEnabled || !img?.dataset.src || autoplayingSet.has(img)) return;
        autoplayingSet.add(img);
        img.style.visibility = 'visible';
        img.style.opacity = '0';
        img.onload = () => {
            img.style.visibility = 'visible';
            img.style.opacity = '1';
            const p = img.parentElement?.querySelector('.image-placeholder');
            if (p) p.style.display = 'none';
        };
        if (img.getAttribute('src') !== img.dataset.src) img.src = img.dataset.src;
        if (img.complete && img.naturalWidth > 0) {
            img.style.visibility = 'visible';
            img.style.opacity = '1';
            const p = img.parentElement?.querySelector('.image-placeholder');
            if (p) p.style.display = 'none';
        }
    }
    function stopPreview(img) {
        if (!img) return;
        img.onload = null;
        img.removeAttribute('src');
        img.style.opacity = '0';
        img.style.visibility = 'hidden';
        autoplayingSet.delete(img);
    }
    function stopAllPreviews() {
        document.querySelectorAll('.preset-img').forEach((i) => stopPreview(i));
        autoplayingSet.clear();
    }
    function initAutoplayObserver() {
        if (autoplayObserver) autoplayObserver.disconnect();
        autoplayObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    const img = e.target.querySelector('.preset-img');
                    if (!img?.dataset.src) return;
                    if (e.isIntersecting) playPreview(img);
                    else if (e.target !== selectedPresetEl) stopPreview(img);
                });
            },
            { rootMargin: '100px', threshold: 0.1 }
        );
    }
    function observeVisiblePresets() {
        if (!autoplayObserver) return;
        autoplayObserver.disconnect();
        document.querySelectorAll('.preset').forEach((p) => {
            if (p.style.display !== 'none') autoplayObserver.observe(p);
        });
    }
    function forceLoadVisiblePresets() {
        const c = document.getElementById('presets-container');
        if (!c) return;
        const cr = c.getBoundingClientRect();
        document.querySelectorAll('.preset').forEach((p) => {
            if (p.style.display === 'none') return;
            const r = p.getBoundingClientRect();
            if (r.bottom > cr.top && r.top < cr.bottom) {
                const img = p.querySelector('.preset-img');
                if (img?.dataset.src && !img.src) playPreview(img);
            }
        });
    }
    function toggleAutoplay() {
        autoplayEnabled = !autoplayEnabled;
        localStorage.setItem('dp_autoplay', autoplayEnabled ? 'on' : 'off');
        updateAutoplayBtn();
        if (autoplayEnabled) {
            observeVisiblePresets();
            setTimeout(forceLoadVisiblePresets, 100);
        } else {
            stopAllPreviews();
            autoplayObserver?.disconnect();
        }
    }
    function updateAutoplayBtn() {
        const btn = document.getElementById('autoplayToggle');
        if (!btn) return;
        btn.classList.toggle('active', autoplayEnabled);
        btn.title = autoplayEnabled ? 'Autoplay ON' : 'Autoplay OFF';
    }
    function createAutoplayButton() {
        const gc = document.querySelector('.grid-control');
        if (!gc || document.getElementById('autoplayToggle')) return;
        const btn = document.createElement('button');
        btn.id = 'autoplayToggle';
        btn.className = 'grid-btn autoplay-btn' + (autoplayEnabled ? ' active' : '');
        btn.title = autoplayEnabled ? 'Autoplay ON' : 'Autoplay OFF';
        btn.innerHTML = '▶';
        btn.addEventListener('click', toggleAutoplay);
        gc.parentElement.insertBefore(btn, gc);
    }

    let presets = [];

    const hasKey = !!localStorage.getItem(LOCAL_KEY);
    if (!navigator.onLine) {
        if (hasKey) {
            showOfflineRibbon();
            startApp();
        } else showOfflineNeedsNetOverlay();
        return;
    }
    const valid = await validateStoredKey();
    if (!valid) {
        renderActivationUI();
        return;
    }
    startApp();

    // ==================== START APP ====================
    async function startApp() {
        const GITHUB_RAW = 'https://raw.githubusercontent.com/Cyber05CC/darkpanel/main';
        const UPDATE_URL = API_BASE.replace('/api', '') + '/data/update.json';
        const LS_INSTALLED = 'darkpanel_installed_version',
            LS_LAST_APPLIED = 'darkpanel_last_applied_version';
        const BUNDLE_VERSION =
            localStorage.getItem(LS_LAST_APPLIED) || localStorage.getItem(LS_INSTALLED) || '1.0.0';
        let currentVersion = BUNDLE_VERSION;
        const SUPPORTED_TEXT_FILES = [
            'index.html',
            'css/style.css',
            'js/main.js',
            'CSXS/manifest.xml',
        ];

        let selectedPreset = null;
        const presetList = document.getElementById('presetList'),
            prevPageBtn = document.getElementById('prevPage'),
            nextPageBtn = document.getElementById('nextPage'),
            pageInfo = document.getElementById('pageInfo');
        const allTab = document.getElementById('allTab'),
            favoritesTab = document.getElementById('favoritesTab'),
            refreshBtn = document.getElementById('refresh'),
            applyBtn = document.getElementById('apply'),
            status = document.getElementById('status');
        const textPackBtn = document.getElementById('textPackBtn'),
            effectPackBtn = document.getElementById('effectPackBtn');
        const itemsPerPage = 16;
        let currentPage = 1,
            totalPages = 1,
            currentView = 'all';
        let currentPack = localStorage.getItem('currentPack') || 'text';
        let favorites = (() => {
            try {
                const parsed = JSON.parse(localStorage.getItem('favorites') || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        })();

        function dedupeNames(list) {
            const seen = {};
            return (Array.isArray(list) ? list : []).filter((item) => {
                const value = String(item || '').trim();
                if (!value) return false;
                const key = value.toLowerCase();
                if (seen[key]) return false;
                seen[key] = true;
                return true;
            });
        }

        function isEffectPresetFile(fileName) {
            return /^effect_\d+\.(aep|ffx)$/i.test(String(fileName || '').trim());
        }

        function getPresetAliases(fileName) {
            const normalized = String(fileName || '').trim();
            if (!normalized) return [];
            if (!isEffectPresetFile(normalized)) return [normalized];
            const base = normalized.replace(/\.(aep|ffx)$/i, '');
            return dedupeNames([`${base}.ffx`, `${base}.aep`]);
        }

        function persistFavorites() {
            favorites = dedupeNames(favorites);
            localStorage.setItem('favorites', JSON.stringify(favorites));
        }

        function isFavoritePreset(fileName) {
            const aliases = getPresetAliases(fileName).map((item) => item.toLowerCase());
            return favorites.some(
                (fav) => aliases.indexOf(String(fav || '').trim().toLowerCase()) !== -1
            );
        }

        persistFavorites();

        setupConnectionWatcher();
        await autoUpdateIfNeeded();
        lazyLoader = new ImprovedLazyLoader();
        init();
        setupPackDropdown();
        setupTabsUnderline();
        initIdleOverlaySystem();
        const unlockOnce = async () => {
            if (await unlockMediaPlayback()) {
                window.removeEventListener('mousedown', unlockOnce, true);
                window.removeEventListener('keydown', unlockOnce, true);
                window.removeEventListener('touchstart', unlockOnce, true);
            }
        };
        window.addEventListener('mousedown', unlockOnce, true);
        window.addEventListener('keydown', unlockOnce, true);
        window.addEventListener('touchstart', unlockOnce, true);
        const pc = document.getElementById('presetList');
        if (pc)
            pc.addEventListener('mousedown', (e) => {
                if (e.target === pc) clearPresetSelection();
            });

        function setupConnectionWatcher() {
            function showOfflineModal() {
                if (document.getElementById('dp-offline-modal')) return;
                const m = document.createElement('div');
                m.id = 'dp-offline-modal';
                m.className = 'dp-offline-modal';
                m.innerHTML = `<div class="dp-offline-card"><img src="${DP_ASSETS.loadingchaGif}" alt="offline" class="dp-offline-img"/><p class="dp-offline-text">No Internet Connection</p></div>`;
                document.body.appendChild(m);
                requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('show')));
            }
            function hideOfflineModal() {
                const m = document.getElementById('dp-offline-modal');
                if (!m) return;
                m.classList.remove('show');
                m.addEventListener('transitionend', () => m.remove(), { once: true });
                setTimeout(() => {
                    if (m.parentElement) m.remove();
                }, 600);
            }
            window.addEventListener('offline', showOfflineModal);
            window.addEventListener('online', () => {
                hideOfflineModal();
                setTimeout(() => location.reload(true), 800);
            });
            if (!navigator.onLine) showOfflineModal();
        }

        function isNewerVersion(r, l) {
            const ra = r.split('.').map(Number),
                la = l.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
                if ((ra[i] || 0) > (la[i] || 0)) return true;
                if ((ra[i] || 0) < (la[i] || 0)) return false;
            }
            return false;
        }

        async function autoUpdateIfNeeded() {
            if (!navigator.onLine || isSleeping) return;
            try {
                const res = await fetch(UPDATE_URL + '?v=' + Date.now(), { cache: 'no-store' });
                if (!res.ok) return;
                const remote = await res.json();
                if (!remote?.version || !remote.files) return;
                const installed =
                    localStorage.getItem(LS_LAST_APPLIED) ||
                    localStorage.getItem(LS_INSTALLED) ||
                    BUNDLE_VERSION;
                if (!isNewerVersion(remote.version, installed)) {
                    console.log('✅ darkPanel already latest:', installed);
                    currentVersion = installed;
                    return;
                }
                console.log('⬆ darkPanel auto-update', installed, '→', remote.version);
                let wrote = false;
                if (csInterface) wrote = await tryWriteToExtension(remote.files);
                if (wrote) {
                    localStorage.setItem(LS_INSTALLED, remote.version);
                    localStorage.setItem(LS_LAST_APPLIED, remote.version);
                    hardReloadExtension();
                    return;
                }
                localStorage.setItem(LS_LAST_APPLIED, remote.version);
                currentVersion = remote.version;
                setTimeout(() => location.reload(true), 300);
            } catch (e) {
                console.warn('autoUpdate error:', e);
            }
        }

        async function tryWriteToExtension(files) {
            if (!csInterface) return false;
            const extRoot = normalizeSystemPath(csInterface.getSystemPath(SystemPath.EXTENSION));
            for (const [rel, info] of Object.entries(files || {})) {
                if (!SUPPORTED_TEXT_FILES.includes(rel)) {
                    console.warn('autoUpdate: unsupported file in manifest, skipping hard install:', rel);
                    return false;
                }
                const text = await (
                    await fetch(info.url + '?v=' + Date.now(), { cache: 'no-store' })
                ).text();
                const dir = rel.split('/').slice(0, -1).join('/');
                if (dir) {
                    const ok = await new Promise((r) =>
                        csInterface.evalScript(
                            `(function(){function e(p){var n=p.replace(/\\\\\\\\/g,"/"),a=n.split("/"),c=a.shift();if(c==="")c="/";while(a.length){var t=a.shift();if(!t)continue;c=c==="/"?c+t:c+"/"+t;var f=new Folder(c);if(!f.exists&&!f.create())return"ERR";}return"OK";}return e("${(extRoot + '/' + dir).replace(/"/g, '\\"')}");})();`,
                            (res) => r(res === 'OK')
                        )
                    );
                    if (!ok) return false;
                }
                const wrote = await writeFileInChunks(`${extRoot}/${rel}`, text);
                if (!wrote) return false;
            }
            return true;
        }
        async function writeFileInChunks(targetFile, text) {
            if (!csInterface) return false;
            const cs = 30000;
            let mode = 'w';
            for (let i = 0; i < text.length; i += cs) {
                const ok = await new Promise((r) =>
                    csInterface.evalScript(
                        `(function(){try{var f=new File("${targetFile.replace(/"/g, '\\"')}");f.encoding="UTF-8";f.open("${mode}");f.write(${JSON.stringify(text.substring(i, i + cs))});f.close();return"OK";}catch(e){return"ERR";}})();`,
                        (res) => r(res === 'OK')
                    )
                );
                if (!ok) return false;
                mode = 'a';
            }
            return true;
        }
        function hardReloadExtension() {
            const keep = {
                favorites: localStorage.getItem('favorites'),
                currentPack: localStorage.getItem('currentPack'),
                gridCols: localStorage.getItem('gridCols'),
                installed: localStorage.getItem(LS_INSTALLED),
                lastApplied: localStorage.getItem(LS_LAST_APPLIED),
                license: localStorage.getItem(LOCAL_KEY),
            };
            sessionStorage.clear();
            localStorage.clear();
            Object.entries(keep).forEach(([k, v]) => {
                if (v)
                    localStorage.setItem(
                        k === 'installed'
                            ? LS_INSTALLED
                            : k === 'lastApplied'
                              ? LS_LAST_APPLIED
                              : k === 'license'
                                ? LOCAL_KEY
                                : k,
                        v
                    );
            });
            setTimeout(() => location.reload(true), 800);
        }

        function init() {
            updatePackUI();
            createPresets();
            setupEventListeners();
            setupGridControl();
            createAutoplayButton();
            if (status) status.textContent = 'No items selected';
        }
        function updatePackUI() {
            const pb = document.querySelector('.pack-btn');
            if (!pb) return;
            const ls = pb.querySelector('.pack-label');
            if (!ls) return;
            ls.textContent = currentPack === 'text' ? 'Text Pack' : 'Effect Pack';
            textPackBtn?.classList.toggle('active', currentPack === 'text');
            effectPackBtn?.classList.toggle('active', currentPack !== 'text');
        }

        async function createPresets() {
            if (!presetList) return;
            presetList.innerHTML =
                '<div class="loading-placeholder"><img src="' +
                DP_ASSETS.loadingchaGif +
                '" alt="loading"/></div>';
            let presetIndexes = [];
            try {
                const res = await fetch(`${GITHUB_RAW}/assets/videos/list.json?v=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    presetIndexes = Array.isArray(data[currentPack])
                        ? data[currentPack]
                              .slice()
                              .sort(
                                  (a, b) =>
                                      (typeof a === 'object' ? a.n : a) -
                                      (typeof b === 'object' ? b.n : b)
                              )
                        : [];
                }
            } catch (e) {}
            presetList.innerHTML = '';
            const packType = currentPack === 'text' ? 'Text' : 'Effect';
            let uiCounter = 1;
            const lazyImages = [];
            presetIndexes.forEach((entry) => {
                const preset = document.createElement('div');
                preset.className = 'preset';
                let realNum, ext;
                if (typeof entry === 'object') {
                    realNum = entry.n;
                    ext = entry.ext || '.ffx';
                } else {
                    realNum = entry;
                    ext = '.ffx';
                }
                const fileName = `${currentPack}_${realNum}${ext}`;
                preset.dataset.file = fileName;
                preset.innerHTML = `<div class="preset-thumb"><div class="image-placeholder"></div><img class="preset-img" data-src="${GITHUB_RAW}/assets/videos/${currentPack}_${realNum}.webp" alt="" draggable="false"/><input type="checkbox" class="favorite-check" data-file="${fileName}"></div><div class="preset-name">${packType} ${uiCounter}</div>`;
                presetList.appendChild(preset);
                const img = preset.querySelector('.preset-img');
                if (img) lazyImages.push(img);
                uiCounter++;
            });
            setTimeout(() => {
                if (lazyLoader) lazyLoader.observe(lazyImages);
            }, 100);
            presets = document.querySelectorAll('.preset');
            initializeFavorites();
            initPresetPreviews();
            showPage(1);
        }
        function initPresetPreviews() {
            document.querySelectorAll('.preset').forEach((preset) => {
                preset.addEventListener('click', (e) => {
                    if (e.target.classList.contains('favorite-check')) return;
                    if (selectedPresetEl && selectedPresetEl !== preset)
                        selectedPresetEl.classList.remove('selected');
                    if (selectedPresetEl === preset) {
                        preset.classList.remove('selected');
                        selectedPresetEl = null;
                        selectedPreset = null;
                        if (status) status.textContent = 'No items selected';
                        return;
                    }
                    preset.classList.add('selected');
                    selectedPresetEl = preset;
                    selectedPreset = preset.dataset.file;
                    if (status)
                        status.textContent = `Selected: ${preset.querySelector('.preset-name').textContent}`;
                });
            });
            initAutoplayObserver();
        }
        function initializeFavorites() {
            presets.forEach((p) => {
                const f = p.dataset.file,
                    cb = p.querySelector('.favorite-check');
                if (!cb) return;
                cb.checked = isFavoritePreset(f);
                cb.addEventListener('change', function () {
                    toggleFavorite(f, this.checked);
                });
            });
        }
        function toggleFavorite(file, isFav) {
            const aliases = getPresetAliases(file).map((item) => item.toLowerCase());
            favorites = favorites.filter(
                (fav) => aliases.indexOf(String(fav || '').trim().toLowerCase()) === -1
            );
            if (isFav) favorites.push(file);
            persistFavorites();
            if (currentView === 'favorites') showPage(1);
        }
        function filterPresets() {
            return Array.from(presets).filter(
                (p) => currentView === 'all' || isFavoritePreset(p.dataset.file)
            );
        }
        function showPage(page) {
            if (isSleeping) return;
            const filtered = filterPresets();
            currentPage = page;
            totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
            presets.forEach((p) => (p.style.display = 'none'));
            const es = document.getElementById('dp-empty-state');
            if (es) es.remove();
            if (filtered.length === 0) {
                const e = document.createElement('div');
                e.id = 'dp-empty-state';
                e.className = 'dp-empty-state';
                e.innerHTML = `<img src="${DP_ASSETS.loadingGif}" alt="empty" class="empty-state-img"/><p>${currentView === 'favorites' ? 'No pinned presets' : 'No presets found'}</p>`;
                presetList.appendChild(e);
                return;
            }
            filtered
                .slice((page - 1) * itemsPerPage, page * itemsPerPage)
                .forEach((p) => (p.style.display = 'block'));
            if (pageInfo) pageInfo.textContent = `Page : ${currentPage}`;
            if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
            if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
            setTimeout(() => {
                observeVisiblePresets();
                requestAnimationFrame(() => setTimeout(forceLoadVisiblePresets, 300));
            }, 50);
        }
        function clearPresetSelection() {
            presets.forEach((p) => p.classList.remove('selected'));
            selectedPreset = null;
            if (status) status.textContent = 'No items selected';
        }
        function setupGridControl() {
            const btns = document.querySelectorAll('.grid-btn'),
                pc = document.querySelector('.presets');
            if (!pc || !btns.length) return;
            let cols = parseInt(localStorage.getItem('gridCols') || '2', 10);
            function apply(c, user) {
                pc.style.gridTemplateColumns = `repeat(${c},1fr)`;
                if (user) {
                    cols = c;
                    localStorage.setItem('gridCols', String(c));
                }
                btns.forEach((b) =>
                    b.classList.toggle('active', parseInt(b.dataset.cols, 10) === c)
                );
            }
            btns.forEach((b) =>
                b.addEventListener('click', () => apply(parseInt(b.dataset.cols, 10), true))
            );
            function auto() {
                const w = window.innerWidth;
                if (w <= 420) apply(1);
                else if (w <= 640) apply(2);
                else if (w <= 720) apply(3);
                else apply(cols);
            }
            auto();
            let rt;
            window.addEventListener('resize', () => {
                clearTimeout(rt);
                rt = setTimeout(auto, 250);
            });
        }

        function getPresetFetchCandidates(fileName) {
            const normalized = String(fileName || '').trim();
            if (!normalized) return [];
            if (!isEffectPresetFile(normalized)) return [normalized];
            const base = normalized.replace(/\.(aep|ffx)$/i, '');
            // Importing AEP presets can break AE's undo chain, so we prefer the FFX twin first.
            return dedupeNames([
                `${base}.ffx`,
                /\.ffx$/i.test(normalized) ? `${base}.aep` : normalized,
            ]);
        }

        async function fetchPresetAsset(fileName) {
            const candidates = getPresetFetchCandidates(fileName);
            for (const candidate of candidates) {
                const res = await fetch(`${GITHUB_RAW}/presets/${candidate}`, {
                    cache: 'no-store',
                });
                if (res.ok) {
                    return { fileName: candidate, blob: await res.blob() };
                }
            }
            throw new Error('Preset not found');
        }

        async function tryApplyLocalPreset(fileName) {
            if (!csInterface) return '';
            return String((await evalES(`applyPreset("${escES(fileName)}")`)) || '');
        }

        // ==================== APPLY PRESET ====================
        async function applyPreset() {
            if (!selectedPreset) {
                showMiniToast('Select a preset first!');
                return;
            }
            try {
                const candidates = getPresetFetchCandidates(selectedPreset);
                for (const candidate of candidates) {
                    if (!/\.ffx$/i.test(candidate)) continue;
                    const localResult = await tryApplyLocalPreset(candidate);
                    if (localResult.indexOf('Successfully applied') !== -1) {
                        showMiniToast('Done');
                        return;
                    }
                    if (
                        localResult &&
                        localResult.indexOf('Preset file not found') === -1 &&
                        localResult.indexOf('Cannot locate extension folder') === -1
                    ) {
                        showMiniToast(localResult.replace(/^Error:\s*/, ''));
                        return;
                    }
                }

                const { fileName: resolvedPreset, blob } = await fetchPresetAsset(selectedPreset);
                const isAEP = resolvedPreset.toLowerCase().endsWith('.aep'),
                    ext = isAEP ? '.aep' : '.ffx';
                const base64 =
                    await new Promise((r, j) => {
                        const rd = new FileReader();
                        rd.onload = () => r(String(rd.result).split(',')[1]);
                        rd.onerror = j;
                        rd.readAsDataURL(blob);
                    });
                const cs = 20000,
                    chunks = [];
                for (let i = 0; i < base64.length; i += cs) chunks.push(base64.slice(i, i + cs));
                if (!csInterface) return;
                csInterface.evalScript(
                    `(function(){try{var p=Folder.temp.fsName+"/dp_temp${ext}";var f=new File(p);f.encoding="BINARY";f.open("w");f.close();return p;}catch(e){return"ERR";}})()`,
                    async (tempPath) => {
                        if (tempPath === 'ERR') return;
                        const ep = tempPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                        for (const chunk of chunks)
                            await new Promise((r) =>
                                csInterface.evalScript(
                                    `(function(){var f=new File("${ep}");f.encoding="BINARY";f.open("a");function b64d(s){var k="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",o="",b=0,x=0,c;for(var i=0;i<s.length;i++){c=s.charAt(i);if(c=='=')break;var v=k.indexOf(c);if(v<0)continue;b=(b<<6)|v;x+=6;if(x>=8){x-=8;o+=String.fromCharCode((b>>x)&0xFF);}}return o;}f.write(b64d("${chunk}"));f.close();})()`,
                                    r
                                )
                            );
                        if (!isAEP) {
                            const presetKind = /^text_/i.test(resolvedPreset) ? 'text' : 'effect';
                            csInterface.evalScript(
                                `applyPresetFromFilePath("${ep}", ${
                                    presetKind === 'effect' ? 'true' : 'false'
                                }, "${presetKind}")`,
                                (r) => {
                                    const out = String(r || '');
                                    showMiniToast(
                                        out.indexOf('Successfully applied') !== -1
                                            ? 'Done'
                                            : out.replace('Error: ', '') || 'Apply failed'
                                    );
                                }
                            );
                        } else {
                            // AEP apply logic (same as before - abbreviated for space)
                            const evalP = (s) => new Promise((r) => csInterface.evalScript(s, r));
                            try {
                                const r1 = String(
                                    (await evalP(
                                        `(function(){try{var f=new File("${ep}");if(!f.exists)return"ERR:File missing";var comp=app.project.activeItem;if(!comp||!(comp instanceof CompItem))return"ERR:No Comp";var sel=comp.selectedLayers;if(sel.length===0)return"ERR:No Layer";for(var c=app.project.numItems;c>=1;c--){try{var itm=app.project.item(c);if(itm.name==="dp_temp.aep"||itm.name==="dp_temp")itm.remove();}catch(e){}}var io=new ImportOptions(f);var imported=app.project.importFile(io);var srcComp=null;if(imported instanceof CompItem)srcComp=imported;else if(imported instanceof FolderItem){for(var i=1;i<=imported.numItems;i++){if(imported.item(i) instanceof CompItem){srcComp=imported.item(i);break;}}}if(!srcComp||srcComp.numLayers===0)return"ERR:Bad AEP";var srcLayer=srcComp.layer(1);return"OK:"+srcComp.id+":"+sel[0].index+":"+(srcLayer.adjustmentLayer?1:0)+":"+(sel[0].source?1:0)+":"+imported.id;}catch(e){return"ERR:"+e;}})();`
                                    )) || ''
                                );
                                if (!r1 || r1.indexOf('ERR') === 0)
                                    throw new Error(
                                        (r1 || 'ERR:No response').replace('ERR:', '')
                                    );
                                const p = r1.split(':'),
                                    srcId = p[1],
                                    tIdx = p[2],
                                    isAdj = p[3] === '1',
                                    hasSource = p[4] === '1',
                                    importedId = p[5];
                                const r2 = String(
                                    (await evalP(
                                        `(function(){var u=false;try{var comp=app.project.activeItem;if(!comp)return"Error";var srcComp=null;for(var i=1;i<=app.project.numItems;i++){if(app.project.item(i).id==${srcId}){srcComp=app.project.item(i);break;}}if(!srcComp)return"Error";var imp=null;for(var j=1;j<=app.project.numItems;j++){if(app.project.item(j).id==${importedId}){imp=app.project.item(j);break;}}var tl=comp.layer(${tIdx});if(!tl)return"Error";app.beginUndoGroup("Apply Smart Preset");u=true;var dpF=null;for(var k=1;k<=app.project.numItems;k++){if(app.project.item(k) instanceof FolderItem&&app.project.item(k).name==="darkPanel"){dpF=app.project.item(k);break;}}if(!dpF)dpF=app.project.items.addFolder("darkPanel");if(imp)imp.parentFolder=dpF;try{srcComp.parentFolder=dpF;}catch(e){}if(${isAdj}){var sl=srcComp.layer(1);var se=sl.property("ADBE Effect Parade");var al=comp.layers.addSolid([1,1,1],srcComp.name||"Adjustment",comp.width,comp.height,1,comp.duration);al.adjustmentLayer=true;if(se&&se.numProperties>0){var ae=al.property("ADBE Effect Parade");for(var ef=1;ef<=se.numProperties;ef++){try{var ne=ae.addProperty(se.property(ef).matchName);}catch(e){}}}al.startTime=tl.startTime;al.inPoint=tl.inPoint;al.outPoint=tl.outPoint;if(al.index>tl.index)al.moveBefore(comp.layer(tl.index));for(var d=1;d<=comp.numLayers;d++)comp.layer(d).selected=false;al.selected=true;}else if(${hasSource}){var nl=comp.layers.add(srcComp);nl.collapseTransformation=true;nl.startTime=tl.startTime;nl.inPoint=tl.inPoint;nl.outPoint=tl.outPoint;if(tl.index>1)nl.moveAfter(comp.layer(tl.index));tl.remove();for(var dd=1;dd<=comp.numLayers;dd++)comp.layer(dd).selected=false;nl.selected=true;}else{var nl2=comp.layers.add(srcComp);nl2.startTime=comp.time;nl2.collapseTransformation=true;for(var d2=1;d2<=comp.numLayers;d2++)comp.layer(d2).selected=false;nl2.selected=true;}try{new File("${ep}").remove();}catch(e){}app.endUndoGroup();u=false;return"Success";}catch(err){if(u)try{app.endUndoGroup();}catch(x){}return"Error:"+err;}})();`
                                    )) || ''
                                );
                                showMiniToast(
                                    r2.indexOf('Success') !== -1
                                        ? 'EFFECTS ADDED'
                                        : r2.replace('Error:', '') || 'Apply failed'
                                );
                            } catch (e) {
                                showMiniToast(String(e.message || e).replace('Error: ', ''));
                            }
                        }
                    }
                );
            } catch (err) {
                console.error('Apply error:', err);
            }
        }

        // ==================== EVENT LISTENERS ====================
        function setupEventListeners() {
            prevPageBtn?.addEventListener(
                'click',
                () => currentPage > 1 && showPage(currentPage - 1)
            );
            nextPageBtn?.addEventListener(
                'click',
                () => currentPage < totalPages && showPage(currentPage + 1)
            );
            refreshBtn?.addEventListener('click', () => {
                selectedPreset = null;
                presets.forEach((p) => p.classList.remove('selected'));
                if (status) status.textContent = 'No items selected';
                showPage(1);
            });
            applyBtn?.addEventListener('click', applyPreset);
            allTab?.addEventListener('click', () => switchTab('all'));
            favoritesTab?.addEventListener('click', () => switchTab('favorites'));
            document
                .getElementById('captionTab')
                ?.addEventListener('click', () => switchTab('caption'));
            textPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                switchPack('text');
            });
            effectPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                switchPack('effect');
            });
            // Owner panel
            document.getElementById('ownerBtn')?.addEventListener('click', () => {
                closeInfoModal();
                const op = document.getElementById('dp-owner-panel');
                if (op) {
                    op.classList.add('show');
                    patchExistingStaticImgs();
                    fetchSubscriberCount();
                }
            });
            document.getElementById('ownerBackBtn')?.addEventListener('click', () => {
                document.getElementById('dp-owner-panel')?.classList.remove('show');
            });
            document.querySelectorAll('.owner-link-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const url = btn.dataset.url;
                    if (!url) return;
                    try {
                        csInterface
                            ? csInterface.openURLInDefaultBrowser(url)
                            : window.open(url, '_blank');
                    } catch (e) {
                        window.open(url, '_blank');
                    }
                });
            });
            // Check update
            const cub = document.getElementById('checkUpdateBtn');
            if (cub)
                cub.addEventListener('click', async () => {
                    if (!navigator.onLine) {
                        showMiniToast('No internet');
                        return;
                    }
                    cub.textContent = 'Checking…';
                    cub.disabled = true;
                    try {
                        const res = await fetch(UPDATE_URL + '?v=' + Date.now(), {
                            cache: 'no-store',
                        });
                        if (!res.ok) throw 0;
                        const r = await res.json();
                        const lv = localStorage.getItem(LS_LAST_APPLIED) || '1.0.0';
                        if (isNewerVersion(r.version, lv)) {
                            showMiniToast('Updating…');
                            await autoUpdateIfNeeded();
                        } else showMiniToast('Up to date ✔');
                    } catch (e) {
                        showMiniToast('Update failed');
                    } finally {
                        cub.textContent = 'Check update';
                        cub.disabled = false;
                    }
                });
        }
        async function fetchSubscriberCount() {
            const el = document.getElementById('owner-sub-count');
            if (!el) return;
            el.textContent = '...';
            try {
                const res = await fetch(
                    API_BASE.replace('/api', '') + '/api/telegram/subscribers',
                    { cache: 'no-store' }
                );
                const data = await res.json();
                el.textContent = data.count ? data.count.toLocaleString() : '—';
            } catch (e) {
                el.textContent = '—';
            }
        }

        // ========================================================================
        // ==================== CAPTION SYSTEM (CLEAN) ==========================
        // ========================================================================
        const CAPTION_TEMPLATES = [
            {
                id: 'clean',
                name: 'Clean',
                font: 'ArialMT',
                fontSize: 80,
                fillColor: [1, 1, 1],
                strokeColor: null,
                strokeWidth: 0,
                position: 'bottom',
                animation: 'none',
            },
            {
                id: 'bold-stroke',
                name: 'Bold Stroke',
                font: 'Arial-BoldMT',
                fontSize: 90,
                fillColor: [1, 1, 1],
                strokeColor: [0, 0, 0],
                strokeWidth: 5,
                position: 'bottom',
                animation: 'pop',
            },
            {
                id: 'subtitle',
                name: 'Subtitle',
                font: 'ArialMT',
                fontSize: 60,
                fillColor: [1, 1, 1],
                strokeColor: null,
                strokeWidth: 0,
                position: 'bottom',
                animation: 'none',
            },
            {
                id: 'neon',
                name: 'Neon',
                font: 'Arial-BoldMT',
                fontSize: 85,
                fillColor: [0.47, 0.54, 0.94],
                strokeColor: null,
                strokeWidth: 0,
                position: 'center',
                animation: 'glow',
            },
            {
                id: 'typewriter',
                name: 'Typewriter',
                font: 'CourierNewPSMT',
                fontSize: 70,
                fillColor: [1, 1, 1],
                strokeColor: null,
                strokeWidth: 0,
                position: 'bottom',
                animation: 'typewriter',
            },
            {
                id: 'cinematic',
                name: 'Cinematic',
                font: 'Georgia',
                fontSize: 75,
                fillColor: [1, 0.95, 0.8],
                strokeColor: null,
                strokeWidth: 0,
                position: 'bottom',
                animation: 'fade',
            },
            {
                id: 'impact',
                name: 'Impact',
                font: 'Impact',
                fontSize: 100,
                fillColor: [1, 1, 0],
                strokeColor: [0, 0, 0],
                strokeWidth: 6,
                position: 'center',
                animation: 'pop',
            },
            {
                id: 'minimal',
                name: 'Minimal',
                font: 'ArialMT',
                fontSize: 55,
                fillColor: [0.85, 0.85, 0.85],
                strokeColor: null,
                strokeWidth: 0,
                position: 'bottom',
                animation: 'fade',
            },
            {
                id: 'tiktok',
                name: 'TikTok',
                font: 'Arial-BoldMT',
                fontSize: 95,
                fillColor: [1, 1, 1],
                strokeColor: [0, 0, 0],
                strokeWidth: 8,
                position: 'center',
                animation: 'bounce',
            },
            {
                id: 'gradient',
                name: 'Gradient',
                font: 'Arial-BoldMT',
                fontSize: 85,
                fillColor: [1, 1, 1],
                strokeColor: [0.47, 0.54, 0.94],
                strokeWidth: 3,
                position: 'bottom',
                animation: 'slide',
            },
            {
                id: 'retro',
                name: 'Retro',
                font: 'CourierNewPS-BoldMT',
                fontSize: 70,
                fillColor: [0, 1, 0.5],
                strokeColor: null,
                strokeWidth: 0,
                position: 'bottom',
                animation: 'typewriter',
            },
            {
                id: 'fire',
                name: 'Fire',
                font: 'Impact',
                fontSize: 95,
                fillColor: [1, 0.3, 0],
                strokeColor: [1, 0.8, 0],
                strokeWidth: 4,
                position: 'center',
                animation: 'bounce',
            },
        ];

        let captionWords = [];
        let selectedTemplate = CAPTION_TEMPLATES[0];
        let isCaptionGenerating = false;
        let captionSyncTimer = null;
        let captionCompInfo = null; // saqlangan comp ma'lumotlari

        // --- GENERATE CAPTION ---
        async function generateCaption() {
            if (isCaptionGenerating) return;
            if (!csInterface) {
                showMiniToast('AE environment kerak');
                return;
            }
            isCaptionGenerating = true;
            updateCaptionUI('loading', 'Analyzing audio...');
            try {
                // 1) AE dan audio layer info
                const audioInfo = await new Promise((r) =>
                    csInterface.evalScript(
                        "(function(){try{var comp=app.project.activeItem;if(!comp||!(comp instanceof CompItem))return JSON.stringify({error:'No active composition'});var sel=comp.selectedLayers;if(sel.length===0)return JSON.stringify({error:'Select an audio layer'});var layer=sel[0];if(!layer.source)return JSON.stringify({error:'Layer has no source'});var src=layer.source;var fp='';if(src.file)fp=src.file.fsName;if(!fp)return JSON.stringify({error:'Cannot find audio file path'});return JSON.stringify({path:fp,duration:layer.outPoint-layer.inPoint,startTime:layer.inPoint,layerStart:layer.startTime,compWidth:comp.width,compHeight:comp.height,compFPS:comp.frameRate,layerIndex:layer.index});}catch(e){return JSON.stringify({error:e.toString()});}})()",
                        r
                    )
                );
                const info = JSON.parse(audioInfo);
                if (info.error) throw new Error(info.error);
                captionCompInfo = info;

                // 2) Audio faylni o'qish
                updateCaptionUI('loading', 'Reading audio file...');
                let fileUrl = info.path.replace(/\\/g, '/');
                if (!fileUrl.startsWith('/')) fileUrl = '/' + fileUrl;
                fileUrl = 'file://' + fileUrl;
                const fileResponse = await fetch(fileUrl);
                if (!fileResponse.ok) throw new Error('Cannot read audio file');
                const audioBlob = await fileResponse.blob();
                if (audioBlob.size > 25 * 1024 * 1024)
                    throw new Error('Audio too large (max 25MB)');
                if (audioBlob.size < 1024) throw new Error('Audio file too small or empty');
                // 3) Groq Whisper API
                updateCaptionUI('loading', 'Transcribing audio...');
                const ext = info.path.split('.').pop().toLowerCase();
                const mimeTypes = {
                    wav: 'audio/wav',
                    mp3: 'audio/mpeg',
                    mp4: 'audio/mp4',
                    m4a: 'audio/mp4',
                    ogg: 'audio/ogg',
                    flac: 'audio/flac',
                    aac: 'audio/aac',
                    webm: 'audio/webm',
                };
                const formData = new FormData();
                formData.append(
                    'file',
                    new Blob([audioBlob], { type: mimeTypes[ext] || 'audio/wav' }),
                    'audio.' + ext
                );
                formData.append('model', 'whisper-large-v3');
                formData.append('language', 'uz');
                formData.append('response_format', 'verbose_json');
                formData.append('timestamp_granularities[]', 'word');
                formData.append(
                    'prompt',
                    "Oʻzbek tilida suhbat. Bugun biz sizlar bilan birga yangi mavzu haqida gaplashamiz. Keling koʻrib chiqamiz. Assalomu alaykum. Xo'sh, demak, shunday qilib, albatta, masalan, chunki, shuning uchun, keyin, avval, hozir, endi, lekin, ammo, balki, ehtimol, qanday, nima, qachon, qaerda, nega, kim."
                );

                const groqKey = await getGroqKey();
                const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + groqKey },
                    body: formData,
                });
                if (!groqRes.ok) {
                    const e = await groqRes.text();
                    throw new Error(JSON.parse(e).error?.message || 'Whisper error');
                }
                const data = await groqRes.json();
                if (!data.words || data.words.length === 0) throw new Error('No speech detected');

                // 4) So'zlarni saqlash va editor ko'rsatish
                captionWords = data.words.map((w) => ({
                    word: w.word,
                    start: w.start,
                    end: w.end,
                }));

                // Hallyutsinatsiya filtrlash (faqat shovqin, audio dan tashqari so'zlar)
                var sourceStart = info.startTime - (info.layerStart || 0);
                var sourceEnd = sourceStart + info.duration;
                captionWords = captionWords.filter(function (w) {
                    if (w.start < sourceStart - 0.1 || w.start > sourceEnd + 0.1) return false;
                    if (w.end - w.start < 0.05) return false;
                    if (!w.word || w.word.trim().length === 0) return false;
                    if (/^[.,!?…\-–:;]+$/.test(w.word.trim())) return false;
                    return true;
                });
                // Timestamplarni layer boshiga nisbatan tuzatish
                captionWords = captionWords.map(function (w) {
                    return { word: w.word, start: w.start - sourceStart, end: w.end - sourceStart };
                });

                // 5) AE da caption layerlar yaratish
                updateCaptionUI('loading', 'Creating ' + captionWords.length + ' captions...');
                await createCaptionLayers(info, captionWords, selectedTemplate);

                // 6) Editor ko'rsatish — foydalanuvchi keyin tuzatishi mumkin
                updateCaptionUI('success', captionWords.length + ' captions created. Edit below:');
                showCaptionEditor(captionWords);
                startCaptionSync();
            } catch (err) {
                console.error('Caption error:', err);
                updateCaptionUI('error', err.message);
            } finally {
                isCaptionGenerating = false;
            }
        }

        async function getGroqKey() {
            const GROQ_TTL_MS = 60 * 60 * 1000;
            try {
                const raw = localStorage.getItem('dp_groq_key');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.key && Date.now() - parsed.ts < GROQ_TTL_MS) return parsed.key;
                }
            } catch (e) {}
            try {
                const res = await fetch(API_BASE.replace('/api', '') + '/api/caption/key');
                if (res.ok) {
                    const d = await res.json();
                    if (d.key) {
                        try {
                            localStorage.setItem(
                                'dp_groq_key',
                                JSON.stringify({ key: d.key, ts: Date.now() })
                            );
                        } catch (e) {}
                        return d.key;
                    }
                }
            } catch (e) {}
            throw new Error('API key not configured');
        }

        // --- EDITOR UI ---
        function showCaptionEditor(words) {
            const editor = document.getElementById('caption-editor');
            const wordList = document.getElementById('captionWordList');
            if (!editor || !wordList) return;
            wordList.innerHTML = '';
            words.forEach((w, i) => {
                const span = document.createElement('span');
                span.className = 'caption-word-item';
                span.contentEditable = 'true';
                span.textContent = w.word;
                span.dataset.index = i;
                span.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        span.blur();
                    }
                });
                wordList.appendChild(span);
            });
            editor.classList.remove('hidden');
        }

        // --- APPLY EDITED CAPTIONS ---
        async function applyCaptionEdits() {
            const wordItems = document.querySelectorAll('.caption-word-item');
            if (wordItems.length === 0 || !captionWords.length) return;

            // O'zgargan so'zlarni aniqlash
            const changes = [];
            wordItems.forEach((span) => {
                const idx = parseInt(span.dataset.index);
                if (idx >= 0 && idx < captionWords.length) {
                    const newWord = span.textContent.trim();
                    if (newWord && newWord !== captionWords[idx].word) {
                        changes.push({
                            idx: idx,
                            oldWord: captionWords[idx].word,
                            newWord: newWord,
                            start: captionWords[idx].start,
                        });
                        captionWords[idx].word = newWord;
                    }
                }
            });

            if (changes.length === 0) {
                showMiniToast('No changes to apply');
                return;
            }

            isCaptionGenerating = true;
            updateCaptionUI('loading', 'Updating ' + changes.length + ' caption(s)...');

            try {
                const startOffset = captionCompInfo ? captionCompInfo.startTime || 0 : 0;
                // Har bir o'zgargan so'zni AE da topib yangilash
                for (const ch of changes) {
                    const targetTime = startOffset + ch.start;
                    const wordLiteral = JSON.stringify(ch.newWord);
                    const nameLiteral = JSON.stringify('Cap: ' + ch.newWord);
                    await new Promise((r) =>
                        csInterface.evalScript(
                            `(function(){
                try {
                    var comp = app.project.activeItem;
                    if (!comp) return 'Error';
                    app.beginUndoGroup('Edit Caption');
                    for (var i = 1; i <= comp.numLayers; i++) {
                        var l = comp.layer(i);
                        if (l.name.indexOf('Cap: ') !== 0) continue;
                        if (Math.abs(l.inPoint - ${targetTime}) < 0.15) {
                            var tp = l.property('ADBE Text Properties').property('ADBE Text Document');
                            var td = tp.value;
                            td.text = ${wordLiteral};
                            tp.setValue(td);
                            l.name = ${nameLiteral};
                            break;
                        }
                    }
                    app.endUndoGroup();
                    return 'OK';
                } catch(e) { try { app.endUndoGroup(); } catch(x){} return 'Error'; }
            })()`,
                            r
                        )
                    );
                }
                updateCaptionUI('success', changes.length + ' caption(s) updated!');
            } catch (err) {
                updateCaptionUI('error', err.message);
            } finally {
                isCaptionGenerating = false;
            }
        }
        // --- TIMELINE SYNC (AE dan tanlangan caption ni editor da ko'rsatish) ---
        function startCaptionSync() {
            if (captionSyncTimer) clearInterval(captionSyncTimer);
            captionSyncTimer = setInterval(async () => {
                if (!csInterface || currentView !== 'caption') {
                    clearInterval(captionSyncTimer);
                    return;
                }
                try {
                    const res = await new Promise((r) =>
                        csInterface.evalScript(
                            "(function(){try{var comp=app.project.activeItem;if(!comp)return'';var sel=comp.selectedLayers;if(sel.length!==1)return'';var l=sel[0];if(l.name.indexOf('Cap: ')!==0)return'';var tp=l.property('ADBE Text Properties').property('ADBE Text Document');return JSON.stringify({name:l.name,text:tp.value.text,index:l.index,inPoint:l.inPoint,outPoint:l.outPoint});}catch(e){return'';}})()",
                            r
                        )
                    );
                    if (!res) return;
                    const info = JSON.parse(res);
                    highlightEditorWord(info);
                } catch (e) {}
            }, 800);
        }

        function stopCaptionSync() {
            if (captionSyncTimer) {
                clearInterval(captionSyncTimer);
                captionSyncTimer = null;
            }
        }

        function highlightEditorWord(info) {
            const items = document.querySelectorAll('.caption-word-item');
            items.forEach((span) => {
                const idx = parseInt(span.dataset.index);
                if (idx >= 0 && idx < captionWords.length) {
                    const w = captionWords[idx];
                    // Timeline dagi caption bilan mos kelishini tekshirish
                    const isMatch =
                        Math.abs(w.start - (info.inPoint - (captionCompInfo?.startTime || 0))) <
                        0.15;
                    span.classList.toggle('caption-word-active', isMatch);
                }
            });
        }

        // --- CREATE CAPTION LAYERS IN AE ---
        async function createCaptionLayers(compInfo, words, template) {
            const t = template;
            let yPos =
                t.position === 'top'
                    ? compInfo.compHeight * 0.15
                    : t.position === 'center'
                      ? compInfo.compHeight * 0.5
                      : compInfo.compHeight * 0.82;
            const animations = {
                none: '',
                typewriter: '',
                glow: '',
                fade: 'var fi=0.15;var fo=0.15;var d=thisLayer.outPoint-thisLayer.inPoint;var t=time-thisLayer.inPoint;if(t<fi)linear(t,0,fi,0,100);else if(t>d-fo)linear(t,d-fo,d,100,0);else 100;',
                pop: 'var t=time-thisLayer.inPoint;if(t<0.12)ease(t,0,0.12,0,110);else if(t<0.2)ease(t,0.12,0.2,110,100);else 100;',
                bounce: 'var t=time-thisLayer.inPoint;var a=20;var f=3;var d=5;if(t<0)0;else{100+a*Math.sin(f*t*Math.PI*2)*Math.exp(-d*t);}',
                slide: 'var t=time-thisLayer.inPoint;if(t<0.2)ease(t,0,0.2,value+[0,50],value);else value;',
            };
            const wJSON = JSON.stringify(words),
                ew = wJSON.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
            const strokeCode = t.strokeColor
                ? `textDoc.applyStroke=true;textDoc.strokeColor=[${t.strokeColor.join(',')}];textDoc.strokeWidth=${t.strokeWidth};textDoc.strokeOverFill=false;`
                : '';
            const scaleExpr =
                t.animation === 'pop' || t.animation === 'bounce' ? animations[t.animation] : '';
            const opacityExpr = t.animation === 'fade' ? animations.fade : '';
            const posExpr = t.animation === 'slide' ? animations.slide : '';

            const script = `(function(){try{app.beginUndoGroup('AI Caption');var comp=app.project.activeItem;if(!comp)return'Error:No comp';var words=JSON.parse('${ew}');var startOffset=comp.layer(${compInfo.layerIndex}).inPoint;for(var i=0;i<words.length;i++){var w=words[i];var ws=startOffset+w.start;var we=startOffset+w.end;if(we-ws<0.1)we=ws+0.1;var tl=comp.layers.addText(w.word);tl.name='Cap: '+w.word;tl.startTime=ws;tl.inPoint=ws;tl.outPoint=we+0.05;var tp=tl.property('ADBE Text Properties').property('ADBE Text Document');var td=tp.value;td.font='${t.font}';td.fontSize=${t.fontSize};td.fillColor=[${t.fillColor.join(',')}];td.applyFill=true;td.justification=ParagraphJustification.CENTER_JUSTIFY;${strokeCode}tp.setValue(td);tl.property('ADBE Transform Group').property('ADBE Position').setValue([${compInfo.compWidth / 2},${yPos}]);${scaleExpr ? "try{tl.property('ADBE Transform Group').property('ADBE Scale').expression='" + scaleExpr.replace(/'/g, "\\'") + "';}catch(e){}" : ''}${opacityExpr ? "try{tl.property('ADBE Transform Group').property('ADBE Opacity').expression='" + opacityExpr.replace(/'/g, "\\'") + "';}catch(e){}" : ''}${posExpr ? "try{tl.property('ADBE Transform Group').property('ADBE Position').expression='" + posExpr.replace(/'/g, "\\'") + "';}catch(e){}" : ''}}app.endUndoGroup();return'Success:'+words.length;}catch(e){try{app.endUndoGroup();}catch(x){}return'Error:'+e;}})();`;
            const result = await new Promise((r) => csInterface.evalScript(script, r));
            if (result.indexOf('Error') === 0) throw new Error(result.replace('Error:', ''));
        }

        // --- REGENERATE WITH TEMPLATE ---
        async function regenerateCaption() {
            if (!captionWords.length) {
                showMiniToast('Generate caption first');
                return;
            }
            if (isCaptionGenerating) return;
            isCaptionGenerating = true;
            updateCaptionUI('loading', 'Applying template...');
            try {
                await new Promise((r) =>
                    csInterface.evalScript(
                        "(function(){try{app.beginUndoGroup('Remove Old Captions');var comp=app.project.activeItem;if(!comp)return'Error';for(var i=comp.numLayers;i>=1;i--){if(comp.layer(i).name.indexOf('Cap: ')===0)comp.layer(i).remove();}app.endUndoGroup();return'OK';}catch(e){try{app.endUndoGroup();}catch(x){}return'Error';}})();",
                        r
                    )
                );
                const ci = await new Promise((r) =>
                    csInterface.evalScript(
                        "(function(){var comp=app.project.activeItem;if(!comp)return'{}';return JSON.stringify({compWidth:comp.width,compHeight:comp.height,compFPS:comp.frameRate,layerIndex:1});})();",
                        r
                    )
                );
                await createCaptionLayers(JSON.parse(ci), captionWords, selectedTemplate);
                updateCaptionUI('success', 'Template applied: ' + selectedTemplate.name);
            } catch (err) {
                updateCaptionUI('error', err.message);
            } finally {
                isCaptionGenerating = false;
            }
        }

        function updateCaptionUI(state, msg) {
            const s = document.getElementById('caption-status'),
                g = document.getElementById('captionGenerateBtn'),
                r = document.getElementById('captionRegenerateBtn');
            if (s) {
                s.textContent = msg || '';
                s.className = 'caption-status ' + state;
            }
            if (g) g.disabled = state === 'loading';
            if (r) r.disabled = state === 'loading';
        }

        function initCaptionTemplatesUI() {
            const container = document.getElementById('captionTemplates');
            if (!container || container.children.length > 0) return;
            CAPTION_TEMPLATES.forEach((t, i) => {
                const el = document.createElement('div');
                el.className = 'caption-template' + (i === 0 ? ' selected' : '');
                el.dataset.id = t.id;
                const color = `rgb(${Math.round(t.fillColor[0] * 255)},${Math.round(t.fillColor[1] * 255)},${Math.round(t.fillColor[2] * 255)})`;
                el.innerHTML = `<span class="caption-template-preview" style="color:${color};font-family:${t.font}">Aa</span><span class="caption-template-name">${t.name}</span>`;
                el.addEventListener('click', () => {
                    container
                        .querySelectorAll('.caption-template')
                        .forEach((c) => c.classList.remove('selected'));
                    el.classList.add('selected');
                    selectedTemplate = t;
                });
                container.appendChild(el);
            });
            const genBtn = document.getElementById('captionGenerateBtn'),
                regenBtn = document.getElementById('captionRegenerateBtn'),
                applyEditedBtn = document.getElementById('captionApplyEdited');
            if (genBtn && !genBtn._bound) {
                genBtn.addEventListener('click', generateCaption);
                genBtn._bound = true;
            }
            if (regenBtn && !regenBtn._bound) {
                regenBtn.addEventListener('click', regenerateCaption);
                regenBtn._bound = true;
            }
            if (applyEditedBtn && !applyEditedBtn._bound) {
                applyEditedBtn.addEventListener('click', applyCaptionEdits);
                applyEditedBtn._bound = true;
            }
        }

        // ==================== UTILITY ====================
        function showMiniToast(text) {
            const old = document.querySelector('.mini-toast');
            if (old) old.remove();
            const t = document.createElement('div');
            t.className = 'mini-toast';
            t.textContent = text;
            document.body.appendChild(t);
            requestAnimationFrame(() => t.classList.add('show'));
            setTimeout(() => {
                t.classList.remove('show');
                setTimeout(() => t.remove(), 300);
            }, 1600);
        }
        function switchPack(type) {
            if (currentPack === type) return;
            currentPack = type;
            localStorage.setItem('currentPack', type);
            updatePackUI();
            createPresets();
            selectedPreset = null;
            if (status) status.textContent = 'No items selected';
        }
        function switchTab(type) {
            if (currentView === type) return;
            currentView = type;
            allTab?.classList.toggle('active', type === 'all');
            favoritesTab?.classList.toggle('active', type === 'favorites');
            document.getElementById('captionTab')?.classList.toggle('active', type === 'caption');
            const pc = document.getElementById('presets-container'),
                cc = document.getElementById('caption-container');
            if (type === 'caption') {
                if (pc) pc.style.display = 'none';
                if (cc) cc.classList.remove('hidden');
                initCaptionTemplatesUI();
                startCaptionSync();
            } else {
                if (pc) pc.style.display = '';
                if (cc) cc.classList.add('hidden');
                stopCaptionSync();
            }
            selectedPreset = null;
            if (status) status.textContent = 'No items selected';
            if (type !== 'caption') showPage(1);
        }
        function setupTabsUnderline() {
            const tc = document.querySelector('.tabs'),
                tabs = document.querySelectorAll('.tab'),
                ul = document.querySelector('.underline');
            if (!tc || !ul || !tabs.length) return;
            function move(tab) {
                const r = tab.getBoundingClientRect(),
                    pr = tc.getBoundingClientRect();
                document.documentElement.style.setProperty(
                    '--underline-left',
                    r.left - pr.left + 'px'
                );
                document.documentElement.style.setProperty('--underline-width', r.width + 'px');
            }
            move(document.querySelector('.tab.active') || tabs[0]);
            tabs.forEach((tab) =>
                tab.addEventListener('click', () => {
                    document.querySelector('.tab.active')?.classList.remove('active');
                    tab.classList.add('active');
                    move(tab);
                })
            );
            window.addEventListener('resize', () => {
                const a = document.querySelector('.tab.active');
                if (a) move(a);
            });
        }
        function setupPackDropdown() {
            const pd = document.querySelector('.pack-dropdown');
            if (!pd) return;
            const pb = pd.querySelector('.pack-btn'),
                dd = pd.querySelector('.pack-dropdown-content');
            if (!pb || !dd) return;
            pb.addEventListener('click', (e) => {
                e.stopPropagation();
                dd.classList.toggle('show');
                pb.classList.toggle('active');
            });
            textPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                dd.classList.remove('show');
                pb.classList.remove('active');
                switchPack('text');
            });
            effectPackBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                dd.classList.remove('show');
                pb.classList.remove('active');
                switchPack('effect');
            });
            document.addEventListener('click', (e) => {
                if (!pd.contains(e.target)) {
                    dd.classList.remove('show');
                    pb.classList.remove('active');
                }
            });
        }
    }
});
