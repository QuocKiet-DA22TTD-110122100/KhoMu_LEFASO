const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(targetFile, 'utf8');

// 1. Add CSS for .btn-top-ghcam
const cssMarker = '.live-suggest-box[hidden]{display:none!important}';
const cssToAdd = `.live-suggest-box[hidden]{display:none!important}

/* Nút Camera GitHub trên Header & Trong Sắp Kệ */
.btn-top-ghcam{
  display:inline-flex;align-items:center;gap:6px;
  background:linear-gradient(135deg,#0d9488 0%,#0284c7 100%);
  color:#ffffff!important;font-size:12.5px;font-weight:700;
  padding:6px 13px;border-radius:999px;border:none;
  box-shadow:0 3px 12px rgba(13,148,136,.32);
  cursor:pointer;white-space:nowrap;transition:all .16s ease;
  margin-left:auto;text-decoration:none;user-select:none;
}
.btn-top-ghcam:hover{
  transform:translateY(-1.5px);
  box-shadow:0 6px 18px rgba(13,148,136,.42);
  background:linear-gradient(135deg,#0f766e 0%,#0369a1 100%);
}
.btn-top-ghcam .cam-dot{
  width:8px;height:8px;border-radius:50%;background:#34d399;
  box-shadow:0 0 6px #34d399;animation:camPulse 1.8s infinite;
}
@keyframes camPulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.45;transform:scale(1.3)}
}`;

if (!html.includes('.btn-top-ghcam')) {
  if (!html.includes(cssMarker)) throw new Error('CSS marker not found');
  html = html.split(cssMarker).join(cssToAdd);
}

// 2. Add #btnTopGhCam to Header (.header-inner)
const headerMarker = `<div class="sync-pill demo" id="sync" hidden><span class="dot"></span><span id="syncTxt">Chế độ thử</span></div>`;
const headerWithBtn = `<button type="button" class="btn-top-ghcam" id="btnTopGhCam" title="Mở Camera quét mã QR/Barcode trên GitHub Pages">
          <span class="cam-dot"></span>
          <span>📷 Camera GitHub</span>
        </button>
        <div class="sync-pill demo" id="sync" hidden><span class="dot"></span><span id="syncTxt">Chế độ thử</span></div>`;

if (!html.includes('id="btnTopGhCam"')) {
  if (!html.includes(headerMarker)) throw new Error('Header marker not found');
  html = html.split(headerMarker).join(headerWithBtn);
}

// 3. Update openGithubCameraBridge to directly open GitHub Pages
const oldOpenBridge = `function openGithubCameraBridge(){
  // Nếu người dùng đã tự cấu hình link GitHub Pages riêng (khác link mặc định chưa bật Pages) và chọn chế độ mở URL ngoài
  const customGh = (localStorage.getItem('km.gh_custom') || '').trim();
  if (customGh) {
    const sep = customGh.includes('?') ? '&' : '?';
    const bridgeUrl = customGh + sep + 'bridge=1' + (API ? '&api=' + encodeURIComponent(API) : '');
    const wExt = window.open(bridgeUrl, 'km_gh_cam', 'width=480,height=760,menubar=no,toolbar=no,location=no');
    if (!wExt) toast('Trình duyệt chặn popup — hãy cho phép mở cửa sổ Camera', 'err');
    return;
  }

  // Mở cửa sổ Camera độc lập (Top-Level Window thoát khỏi iframe của Apps Script, không bao giờ lỗi 404)
  const w = window.open('', 'km_gh_cam', 'width=480,height=760,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes');
  if (!w) {
    toast('Trình duyệt đang chặn cửa sổ bật lên (Popup) — hãy bấm Cho phép Popup trên thanh địa chỉ', 'err');
    return;
  }
  camPopupWin = w;
  const stepHint = ($('#prompt') && $('#prompt').textContent) || 'Quét mã QR Ô kệ (VD: KE:K01-T1-O2) hoặc Mã mũ';
  const popupHtml = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>Camera Quét Mã — Kho Mũ TBS</title>' +
    '<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"><' + '/script>' +
    '<style>' +
    '*{box-sizing:border-box}body{margin:0;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc}' +
    '.card{background:#1e293b;border:1px solid #334155;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 10px 25px rgba(0,0,0,.3)}' +
    '.head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}' +
    '.title{font-size:16px;font-weight:800;color:#fff}.badge{padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700;background:#065f46;color:#6ee7b7;border:1px solid #059669}' +
    '.hint{font-size:13px;color:#cbd5e1;background:#0f172a;padding:10px 12px;border-radius:10px;margin-bottom:12px;border-left:3px solid #14b8a6}' +
    '#readerWrap{position:relative;min-height:240px;background:#090d16;border-radius:14px;overflow:hidden;border:2px solid #0d9488;display:flex;align-items:center;justify-content:center}' +
    '#reader{width:100%}#reader video{width:100%!important;display:block;object-fit:cover}' +
    '#camMsg{padding:20px;text-align:center;color:#94a3b8;font-size:13.5px;line-height:1.5}' +
    '.btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}' +
    'button,.fbtn{min-height:44px;padding:8px 12px;border-radius:11px;border:1px solid #475569;background:#334155;color:#fff;font-size:13.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-align:center}' +
    'button:hover,.fbtn:hover{background:#475569}.pri{background:linear-gradient(135deg,#0d9488,#0284c7);border-color:transparent}' +
    '.row{display:flex;gap:8px;margin-top:10px}input[type=text]{flex:1;min-height:44px;border-radius:11px;border:1.5px solid #475569;background:#0f172a;color:#fff;padding:0 12px;font-size:15px;font-family:monospace}' +
    '.log{font-size:13px;color:#a7f3d0;margin-top:8px;padding:10px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);border-radius:10px;display:none}' +
    '</style></head><body>' +
    '<div class="card">' +
      '<div class="head"><div class="title">Camera Quét Mã — Kho Mũ TBS</div><span class="badge" id="stBadge">Đang mở cam…</span></div>' +
      '<div class="hint" id="stepTxt">' + esc(stepHint) + '</div>' +
      '<div id="readerWrap"><div id="reader"></div><div id="camMsg" style="display:none"></div></div>' +
      '<div class="btns">' +
        '<button type="button" class="pri" id="bToggle">Bật / Đổi Camera</button>' +
        '<label class="fbtn" for="fImg">Chụp / Chọn Ảnh Mã<input id="fImg" type="file" accept="image/*" capture="environment" style="display:none"></label>' +
      '</div>' +
      '<div class="row">' +
        '<input type="text" id="mCode" placeholder="Gõ mã hoặc test quét..." autocomplete="off">' +
        '<button type="button" class="pri" id="bSend">Gửi mã</button>' +
      '</div>' +
      '<div class="log" id="logTxt"></div>' +
    '</div>' +
    '<script>' +
    'let html5Qr = null, isFront = false;' +
    'const log = txt => { const el = document.getElementById("logTxt"); el.style.display="block"; el.innerHTML = "Đã quét: <b>" + txt + "</b> (đang gửi về app)"; };' +
    'function sendCode(c){' +
      'if (!c) return;' +
      'log(c);' +
      'try { if (window.opener) window.opener.postMessage({ type:"KM_SCAN", code: c }, "*"); } catch (e) {}' +
    '}' +
    'document.getElementById("bSend").onclick = () => { const inp = document.getElementById("mCode"); if (inp.value.trim()) { sendCode(inp.value.trim()); inp.value=""; } };' +
    'document.getElementById("mCode").onkeydown = e => { if (e.key === "Enter") document.getElementById("bSend").click(); };' +
    'document.getElementById("fImg").onchange = async e => {' +
      'const f = e.target.files && e.target.files[0];' +
      'if (!f || !html5Qr) return;' +
      'try {' +
        'const res = await html5Qr.scanFile(f, false);' +
        'sendCode(res);' +
      '} catch (err) { alert("Không đọc được mã từ ảnh"); }' +
    '};' +
    'async function startCam(){' +
      'const badge = document.getElementById("stBadge");' +
      'const msg = document.getElementById("camMsg");' +
      'try {' +
        'if (html5Qr) { try { await html5Qr.stop(); } catch(x){} }' +
        'html5Qr = new Html5Qrcode("reader");' +
        'await html5Qr.start(' +
          '{ facingMode: isFront ? "user" : "environment" },' +
          '{ fps: 12, qrbox: { width: 250, height: 250 } },' +
          'decodedText => { sendCode(decodedText); },' +
          '() => {}' +
        ');' +
        'badge.textContent = "Camera hoạt động"; badge.style.background = "#065f46";' +
        'msg.style.display = "none";' +
      '} catch (e) {' +
        'badge.textContent = "Lỗi Camera"; badge.style.background = "#991b1b";' +
        'msg.style.display = "block";' +
        'msg.innerHTML = "Không mở được Camera thiết bị: " + (e.message || e) + "<br><small style=\\"color:#64748b\\">Hãy kiểm tra quyền Camera hoặc dùng nút Chụp/Chọn ảnh bên dưới.</small>";' +
      '}' +
    '}' +
    'document.getElementById("bToggle").onclick = () => { isFront = !isFront; startCam(); };' +
    'startCam();' +
    '<' + '/script>' +
    '</body></html>';
  w.document.open();
  w.document.write(popupHtml);
  w.document.close();
}`;

const newOpenBridge = `function openGithubCameraBridge(extraParams){
  let ghUrl = (localStorage.getItem('km.gh') || DEFAULT_GH_URL).trim();
  if (!ghUrl.startsWith('http')) ghUrl = DEFAULT_GH_URL;
  const sep = ghUrl.includes('?') ? '&' : '?';
  const apiParam = API ? '&api=' + encodeURIComponent(API) : '';
  const bridgeUrl = ghUrl + sep + 'bridge=1' + apiParam + (extraParams ? '&' + extraParams : '');

  // Mở trực tiếp trang Camera trên GitHub Pages chuẩn HTTPS
  try {
    const w = window.open(bridgeUrl, 'km_gh_cam', 'width=500,height=780,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes');
    if (!w) window.open(bridgeUrl, '_blank');
  } catch (e) {
    window.open(bridgeUrl, '_blank');
  }
}`;

if (html.includes(oldOpenBridge)) {
  html = html.split(oldOpenBridge).join(newOpenBridge);
}

// 4. Update message handler to auto-fill destination rack slot if in Relocate form
const oldMsgHandler = `window.addEventListener('message', e => {
  if (e && e.data && e.data.type === 'KM_SCAN' && e.data.code) {
    onScan(String(e.data.code));
  }
});`;

const newMsgHandler = `window.addEventListener('message', e => {
  if (e && e.data && e.data.type === 'KM_SCAN' && e.data.code) {
    const rawCode = String(e.data.code);
    // Nếu đang mở form Sắp kệ mới: tự động điền vị trí ô đích vừa quét
    const reloKe = $('#reloKe');
    const loc = parseLoc(rawCode);
    if (reloKe && loc && !loc.bad && !loc.rackOnly) {
      beep(true);
      reloKe.value = loc.ke;
      if ($('#reloTang')) $('#reloTang').value = String(loc.tang);
      if ($('#reloO')) $('#reloO').value = String(loc.o);
      toast('Đã nhận diện ô đích từ Camera GitHub: ' + locStr(loc), 'ok');
      return;
    }
    onScan(rawCode);
  }
});`;

if (html.includes(oldMsgHandler)) {
  html = html.split(oldMsgHandler).join(newMsgHandler);
}

// 5. Add Camera button in Relocate Modal
const reloFormMarker = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">`;
const reloFormWithCam = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
                <label class="xs muted" style="font-weight:700">CHỌN VỊ TRÍ ĐÍCH HOẶC QUÉT MÃ QR:</label>
                <button type="button" class="btn btn-ghost btn-sm" id="reloCamBtn" style="color:#0d9488;border-color:#5eead4;padding:2px 8px;font-size:12px;font-weight:700">
                  📷 Mở Camera GitHub
                </button>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">`;

if (html.includes(reloFormMarker) && !html.includes('id="reloCamBtn"')) {
  html = html.split(reloFormMarker).join(reloFormWithCam);
}

// 6. Bind click events for #btnTopGhCam and #reloCamBtn
const iconMountMarker = `mountStaticIcons();`;
const iconMountWithCam = `if ($('#btnTopGhCam')) {
  const isGh = isGithubCamHost();
  $('#btnTopGhCam').innerHTML = '<span class="cam-dot"></span>' + icon('camera') + '<span>' + (isGh ? 'Quét Camera' : 'Camera GitHub') + '</span>';
  $('#btnTopGhCam').onclick = () => {
    if (isGithubCamHost()) {
      go('NHAP');
      if (typeof camStart === 'function') camStart('camBox', flowScan);
    } else {
      openGithubCameraBridge();
    }
  };
}
mountStaticIcons();`;

if (!html.includes('id="btnTopGhCam").onclick') && html.includes(iconMountMarker)) {
  html = html.split(iconMountMarker).join(iconMountWithCam);
}

// In renderShelfModal, bind #reloCamBtn
const reloConfirmMarker = `$('#reloConfirm').onclick = () => {`;
const reloConfirmWithCam = `if ($('#reloCamBtn')) $('#reloCamBtn').onclick = () => openGithubCameraBridge('target=relo');\n    $('#reloConfirm').onclick = () => {`;

if (!html.includes('reloCamBtn') && html.includes(reloConfirmMarker)) {
  html = html.split(reloConfirmMarker).join(reloConfirmWithCam);
}

fs.writeFileSync(targetFile, html, 'utf8');
console.log('[OK] Da tich hop nut Camera GitHub mo tro qua GitHub Pages thanh cong');
