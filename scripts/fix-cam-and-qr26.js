const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(targetFile, 'utf8');

// 1. Sửa phần In mã QR (26 kệ thay vì 24)
const oldPrintHtml = `<div class="row" style="margin-top:10px">
        <input class="inp" id="lblFrom" type="number" min="1" max="24" value="1" aria-label="Từ kệ">
        <span class="muted" style="flex:0 0 auto;font-weight:700">đến</span>
        <input class="inp" id="lblTo" type="number" min="1" max="24" value="24" aria-label="Đến kệ">
        <button type="button" class="btn btn-pri" id="btnPrint" style="flex:0 0 110px">In nhãn</button>
      </div>`;

const newPrintHtml = `<div class="row" style="margin-top:10px">
        <input class="inp" id="lblFrom" type="number" min="1" max="26" value="1" aria-label="Từ kệ">
        <span class="muted" style="flex:0 0 auto;font-weight:700">đến</span>
        <input class="inp" id="lblTo" type="number" min="1" max="26" value="26" aria-label="Đến kệ">
        <button type="button" class="btn btn-pri" id="btnPrint" style="flex:0 0 110px">In nhãn</button>
      </div>
      <div class="row wrap" style="margin-top:8px;gap:6px">
        <button type="button" class="btn btn-pri btn-sm" id="btnPrintAll26" style="background:linear-gradient(135deg,#0d9488,#0284c7);font-weight:800">🖨️ In đủ toàn bộ 26 kệ (K01–K26)</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnPrintA">In Dãy A (K01–K13)</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnPrintB">In Dãy B (K14–K26)</button>
      </div>`;

if (html.includes(oldPrintHtml)) {
  html = html.split(oldPrintHtml).join(newPrintHtml);
}

// 2. Thêm CSS cho Floating Action Button (FAB) Camera ở góc dưới đáy màn hình
const cssMarker = '.btn-top-ghcam{';
const fabCss = `/* Nút Camera Floating ở góc đáy màn hình (FAB) */
.fab-gh-cam{
  position:fixed;bottom:24px;right:24px;z-index:999999;
  display:inline-flex;align-items:center;gap:8px;
  background:linear-gradient(135deg,#0d9488 0%,#0284c7 100%);
  color:#ffffff!important;padding:12px 20px;border-radius:999px;
  box-shadow:0 8px 24px rgba(13,148,136,.48), 0 2px 10px rgba(15,23,42,.25);
  border:2.5px solid #ffffff;font-size:14px;font-weight:800;cursor:pointer;
  user-select:none;transition:transform .16s ease, box-shadow .16s ease;
  backdrop-filter:blur(8px);
}
.fab-gh-cam:hover{
  transform:scale(1.06);box-shadow:0 12px 30px rgba(13,148,136,.6);
  background:linear-gradient(135deg,#0f766e 0%,#0369a1 100%);
}
.fab-gh-cam:active{transform:scale(.95)}
.fab-dot{
  width:9px;height:9px;border-radius:50%;background:#34d399;
  box-shadow:0 0 8px #34d399;animation:camPulse 1.8s infinite;
}
@media (max-width: 600px) {
  .fab-gh-cam{bottom:76px;right:16px;padding:10px 16px;font-size:13px}
}

.btn-top-ghcam{`;

if (!html.includes('.fab-gh-cam')) {
  html = html.split(cssMarker).join(fabCss);
}

// 3. Thêm FAB Camera vào HTML trước thẻ đóng </body>
const fabHtmlMarker = `<nav class="bottom-nav" id="bottomNav" hidden aria-label="Điều hướng chính"></nav>`;
const fabHtml = `<button type="button" id="fabGhCam" class="fab-gh-cam" title="Mở Camera quét mã QR (GitHub Pages)">
  <span class="fab-dot"></span>
  <span>📷 Camera GitHub</span>
</button>
<nav class="bottom-nav" id="bottomNav" hidden aria-label="Điều hướng chính"></nav>`;

if (!html.includes('id="fabGhCam"')) {
  html = html.split(fabHtmlMarker).join(fabHtml);
}

// 4. Bổ sung nút Camera trong Sắp kệ form và chân popup #shelfModal
const oldReloBtns = `'<div class="row" style="gap:8px;justify-content:flex-end">' +
                '<button type="button" class="btn btn-ghost btn-sm" id="reloCancel">Huỷ</button>' +
                '<button type="button" class="btn btn-pri btn-sm" id="reloConfirm" style="background:linear-gradient(135deg,#0d9488,#0284c7)">' +
                  '✔ Xác nhận xếp vào ô kệ mới' +
                '</button>' +
              '</div>'`;

const newReloBtns = `'<div class="row wrap" style="gap:8px;justify-content:flex-end;margin-top:12px">' +
                '<button type="button" class="btn btn-pri btn-sm" id="reloCamBottom" style="background:linear-gradient(135deg,#0d9488,#0284c7);gap:6px;font-weight:800">' +
                  '📷 Quét Camera ô đích' +
                '</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="reloCancel">Huỷ</button>' +
                '<button type="button" class="btn btn-pri btn-sm" id="reloConfirm" style="background:#0f766e;font-weight:800">' +
                  '✔ Xác nhận xếp vào ô kệ mới' +
                '</button>' +
              '</div>'`;

if (html.includes(oldReloBtns)) {
  html = html.split(oldReloBtns).join(newReloBtns);
}

// Cập nhật bottomBar trong shelfModal
const oldBottomBar = `let bottomBar = '<div class="row wrap" style="justify-content:space-between;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">' +
    '<div class="row" style="gap:6px">' +
      '<button type="button" class="btn btn-pri btn-sm" id="smBtnIn">+ Nhập vào ô</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="smBtnOut">− Xuất từ ô</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="smBtnCount">Kiểm kê ô</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="smBtnPrint">📷 In tem QR vị trí</button>' +
    '</div>' +
    '<button type="button" class="btn btn-ghost btn-sm" id="smBtnClose">Đóng</button>' +
  '</div>';`;

const newBottomBar = `let bottomBar = '<div class="row wrap" style="justify-content:space-between;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">' +
    '<div class="row wrap" style="gap:6px">' +
      '<button type="button" class="btn btn-pri btn-sm" id="smBtnCamBottom" style="background:linear-gradient(135deg,#0d9488,#0284c7);gap:6px;font-weight:800">📷 Mở Camera GitHub</button>' +
      '<button type="button" class="btn btn-pri btn-sm" id="smBtnIn">+ Nhập vào ô</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="smBtnOut">− Xuất từ ô</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="smBtnCount">Kiểm kê ô</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="smBtnPrint">🖨️ In tem QR vị trí</button>' +
    '</div>' +
    '<button type="button" class="btn btn-ghost btn-sm" id="smBtnClose">Đóng</button>' +
  '</div>';`;

if (html.includes(oldBottomBar)) {
  html = html.split(oldBottomBar).join(newBottomBar);
}

// 5. Cập nhật NAV_ITEMS trên mobile có nút Camera GitHub
const oldNavItems = `const NAV_ITEMS = [
    { id:'home', lbl:'Trang chủ', ico:'home' },
    { id:'NHAP', lbl:'Thao tác', ico:'scan' },
    { id:'map',  lbl:'Sơ đồ kệ', ico:'map' },
    { id:'find', lbl:'Tra cứu', ico:'search' },
    { id:'settings', lbl:'Cài đặt', ico:'settings' }
  ];`;

const newNavItems = `const NAV_ITEMS = [
    { id:'home', lbl:'Trang chủ', ico:'home' },
    { id:'NHAP', lbl:'Thao tác', ico:'scan' },
    { id:'ghCam', lbl:'Camera GH', ico:'camera', isCam:true },
    { id:'map',  lbl:'Sơ đồ 26 kệ', ico:'map' },
    { id:'find', lbl:'Tra cứu', ico:'search' }
  ];`;

if (html.includes(oldNavItems)) {
  html = html.split(oldNavItems).join(newNavItems);
}

// 6. Xử lý sự kiện click cho các nút mới
const eventBindMarker = `if ($('#btnTopGhCam')) {`;
const newEvents = `if ($('#fabGhCam')) {
  $('#fabGhCam').onclick = () => openGithubCameraBridge();
}
if ($('#btnPrintAll26')) {
  $('#btnPrintAll26').onclick = () => {
    $('#lblFrom').value = 1;
    $('#lblTo').value = 26;
    $('#btnPrint').click();
  };
}
if ($('#btnPrintA')) {
  $('#btnPrintA').onclick = () => {
    $('#lblFrom').value = 1;
    $('#lblTo').value = 13;
    $('#btnPrint').click();
  };
}
if ($('#btnPrintB')) {
  $('#btnPrintB').onclick = () => {
    $('#lblFrom').value = 14;
    $('#lblTo').value = 26;
    $('#btnPrint').click();
  };
}

// Bắt sự kiện khi bấm tab Camera GH ở thanh Bottom Nav
const origGo = go;
$$('#bottomNav [data-nav="ghCam"]').forEach(b => {
  b.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGithubCameraBridge();
  };
});

if ($('#btnTopGhCam')) {`;

if (!html.includes('id="fabGhCam").onclick')) {
  html = html.split(eventBindMarker).join(newEvents);
}

// Gắn click cho #smBtnCamBottom và #reloCamBottom trong renderShelfModal
const modalEventMarker = `if ($('#reloConfirm')) $('#reloConfirm').onclick = () => {`;
const modalEvents = `if ($('#reloCamBottom')) $('#reloCamBottom').onclick = () => openGithubCameraBridge('target=relo');
  if ($('#smBtnCamBottom')) $('#smBtnCamBottom').onclick = () => openGithubCameraBridge();
  if ($('#reloConfirm')) $('#reloConfirm').onclick = () => {`;

if (!html.includes('reloCamBottom') && html.includes(modalEventMarker)) {
  html = html.split(modalEventMarker).join(modalEvents);
}

fs.writeFileSync(targetFile, html, 'utf8');
console.log('[OK] Da cap nhat nut Camera Floating (FAB), nut Camera trong popup va in du 26 ke!');
