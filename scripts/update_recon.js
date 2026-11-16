const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. DEFAULT_GH_URL
html = html.replace(
  /const DEFAULT_GH_URL = '[^']+';/,
  "const DEFAULT_GH_URL = 'https://quockiet-da22ttd-110122100.github.io/KhoMu_LEFASO/';"
);

// Auto-correct stored GH URL if pointing to old /KhoMu/ or typo quockiot
const oldGhUrlHandling = "let GH_URL = localStorage.getItem('km.gh') || DEFAULT_GH_URL;";
const newGhUrlHandling = `let storedGh = localStorage.getItem('km.gh');
if (storedGh) {
  if (storedGh.includes('/KhoMu/') && !storedGh.includes('/KhoMu_LEFASO/')) {
    storedGh = storedGh.replace('/KhoMu/', '/KhoMu_LEFASO/');
    localStorage.setItem('km.gh', storedGh);
  }
  if (storedGh.includes('quockiot-da22ttd-110122100')) {
    storedGh = storedGh.replace('quockiot-da22ttd-110122100', 'quockiet-da22ttd-110122100');
    localStorage.setItem('km.gh', storedGh);
  }
}
let GH_URL = storedGh || DEFAULT_GH_URL;`;

html = html.replace(oldGhUrlHandling, newGhUrlHandling);

// 2. Settings placeholder
html = html.replace(
  'placeholder="https://quockiet-da22ttd-110122100.github.io/KhoMu/"',
  'placeholder="https://quockiet-da22ttd-110122100.github.io/KhoMu_LEFASO/"'
);

// 3. Labels 24 ke -> 26 ke
html = html.replace('In nhãn QR vị trí (24 kệ × 12 ô)', 'In nhãn QR vị trí (26 kệ × 12 ô)');
html = html.replace("lbl:'Sơ đồ 24 kệ'", "lbl:'Sơ đồ 26 kệ'");
html = html.replace("map:'Sơ đồ 24 kệ'", "map:'Sơ đồ 26 kệ'");
html = html.replace('Giữ nguyên 24 kệ và tài khoản', 'Giữ nguyên 26 kệ và tài khoản');
html = html.replace('Kho Mũ chỉ có 24 kệ (K01-K24)', 'Kho Mũ chỉ có 26 kệ (K01-K26)');
html = html.replace('vượt quá 24 kệ (K01-K24)', 'vượt quá 26 kệ (K01-K26)');
html = html.replace('>K24', '>K26');

// 4. Default Loc select options
const oldLocSelect = `<select id="kkReconDefaultLoc">
            <option value="NONE">Giữ nguyên (Chờ xếp kệ thủ công)</option>
            <option value="K01-T1-O1">Gán vào K01-T1-O1 (Tạm trữ 1)</option>
            <option value="K13-T1-O1">Gán vào K13-T1-O1 (Tạm trữ 2)</option>
            <option value="K24-T3-O4">Gán vào K24-T3-O4 (Kho đệm)</option>
          </select>`;

const newLocSelect = `<select id="kkReconDefaultLoc">
            <option value="K01-T1-O1" selected>Gán vào K01-T1-O1 (Kho đệm / Chờ xếp kệ)</option>
            <option value="K13-T1-O1">Gán vào K13-T1-O1 (Tạm trữ Dãy A)</option>
            <option value="K14-T1-O1">Gán vào K14-T1-O1 (Tạm trữ Dãy B)</option>
            <option value="K26-T3-O4">Gán vào K26-T3-O4 (Kệ cuối)</option>
            <option value="NONE">Chỉ lưu mã có sẵn Kệ trong file</option>
          </select>`;

html = html.replace(oldLocSelect, newLocSelect);

// 5. Camera UI update: Hide direct cam & photo buttons on iframe, show dedicated GitHub cam button
const oldCamToolbar = `<div class="cam-toolbar">
          <button type="button" class="cam-tbtn" id="btnCam" hidden></button>
          <button type="button" class="cam-tbtn" id="btnCamFlip" hidden></button>
          <button type="button" class="cam-tbtn" id="btnTorch" hidden></button>
          <button type="button" class="cam-tbtn" id="btnScanPhoto" hidden></button>
          <button type="button" class="cam-tbtn on" id="btnCamBridge" title="Mở Camera trên GitHub Pages để quét mã QR / Barcode"></button>
          <input type="file" id="camFileInput" accept="image/*" capture="environment" hidden>
        </div>`;

const newCamToolbar = `<div class="cam-toolbar">
          <button type="button" class="cam-tbtn on" id="btnCamBridge" title="Mở Camera trên GitHub Pages để quét mã QR / Barcode" style="background:linear-gradient(135deg,#0d9488,#0284c7);padding:10px 16px;font-size:14px;box-shadow:0 4px 14px rgba(13,148,136,.35);width:100%">
            <span class="ico" id="btnCamBridgeIco"></span>
            <span>📷 Mở Camera quét mã QR (GitHub Pages)</span>
          </button>
          <button type="button" class="cam-tbtn" id="btnCam" hidden></button>
          <button type="button" class="cam-tbtn" id="btnCamFlip" hidden></button>
          <button type="button" class="cam-tbtn" id="btnTorch" hidden></button>
          <button type="button" class="cam-tbtn" id="btnScanPhoto" hidden></button>
          <input type="file" id="camFileInput" accept="image/*" capture="environment" hidden>
        </div>`;

html = html.replace(oldCamToolbar, newCamToolbar);

// 6. Camera off msg
html = html.replace(
  'Nhấn nút Mở Camera GitHub bên dưới để quét mã, hoặc dùng súng bắn mã / nhập mã trực tiếp',
  'Nhấn nút "📷 Mở Camera quét mã QR (GitHub Pages)" bên dưới, hoặc dùng súng bắn mã / nhập trực tiếp'
);

// 7. Add #kkPlanOnlyWrap and #reconProgressModal
const oldTableEnd = `      <div class="tbl-wrap" id="kkReconTableWrap" hidden style="margin-top:8px">
        <table class="recon-tbl">`;

if (!html.includes('id="kkPlanOnlyWrap"')) {
  html = html.replace(
    '      <div class="tbl-wrap" id="kkReconTableWrap" hidden style="margin-top:8px">',
    '      <div class="tbl-wrap" id="kkReconTableWrap" hidden style="margin-top:8px">'
  );
  // Add #kkPlanOnlyWrap right after tableWrap closes
  const tableWrapClose = `        </table>
      </div>`;
  const newTableWrapClose = `        </table>
      </div>
      <div id="kkPlanOnlyWrap"></div>`;
  html = html.replace(tableWrapClose, newTableWrapClose);
}

// Modal HTML before closing </main>
if (!html.includes('id="reconProgressModal"')) {
  const modalHtml = `
  <!-- MODAL TIẾN TRÌNH ĐỒNG BỘ GOOGLE SHEET -->
  <div id="reconProgressModal" hidden class="modal-backdrop">
    <div class="modal-card">
      <div class="modal-head">
        <strong id="rpmTitle">Đang đồng bộ dữ liệu lên Google Sheet</strong>
      </div>
      <div class="modal-body">
        <div id="rpmStep" style="font-weight:700;color:var(--brand);margin-bottom:6px">Đợt 1/9</div>
        <div class="bar-track" style="height:12px;margin-bottom:8px">
          <div class="bar-fill" id="rpmBar" style="width:0%;background:linear-gradient(90deg,#0d9488,#0284c7)"></div>
        </div>
        <div id="rpmText" class="small muted">Đang gửi dữ liệu lên Google Sheet...</div>
      </div>
    </div>
  </div>
`;
  html = html.replace('</main>', modalHtml + '</main>');
}

fs.writeFileSync(filePath, html, 'utf8');
console.log('Step 1 applied successfully to docs/index.html');
