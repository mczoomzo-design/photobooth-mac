/* =========================================================================
   Desktop bridge — adapts the shared Photo Booth web UI to run on macOS
   (Electron). Loaded AFTER the page's inline script, so every global it
   references (buildStrip, uploadToGitHub, ghCfg, go, setBar, makeQR,
   spawnConfetti, setUpNote, newOrder, orderNo) already exists.

   What it changes for desktop:
   1. Camera: pick a specific capture device (the Canon EOS RP exposed by
      "EOS Webcam Utility" over USB-C) instead of the phone front camera.
   2. Save: write the slip PNG to disk through Electron instead of <a download>.
   3. Print: open the macOS system print dialog for the slip (any system
      printer — receipt or A6 — works), instead of the Android BT printer.
   ========================================================================= */
(function () {
  const CAM_KEY = 'camDeviceId';
  const g = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const s = (k, v) => { try { localStorage.setItem(k, v || ''); } catch (e) {} };

  /* ---- 1. force getUserMedia onto the chosen camera ---- */
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (c) {
      try {
        const id = g(CAM_KEY);
        if (c && c.video) {
          if (c.video === true) c.video = {};
          delete c.video.facingMode;              // no "user"/"environment" on desktop
          if (id) c.video.deviceId = { exact: id };
          c.video.width = { ideal: 1920 };
          c.video.height = { ideal: 1080 };
        }
      } catch (e) {}
      return orig(c).then(stream => { setTimeout(populateCameras, 300); return stream; });
    };
  }

  /* ---- camera picker injected into the ⚙︎ settings sheet ---- */
  function ensureCamField() {
    if (document.getElementById('camSel')) return;
    const sheet = document.querySelector('#printerSheet .sheet-card');
    if (!sheet) return;
    const wrap = document.createElement('label');
    wrap.className = 'fld';
    wrap.innerHTML = 'กล้อง (Canon EOS RP via EOS Webcam Utility)' +
      '<select id="camSel" style="width:100%;padding:12px;border-radius:12px;border:2px solid #e6e6ea;font:inherit"></select>';
    // place it right after the shop-name field (first .fld), else at top
    const firstFld = sheet.querySelector('.fld');
    if (firstFld && firstFld.nextSibling) sheet.insertBefore(wrap, firstFld.nextSibling);
    else sheet.insertBefore(wrap, sheet.children[1] || null);
    document.getElementById('camSel').addEventListener('change', e => {
      s(CAM_KEY, e.target.value);
    });
  }

  async function populateCameras() {
    ensureCamField();
    const sel = document.getElementById('camSel');
    if (!sel || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    let devs = [];
    try { devs = await navigator.mediaDevices.enumerateDevices(); } catch (e) { return; }
    const cams = devs.filter(d => d.kind === 'videoinput');
    const saved = g(CAM_KEY);
    // auto-pick the Canon device the first time if nothing is chosen yet
    let auto = '';
    if (!saved) {
      const canon = cams.find(d => /eos|canon|webcam/i.test(d.label));
      if (canon) { auto = canon.deviceId; s(CAM_KEY, auto); }
    }
    const cur = g(CAM_KEY);
    sel.innerHTML = cams.map((d, i) =>
      `<option value="${d.deviceId}">${(d.label || ('กล้อง ' + (i + 1)))}</option>`).join('');
    if (cur) sel.value = cur;
  }

  // refresh the list whenever the settings sheet is opened
  const _openSettings = window.openPrinterSettings;
  window.openPrinterSettings = function () {
    if (typeof _openSettings === 'function') _openSettings.apply(this, arguments);
    ensureCamField();
    populateCameras();
  };
  window.addEventListener('load', () => { setTimeout(populateCameras, 600); });

  /* ---- 2. save to disk through Electron ---- */
  window.savePhoto = async function () {
    const url = await buildStrip('digital');
    const name = (typeof orderNo !== 'undefined' && orderNo ? orderNo : 'photobooth') + '.png';
    if (window.desktop && window.desktop.saveImage) {
      try {
        const r = await window.desktop.saveImage(url, name);
        if (r && r.ok) alert('บันทึกรูปแล้ว ✓\n' + r.path);
        else if (r && r.canceled) { /* user cancelled */ }
        else alert('บันทึกไม่สำเร็จ');
      } catch (e) { alert('บันทึกไม่สำเร็จ: ' + (e && e.message ? e.message : e)); }
      return;
    }
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  };

  /* ---- 3. print through the macOS system print dialog ---- */
  window.startPrint = async function () {
    const cc = ghCfg();
    if ((!cc.owner || !cc.repo || !cc.token) && !window.__warnedNoCloud) {
      window.__warnedNoCloud = true;
      alert('ยังไม่ได้ตั้งค่า Cloud สำหรับ QR (⚙︎)\nQR จะยังโหลดรูปไม่ได้จนกว่าจะกรอก Owner/Repo/Pages/Token\n(ยังพิมพ์และบันทึกรูปได้ตามปกติ)');
    }
    go('printing'); setBar(0);
    spawnConfetti(document.getElementById('printerIll'));
    if (typeof newOrder === 'function' && !orderNo) newOrder();

    const digital = await buildStrip('digital');
    setUpNote('⏳ กำลังอัปโหลดรูปขึ้นคลาวด์…', '#8a90a6');
    uploadToGitHub(digital, orderNo).then(r => {
      if (r && r.skipped) { setUpNote('ℹ️ ยังไม่ได้ตั้งค่า Cloud (⚙︎) — QR จะยังโหลดรูปไม่ได้', '#b26a00'); return; }
      setUpNote('✅ อัปโหลดรูปแล้ว — สแกน QR โหลดรูปได้เลย', '#1a7f37');
    }).catch(e => {
      setUpNote('⚠️ อัปโหลดรูปไม่สำเร็จ: ' + (e && e.message ? e.message : e), '#b3261e');
    });

    // progress bar, then open the system print dialog with the slip
    let p = 0;
    const iv = setInterval(async () => {
      p += Math.random() * 14 + 6;
      if (p >= 100) {
        p = 100; clearInterval(iv); makeQR();
        if (window.desktop && window.desktop.printImage) {
          try { await window.desktop.printImage(digital); } catch (e) { console.warn('print', e); }
        }
        setTimeout(() => go('done'), 350);
      }
      setBar(p);
    }, 140);
  };
})();
