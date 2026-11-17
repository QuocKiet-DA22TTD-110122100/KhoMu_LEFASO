const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(targetFile, 'utf8');

// 1. Thay đổi phần Header của form Sắp kệ: Thêm nút Camera góc trên bên phải
const oldSkeHead = `'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<strong style="color:#0f766e;font-size:15px">📦 SẮP KỆ MỚI CHO: ' + esc(shoeName) + ' (' + esc(r.maVT) + ')</strong>' +
                '<span class="badge" style="background:#ccfbf1;color:#0f766e;font-weight:800">Tồn: ' + fmt(r.soLuong) + ' đôi</span>' +
              '</div>'`;

const newSkeHead = `'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
                '<strong style="color:#0f766e;font-size:15px">📦 SẮP KỆ MỚI CHO: ' + esc(shoeName) + ' (' + esc(r.maVT) + ')</strong>' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                  '<button type="button" class="btn btn-pri btn-sm" id="btnReloCamCorner" style="background:linear-gradient(135deg,#0d9488 0%,#0284c7 100%);color:#fff;font-weight:800;font-size:13px;padding:6px 14px;border-radius:10px;box-shadow:0 3px 12px rgba(13,148,136,.35);white-space:nowrap;display:inline-flex;align-items:center;gap:6px">' +
                    '📷 Quét Camera đổi kệ' +
                  '</button>' +
                  '<span class="badge" style="background:#ccfbf1;color:#0f766e;font-weight:800;font-size:13px">Tồn: ' + fmt(r.soLuong) + ' đôi</span>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;background:#ffffff;padding:8px 12px;border-radius:12px;border:1.5px solid #99f6e4;box-shadow:0 2px 6px rgba(13,148,136,.08)">' +
                '<span style="font-size:12.5px;font-weight:800;color:#0f766e;white-space:nowrap">Quét mã ô đích:</span>' +
                '<input class="inp mono" id="reloScanInp" placeholder="Bắn máy quét hoặc gõ mã ô (VD: K05-T2-O3) rồi Enter" style="font-size:13px;padding:6px 10px;font-weight:700;flex:1" autocomplete="off">' +
                '<button type="button" class="btn btn-ghost btn-sm" id="btnReloCamScanAction" style="color:#0d9488;border-color:#5eead4;font-weight:800;white-space:nowrap">📷 Bật Cam</button>' +
              '</div>'`;

if (html.includes(oldSkeHead)) {
  html = html.split(oldSkeHead).join(newSkeHead);
}

// 2. Thêm hàm applyReloDestination và gắn sự kiện cho các nút camera trong form Sắp kệ
const oldReloCamBottomBinding = `if ($('#reloCamBottom')) $('#reloCamBottom').onclick = () => openGithubCameraBridge('target=relo');`;
const newReloCamBottomBinding = `function applyReloDestination(rawCode) {
    const loc = parseLoc(rawCode);
    if (loc && !loc.bad && !loc.rackOnly) {
      beep(true);
      if ($('#reloKe')) $('#reloKe').value = loc.ke;
      if ($('#reloTang')) $('#reloTang').value = String(loc.tang);
      if ($('#reloO')) $('#reloO').value = String(loc.o);
      toast('✓ Đã đổi sang ô đích: ' + locStr(loc) + ' — Bấm Xác nhận để chuyển', 'ok');
      ['#reloKe', '#reloTang', '#reloO'].forEach(sel => {
        const el = $(sel);
        if (el) {
          el.style.borderColor = '#0d9488';
          el.style.backgroundColor = '#ccfbf1';
          setTimeout(() => { el.style.backgroundColor = ''; el.style.borderColor = ''; }, 2000);
        }
      });
      return true;
    }
    toast('Mã ô không hợp lệ (VD: K05-T2-O3)', 'err');
    return false;
  }

  if ($('#btnReloCamCorner')) $('#btnReloCamCorner').onclick = () => openGithubCameraBridge('target=relo');
  if ($('#btnReloCamScanAction')) $('#btnReloCamScanAction').onclick = () => openGithubCameraBridge('target=relo');
  if ($('#reloCamBottom')) $('#reloCamBottom').onclick = () => openGithubCameraBridge('target=relo');

  if ($('#reloScanInp')) {
    $('#reloScanInp').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = $('#reloScanInp').value.trim();
        if (v) {
          if (applyReloDestination(v)) $('#reloScanInp').value = '';
        }
      }
    };
  }`;

if (html.includes(oldReloCamBottomBinding)) {
  html = html.split(oldReloCamBottomBinding).join(newReloCamBottomBinding);
}

fs.writeFileSync(targetFile, html, 'utf8');
console.log('[OK] Da tich hop nut Camera goc tren va o quet doi ke truc tiep!');
