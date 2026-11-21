/**
 * KHO MŨ TBS — Backend Google Apps Script
 * Hỗ trợ đồng thời:
 *  1. Chạy giao diện trực tiếp trên Apps Script (`doGet` phục vụ `Index.html`).
 *  2. Kết nối từ GitHub Pages (Mở Camera HTTPS & cầu nối Camera Bridge không bị chặn iframe).
 *  3. Chống xung đột dữ liệu bằng `LockService.getScriptLock()` + `SpreadsheetApp.flush()`.
 *  4. Tối ưu đọc 1 lần / ghi 1 lần (`getDataRange().getValues()` -> RAM -> `setValues()`).
 *  5. Làm sạch & chuẩn hóa dữ liệu Sheet (`cleanAndNormalizeSheetData`) + tự động lưu trữ Log > 5.000 dòng.
 */

const KHO = {
  TEN: 'Kho Mũ TBS',
  SO_KE: 26,                 // K01 -> K26 (Dãy A: K01-K13, Dãy B: K14-K26)
  SO_TANG: 3,                // T1 (đáy) -> T3 (trên cùng)
  SO_O: 4,                   // O1 -> O4 (trái -> phải) -> 26 kệ × 3 tầng × 4 ô = 312 ô
  PHIEN_GIAY: 12 * 60 * 60,  // 12 giờ (trọn ca làm việc)
  MAX_LOG_ROWS: 5000,        // Ngưỡng tự động chuyển log cũ sang sheet lưu trữ
  KEEP_LOG_ROWS: 1000        // Số dòng log giữ lại ở sheet chính sau khi lưu trữ
};

const SHEETS = {
  Shelves: ['ma', 'khu', 'soTang', 'soO', 'ghiChu'],
  Items:   ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so', 'slkh'],
  Stock:   ['ke', 'tang', 'o', 'maVT', 'soLuong', 'capNhat'],
  Logs:    ['thoiGian', 'loai', 'ke', 'tang', 'o', 'maVT', 'soLuong', 'nguoi', 'ghiChu', 'clientId'],
  Users:   ['ma', 'ten', 'vaiTro', 'salt', 'hash', 'hoatDong']
};

/* ============================ MENU & CÀI ĐẶT ============================ */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Kho Mũ TBS')
      .addItem('1. Cài đặt sổ kho (24 kệ × 3 tầng × 4 ô)', 'setup')
      .addItem('2. Làm sạch & Chuẩn hóa dữ liệu Sheet', 'cleanAndNormalizeSheetData')
      .addItem('3. Lưu trữ bớt Nhật ký cũ (> 5.000 dòng)', 'archiveOldLogs')
      .addItem('4. Bật tự động lưu trữ Nhật ký hàng tháng', 'setupAutoArchiveTrigger')
      .addSeparator()
      .addItem('5. Nạp dữ liệu mẫu để test', 'seedSampleData')
      .addItem('6. Xoá sạch dữ liệu mẫu (giữ kệ & tài khoản)', 'clearSampleData')
      .addSeparator()
      .addItem('7. Reset mật khẩu admin về 123456', 'resetAdminPassword')
      .addSeparator()
      .addItem('8. Zalo: Dán token bot', 'zaloCaiToken')
      .addItem('9. Zalo: Lấy Chat ID nhóm', 'zaloLayChatId')
      .addItem('10. Zalo: Gửi tin thử', 'zaloKiemTra')
      .addItem('11. Zalo: Bật báo cáo thiếu 17:00 hàng ngày', 'zaloBatTrigger')
      .addItem('12. Zalo: Cài đường link Web App (/exec)', 'zaloCaiLink')
      .addToUi();
  } catch (e) {}
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script chưa gắn với Google Sheet.');
  if (!ss.getSpreadsheetTimeZone()) ss.setSpreadsheetTimeZone('Asia/Ho_Chi_Minh');

  Object.keys(SHEETS).forEach(sh_);
  if (rows_('Shelves').length === 0) {
    const out = [];
    for (let i = 1; i <= KHO.SO_KE; i++) {
      out.push([maKe_(i), i <= KHO.SO_KE / 2 ? 'Dãy A' : 'Dãy B', KHO.SO_TANG, KHO.SO_O, '']);
    }
    sh_('Shelves').getRange(2, 1, out.length, out[0].length).setValues(out);
  }
  if (rows_('Users').length === 0) taoNguoiDung('admin', 'Quản trị', '123456', 'ADMIN');

  PropertiesService.getScriptProperties().setProperty('SETUP_DONE', '1');
  CacheService.getScriptCache().put('setup_ok_v1', '1', 21600);
  return 'Đã cài đặt ' + KHO.TEN + ': ' + KHO.SO_KE + ' kệ × ' + KHO.SO_TANG + ' tầng × ' + KHO.SO_O + ' ô. Tài khoản: admin / 123456';
}

function ensureSetup_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('setup_ok_v1') === '1') return;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SETUP_DONE') === '1') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getSheetByName('Shelves') && ss.getSheetByName('Users')) {
      cache.put('setup_ok_v1', '1', 21600);
      return;
    }
  }
  const lock = LockService.getScriptLock();
  if (lock.tryLock(15000)) {
    try {
      setup();
    } finally {
      lock.releaseLock();
    }
  }
}

function resetAdminPassword() {
  ensureSetup_();
  return taoNguoiDung('admin', 'Quản trị', '123456', 'ADMIN');
}

/* ============================ LÀM SẠCH & LƯU TRỮ DỮ LIỆU ============================ */

/**
 * Làm sạch và chuẩn hóa toàn bộ dữ liệu trên Google Sheet (Đọc 1 lần -> xử lý RAM -> Ghi 1 lần):
 *  - Chuẩn hóa 24 kệ K01..K24
 *  - Gộp các dòng trùng (Kệ + Tầng + Ô + Mã mũ) trong Stock, loại bỏ dòng số lượng <= 0 hoặc sai vị trí
 *  - Tự động thêm mã mũ đang có trong Stock nhưng thiếu trong Items vào danh mục Items
 *  - Xoá dòng trống / dòng trùng clientId trong Logs
 */
function cleanAndNormalizeSheetData() {
  ensureSetup_();
  const now = new Date();

  // 1. Chuẩn hóa Shelves (đủ 24 kệ K01..K24)
  const shelfRows = [];
  for (let i = 1; i <= KHO.SO_KE; i++) {
    shelfRows.push([maKe_(i), i <= KHO.SO_KE / 2 ? 'Dãy A' : 'Dãy B', KHO.SO_TANG, KHO.SO_O, '']);
  }
  const shShelves = sh_('Shelves');
  if (shShelves.getLastRow() > 1) shShelves.getRange(2, 1, shShelves.getLastRow() - 1, SHEETS.Shelves.length).clearContent();
  shShelves.getRange(2, 1, shelfRows.length, SHEETS.Shelves.length).setValues(shelfRows);

  // 2. Chuẩn hóa Items (Đọc 1 lần)
  const shItems = sh_('Items');
  const rawItems = shItems.getDataRange().getValues();
  const itemMap = {};
  const itemOrder = [];
  let dupItemsRemoved = 0;
  for (let i = 1; i < rawItems.length; i++) {
    const r = rawItems[i];
    const ma = code_(r[0]).replace(/^(VT|MU):\s*/, '');
    if (!ma) continue;
    const rawGhiChu = String(r[6] || '').trim();
    const extracted = extractPoSoFromNote_(rawGhiChu);
    let poVal = mergeCsvCodes_(r[7], extracted.po);
    if (!poVal && /^(?:RB|PO|W)\d{3,}/i.test(ma)) poVal = ma;
    const soVal = mergeCsvCodes_(r[8], extracted.so);
    const slkhVal = Math.max(0, Math.round(Number(r[9]) || 0));
    if (!itemMap[ma]) {
      itemMap[ma] = [
        ma,
        String(r[1] || ma).trim(),
        String(r[2] || '').trim().toUpperCase(),
        String(r[3] || '').trim(),
        String(r[4] || '').trim(),
        String(r[5] || 'đôi').trim() || 'đôi',
        rawGhiChu,
        poVal,
        soVal,
        slkhVal > 0 ? slkhVal : ''
      ];
      itemOrder.push(ma);
    } else {
      itemMap[ma][7] = mergeCsvCodes_(itemMap[ma][7], poVal);
      itemMap[ma][8] = mergeCsvCodes_(itemMap[ma][8], soVal);
      const maxSlkh = Math.max(Number(itemMap[ma][9]) || 0, slkhVal);
      itemMap[ma][9] = maxSlkh > 0 ? maxSlkh : '';
      dupItemsRemoved++;
    }
  }

  // 3. Chuẩn hóa & Gộp trùng Stock (Đọc 1 lần)
  const shStock = sh_('Stock');
  const rawStock = shStock.getDataRange().getValues();
  const stockAgg = {};
  const stockKeys = [];
  let invalidStockRemoved = 0;
  let mergedStockRows = 0;
  let autoAddedItems = 0;

  for (let i = 1; i < rawStock.length; i++) {
    const r = rawStock[i];
    const parsed = parseFlexiblePos_(r[0], r[1], r[2]);
    const ma = code_(r[3]).replace(/^(VT|MU):\s*/, '');
    const sl = Math.round(Number(r[4]) || 0);
    if (!parsed || !ma || sl <= 0) {
      if (r.join('').trim() !== '') invalidStockRemoved++;
      continue;
    }
    const key = parsed.ke + '|' + parsed.tang + '|' + parsed.o + '|' + ma;
    if (!stockAgg[key]) {
      stockAgg[key] = [parsed.ke, parsed.tang, parsed.o, ma, sl, r[5] instanceof Date ? r[5] : now];
      stockKeys.push(key);
    } else {
      stockAgg[key][4] += sl;
      stockAgg[key][5] = now;
      mergedStockRows++;
    }
    if (!itemMap[ma]) {
      itemMap[ma] = [ma, ma, '', '', '', 'đôi', 'Tự động đồng bộ từ tồn kho', '', '', ''];
      itemOrder.push(ma);
      autoAddedItems++;
    }
  }

  // Ghi lại Items 1 lần
  if (shItems.getLastRow() > 1) shItems.getRange(2, 1, shItems.getLastRow() - 1, SHEETS.Items.length).clearContent();
  if (itemOrder.length > 0) {
    const cleanItems = itemOrder.map(function (k) { return itemMap[k]; });
    try { shItems.getRange(2, 8, cleanItems.length, 2).setNumberFormat('@'); } catch (e) {}
    shItems.getRange(2, 1, cleanItems.length, SHEETS.Items.length).setValues(cleanItems);
  }

  // Ghi lại Stock 1 lần
  if (shStock.getLastRow() > 1) shStock.getRange(2, 1, shStock.getLastRow() - 1, SHEETS.Stock.length).clearContent();
  if (stockKeys.length > 0) {
    const cleanStock = stockKeys.map(function (k) { return stockAgg[k]; });
    shStock.getRange(2, 1, cleanStock.length, SHEETS.Stock.length).setValues(cleanStock);
  }

  // 4. Làm sạch Logs (bỏ dòng trống & trùng clientId)
  const shLogs = sh_('Logs');
  const rawLogs = shLogs.getDataRange().getValues();
  const seenTx = {};
  const cleanLogs = [];
  let dupLogsRemoved = 0;
  for (let i = 1; i < rawLogs.length; i++) {
    const r = rawLogs[i];
    if (r.join('').trim() === '') continue;
    const txId = String(r[9] || '').trim();
    if (txId && seenTx[txId]) {
      dupLogsRemoved++;
      continue;
    }
    if (txId) seenTx[txId] = true;
    const p = parseFlexiblePos_(r[2], r[3], r[4]);
    cleanLogs.push([
      r[0] || now,
      code_(r[1]) || 'NHAP',
      p ? p.ke : code_(r[2]),
      p ? p.tang : (Number(r[3]) || 1),
      p ? p.o : (Number(r[4]) || 1),
      code_(r[5]).replace(/^(VT|MU):\s*/, ''),
      Number(r[6]) || 0,
      String(r[7] || 'kho').trim(),
      String(r[8] || '').trim(),
      txId || ('tx_' + i + '_' + Date.now())
    ]);
  }
  if (shLogs.getLastRow() > 1) shLogs.getRange(2, 1, shLogs.getLastRow() - 1, SHEETS.Logs.length).clearContent();
  if (cleanLogs.length > 0) {
    shLogs.getRange(2, 1, cleanLogs.length, SHEETS.Logs.length).setValues(cleanLogs);
  }

  // Lưu trữ bớt nếu Logs vượt ngưỡng
  const archivedCount = archiveOldLogs_();

  return 'Đã làm sạch & chuẩn hóa dữ liệu: ' +
    stockKeys.length + ' ô tồn chuẩn (gộp ' + mergedStockRows + ' dòng trùng, bỏ ' + invalidStockRemoved + ' dòng rác/<=0), ' +
    itemOrder.length + ' mã mũ (tự thêm ' + autoAddedItems + ' mã thiếu, bỏ ' + dupItemsRemoved + ' mã trùng), ' +
    'bỏ ' + dupLogsRemoved + ' log trùng' + (archivedCount > 0 ? ', lưu trữ ' + archivedCount + ' log cũ.' : '.');
}

function parseFlexiblePos_(rawKe, rawTang, rawO) {
  let s = code_(rawKe).replace(/^(KE|KỆ|RACK|SHELF)[:\s\-_]*/, '');
  let t = Number(String(rawTang || '').replace(/\D/g, '')) || 0;
  let o = Number(String(rawO || '').replace(/\D/g, '')) || 0;
  const m = s.match(/^K?(\d{1,2})(?:[-\s._]+T?(\d)[-\s._]+O?(\d))?$/);
  if (m) {
    const n = Number(m[1]);
    if (!t && m[2]) t = Number(m[2]);
    if (!o && m[3]) o = Number(m[3]);
    if (n >= 1 && n <= KHO.SO_KE && t >= 1 && t <= KHO.SO_TANG && o >= 1 && o <= KHO.SO_O) {
      return { ke: maKe_(n), tang: t, o: o };
    }
  }
  return null;
}

/**
 * Tự động chuyển các dòng log cũ sang sheet lưu trữ theo tháng khi Logs > MAX_LOG_ROWS (5.000 dòng)
 * để giữ cho sheet chính luôn nhẹ dưới 1.000 dòng.
 */
function archiveOldLogs() {
  ensureSetup_();
  const moved = archiveOldLogs_(true);
  return moved > 0
    ? 'Đã chuyển ' + moved + ' dòng nhật ký cũ sang sheet lưu trữ và giữ lại ' + KHO.KEEP_LOG_ROWS + ' dòng mới nhất.'
    : 'Sheet Logs hiện có dưới ' + KHO.KEEP_LOG_ROWS + ' dòng, chưa cần chuyển lưu trữ.';
}

function archiveOldLogs_(forceIfOverKeep) {
  const shLogs = sh_('Logs');
  const totalRows = shLogs.getLastRow() - 1;
  const threshold = forceIfOverKeep ? KHO.KEEP_LOG_ROWS : KHO.MAX_LOG_ROWS;
  if (totalRows <= threshold) return 0;

  const allData = shLogs.getDataRange().getValues();
  const header = allData[0];
  const rows = allData.slice(1);
  const splitIdx = rows.length - KHO.KEEP_LOG_ROWS;
  if (splitIdx <= 0) return 0;

  const toArchive = rows.slice(0, splitIdx);
  const toKeep = rows.slice(splitIdx);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ym = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy_MM');
  const archName = 'Logs_Archive_' + ym;
  let archSh = ss.getSheetByName(archName);
  if (!archSh) {
    archSh = ss.insertSheet(archName);
    archSh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    archSh.setFrozenRows(1);
  }
  archSh.getRange(archSh.getLastRow() + 1, 1, toArchive.length, header.length).setValues(toArchive);

  shLogs.getRange(2, 1, shLogs.getLastRow() - 1, header.length).clearContent();
  shLogs.getRange(2, 1, toKeep.length, header.length).setValues(toKeep);
  return toArchive.length;
}

/** Tạo Time-driven Trigger chạy tự động mỗi ngày để kiểm tra & lưu trữ Log cũ. */
function setupAutoArchiveTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'archiveOldLogs') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('archiveOldLogs').timeBased().everyDays(1).atHour(2).create();
  return 'Đã bật lịch tự động kiểm tra & lưu trữ nhật ký cũ mỗi ngày lúc 02:00 sáng.';
}

/* ============================ DỮ LIỆU MẪU & TÀI KHOẢN ============================ */

function seedSampleData() {
  ensureSetup_();
  const sampleItems = [
    { ma: 'MU-NK-DEN-41', ten: 'Mũ Nike Air Đen', model: 'NK-AIR-26', mau: 'Đen', size: '41', dvt: 'đôi', ghiChu: 'Chuyền may 01', po: 'PO2601', so: 'SO8801' },
    { ma: 'MU-NK-TRG-42', ten: 'Mũ Nike Air Trắng', model: 'NK-AIR-26', mau: 'Trắng', size: '42', dvt: 'đôi', ghiChu: 'Chuyền may 01', po: 'PO2602', so: 'SO8802' },
    { ma: 'MU-AD-XAM-40', ten: 'Mũ Adidas Run Xám', model: 'AD-RUN-08', mau: 'Xám', size: '40', dvt: 'đôi', ghiChu: 'Chuyền may 02', po: 'PO2603', so: 'SO8803' },
    { ma: 'MU-AD-NAV-43', ten: 'Mũ Adidas Run Navy', model: 'AD-RUN-08', mau: 'Navy', size: '43', dvt: 'đôi', ghiChu: 'Chuyền may 02', po: 'PO2604', so: 'SO8804' },
    { ma: 'MU-RB-NAU-39', ten: 'Mũ Reebok Classic Nâu', model: 'RB-CLS-12', mau: 'Nâu', size: '39', dvt: 'đôi', ghiChu: 'Chuyền may 03', po: 'PO2605', so: 'SO8805' },
    { ma: 'MU-PM-DO-41',  ten: 'Mũ Puma Sport Đỏ', model: 'PM-SPT-05', mau: 'Đỏ', size: '41', dvt: 'đôi', ghiChu: 'Chuyền may 04', po: 'PO2606', so: 'SO8806' }
  ];
  upsertItemsBatch_(sampleItems, true);

  const sampleStock = [
    ['K01', 1, 1, 'MU-NK-DEN-41', 120],
    ['K01', 1, 2, 'MU-NK-TRG-42', 85],
    ['K01', 2, 3, 'MU-NK-DEN-41', 60],
    ['K03', 3, 4, 'MU-AD-XAM-40', 150],
    ['K06', 2, 1, 'MU-AD-NAV-43', 95],
    ['K09', 1, 4, 'MU-RB-NAU-39', 45],
    ['K13', 1, 2, 'MU-PM-DO-41', 180],
    ['K16', 2, 2, 'MU-NK-DEN-41', 70],
    ['K20', 3, 1, 'MU-AD-XAM-40', 110],
    ['K24', 1, 4, 'MU-RB-NAU-39', 40]
  ];
  const now = new Date();
  const stockSh = sh_('Stock');
  if (stockSh.getLastRow() > 1) {
    stockSh.getRange(2, 1, stockSh.getLastRow() - 1, SHEETS.Stock.length).clearContent();
  }
  const stockRows = sampleStock.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], now]; });
  stockSh.getRange(2, 1, stockRows.length, SHEETS.Stock.length).setValues(stockRows);

  const logSh = sh_('Logs');
  const logRows = sampleStock.map(function (r, idx) {
    return [now, 'NHAP', r[0], r[1], r[2], r[3], r[4], 'admin', 'Dữ liệu mẫu', 'seed_' + Date.now() + '_' + idx];
  });
  logSh.getRange(logSh.getLastRow() + 1, 1, logRows.length, SHEETS.Logs.length).setValues(logRows);
  return 'Đã nạp ' + sampleItems.length + ' mã mũ và ' + sampleStock.length + ' vị trí tồn mẫu.';
}

function clearSampleData() {
  ensureSetup_();
  ['Stock', 'Logs'].forEach(function (name) {
    const s = sh_(name);
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, SHEETS[name].length).clearContent();
  });
  return 'Đã xoá sạch tồn kho và nhật ký mẫu. Giữ nguyên 24 kệ, danh mục mũ và tài khoản.';
}

function taoNguoiDung(ma, ten, matKhau, vaiTro) {
  ma = String(ma || '').trim().toLowerCase();
  ten = String(ten || '').trim();
  if (!ma || !matKhau) throw new Error('Thiếu mã hoặc mật khẩu');
  const role = normalizeRole_(vaiTro || 'WORKER');
  const salt = Utilities.getUuid();
  const s = sh_('Users');
  const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toLowerCase() === ma) {
      const finalTen = ten || String(data[i][1] || '').trim() || ma;
      const row = [ma, finalTen, role, salt, hash_(matKhau, salt), true];
      s.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return 'Đã cập nhật ' + ma + ' (' + role + ')';
    }
  }
  const row = [ma, ten || ma, role, salt, hash_(matKhau, salt), true];
  s.appendRow(row);
  return 'Đã tạo ' + ma + ' (' + role + ')';
}

/* ============================ HTTP (doGet / doPost + LockService) ============================ */

/**
 * doGet(e):
 *  - Nếu gọi kèm `?action=ping` hoặc `?format=json` (từ Setup Doctor / kiểm tra kết nối): trả về JSON.
 *  - Nếu mở trực tiếp URL `/exec` trên trình duyệt: trả về giao diện `Index.html` (chạy trên Apps Script,
 *    vẫn hỗ trợ mở Camera qua cầu nối GitHub Pages).
 */
function doGet(e) {
  ensureSetup_();
  const p = (e && e.parameter) || {};
  if (p.action === 'ping' || p.format === 'json') {
    return jsonResponse(pingInfo_());
  }
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle(KHO.TEN + ' — Quản lý kho thông minh')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  } catch (err) {
    return jsonResponse(pingInfo_());
  }
}

/**
 * doPost(e):
 *  - Chống xung đột dữ liệu bằng `LockService.getScriptLock()` (`tryLock(15000)`).
 *  - Ép Google Sheet lưu thay đổi ngay lập tức bằng `SpreadsheetApp.flush()` trước khi nhả khoá.
 */
function doPost(e) {
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (parseErr) {
    return jsonResponse({ ok: false, status: 'error', error: 'Dữ liệu gửi lên không đúng JSON', message: 'Dữ liệu gửi lên không đúng JSON' });
  }

  const action = String(req.action || '');
  const isReadOnly = (action === 'ping' || action === 'login' || action === 'getData' || action === 'listUsers');
  const lock = LockService.getScriptLock();

  if (!isReadOnly) {
    if (!lock.tryLock(15000)) {
      const busyMsg = 'Hệ thống đang bận xử lý lượt quét khác, vui lòng thử lại!';
      return jsonResponse({ ok: false, status: 'error', error: busyMsg, message: busyMsg });
    }
  }

  try {
    ensureSetup_();
    let result;
    if (API[action]) {
      result = API[action](req);
    } else if (action === 'NHAP' || action === 'XUAT' || action === 'KIEM_KE' || action === 'KIEMKE') {
      result = processWarehouseAction(req);
    } else {
      throw new Error('Không có chức năng: ' + action);
    }

    if (!isReadOnly) {
      SpreadsheetApp.flush();
    }
    return jsonResponse({ ok: true, status: 'success', data: result });
  } catch (err) {
    const errMsg = String(err && err.message || err);
    return jsonResponse({ ok: false, status: 'error', error: errMsg, message: errMsg });
    } finally {
    if (!isReadOnly) {
      try { lock.releaseLock(); } catch (releaseErr) {}
    }
    try { zaloFlush_(); } catch (zErr) {}
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function json_(o) { return jsonResponse(o); }

function pingInfo_() {
  return {
    ok: true,
    status: 'success',
    app: KHO.TEN,
    shelves: rows_('Shelves').length,
    itemsCount: rows_('Items').length,
    stockRowsCount: rows_('Stock').filter(function (s) { return Number(s.soLuong) > 0; }).length,
    serverTime: fmt_(new Date()),
    time: new Date().toISOString()
  };
}

const API = {
  ping: function () {
    return pingInfo_();
  },

  login: function (req) {
    const ma = String(req.ma || '').trim().toLowerCase();
    const u = rows_('Users').filter(function (x) { return String(x.ma || '').trim().toLowerCase() === ma; })[0];
    if (!u || u.hoatDong === false || String(u.hoatDong).toUpperCase() === 'FALSE') throw new Error('Sai tài khoản hoặc mật khẩu');
    if (hash_(String(req.mk || ''), u.salt) !== u.hash) throw new Error('Sai tài khoản hoặc mật khẩu');
    const userMa = String(u.ma || '').trim().toLowerCase();
    const user = { ma: userMa, ten: String(u.ten || userMa).trim(), vaiTro: normalizeRole_(u.vaiTro || 'WORKER') };
    const token = Utilities.getUuid();
    putSession_(token, user);
    return { token: token, user: user, kho: getData_(user) };
  },

  getData: function (req) {
    const user = auth_(req);
    return getData_(user);
  },

  /** Đồng bộ gộp (Batch Sync) một loạt thao tác từ hàng đợi Offline của máy. */
  sync: function (req) {
    const user = auth_(req);
    const ops = Array.isArray(req.ops) ? req.ops : [];
    return applyOps_(ops, user);
  },

  BATCH_SYNC: function (req) {
    const user = req.token
      ? auth_(req)
      : { ma: String(req.user || 'kho').trim().toLowerCase(), ten: String(req.userTen || req.user || 'Kho').trim(), vaiTro: 'WORKER' };
    const ops = Array.isArray(req.ops) ? req.ops : (Array.isArray(req.queue) ? req.queue : []);
    return applyOps_(ops, user);
  },

  cleanData: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Chỉ quản trị được làm sạch & chuẩn hóa dữ liệu');
    const msg = cleanAndNormalizeSheetData();
    return { message: msg, kho: getData_(user) };
  },

  archiveLogs: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Chỉ quản trị được lưu trữ nhật ký');
    const msg = archiveOldLogs();
    return { message: msg, kho: getData_(user) };
  },

  saveItem: function (req) {
    const user = auth_(req);
    if (!canControl_(user)) throw new Error('Tài khoản Công nhân không có quyền thêm/sửa danh mục mã mũ');
    const it = req.item || {};
    const ma = code_(it.ma);
    if (!ma) throw new Error('Thiếu mã mũ');
    const itemPayload = { ma: ma };
    if (it.ten !== undefined) itemPayload.ten = String(it.ten || ma).trim();
    if (it.model !== undefined) itemPayload.model = String(it.model || '').trim();
    if (it.mau !== undefined) itemPayload.mau = String(it.mau || '').trim();
    if (it.size !== undefined) itemPayload.size = String(it.size || '').trim();
    if (it.dvt !== undefined) itemPayload.dvt = String(it.dvt || 'đôi').trim() || 'đôi';
    if (it.ghiChu !== undefined) itemPayload.ghiChu = String(it.ghiChu || '').trim();
    if (it.po !== undefined) itemPayload.po = mergeCsvCodes_(code_(it.po), '');
    if (it.so !== undefined) itemPayload.so = mergeCsvCodes_(code_(it.so), '');
    if (it.slkh !== undefined) itemPayload.slkh = Math.max(0, Math.round(Number(it.slkh) || 0));
    upsertItemsBatch_([itemPayload], true);
    return { kho: getData_(user) };
  },

  syncItemsMeta: function (req) {
    const user = auth_(req);
    if (!canControl_(user)) throw new Error('Tài khoản Công nhân không có quyền chuẩn hoá danh mục từ kiểm kê');
    const list = Array.isArray(req.items) ? req.items : [];
    const normalized = [];
    list.forEach(function (it) {
      const ma = code_(it && it.ma).replace(/^(VT|MU):\s*/, '');
      if (!ma) return;
      const entry = {
        ma: ma,
        ten: String(it.ten || '').trim(),
        model: String(it.model || it.khuon || '').trim(),
        mau: String(it.mau || it.he || '').trim(),
        size: String(it.size || '').trim(),
        dvt: String(it.dvt || 'đôi').trim() || 'đôi',
        po: mergeCsvCodes_(code_(it.po), ''),
        so: mergeCsvCodes_(code_(it.so), ''),
        onlyUpdateExisting: !!it.onlyUpdateExisting
      };
      if (it.slkh !== undefined) entry.slkh = Math.max(0, Math.round(Number(it.slkh) || 0));
      normalized.push(entry);
    });
    if (normalized.length) {
      upsertItemsBatch_(normalized, 'sync');
    }
    return req.skipReload ? { updated: normalized.length } : { updated: normalized.length, kho: getData_(user) };
  },

  savePlanBatch: function (req) {
    const user = auth_(req);
    if (!canControl_(user)) throw new Error('Tài khoản Công nhân không có quyền Kiểm soát Kế hoạch (SLKH)');
    const list = Array.isArray(req.items) ? req.items : [];
    const normalized = [];
    list.forEach(function (it) {
      const ma = code_(it && it.ma).replace(/^(VT|MU):\s*/, '');
      if (!ma) return;
      const entry = {
        ma: ma,
        ten: String(it.ten || '').trim(),
        model: String(it.model || it.khuon || '').trim(),
        mau: String(it.mau || it.he || '').trim(),
        size: String(it.size || '').trim(),
        dvt: String(it.dvt || 'đôi').trim() || 'đôi',
        ghiChu: it.ghiChu !== undefined ? String(it.ghiChu || '').trim() : undefined,
        overwriteNote: !!(it && it.overwriteNote),
        po: mergeCsvCodes_(code_(it.po), ''),
        so: mergeCsvCodes_(code_(it.so), '')
      };
      if (it.slkh !== undefined) entry.slkh = Math.max(0, Math.round(Number(it.slkh) || 0));
      normalized.push(entry);
    });
    if (normalized.length) {
      upsertItemsBatch_(normalized, 'plan');
    }
    return req.skipReload ? { updated: normalized.length } : { updated: normalized.length, kho: getData_(user) };
  },

  deleteItem: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Chỉ quản trị được xoá mã mũ');
    const ma = code_(req.ma);
    if (!ma) throw new Error('Thiếu mã mũ');
    const hasStock = rows_('Stock').some(function (s) { return code_(s.maVT) === ma && Number(s.soLuong) > 0; });
    if (hasStock) throw new Error('Mã ' + ma + ' đang còn tồn trong kho, không thể xoá');
    const sh = sh_('Items');
    const cols = SHEETS.Items.length;
    const data = sh.getDataRange().getValues();
    const keep = [];
    for (let i = 1; i < data.length; i++) {
      if (code_(data[i][0]) !== ma) {
        const row = data[i].slice(0, cols);
        while (row.length < cols) row.push('');
        keep.push(row);
      }
    }
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, cols).clearContent();
    if (keep.length > 0) sh.getRange(2, 1, keep.length, cols).setValues(keep);
    return { kho: getData_(user) };
  },

  seedSample: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Chỉ quản trị được nạp dữ liệu mẫu');
    const msg = seedSampleData();
    return { message: msg, kho: getData_(user) };
  },

  clearSample: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Chỉ quản trị được xoá dữ liệu');
    const msg = clearSampleData();
    return { message: msg, kho: getData_(user) };
  },

  addUser: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Chỉ quản trị được thêm người dùng');
    return taoNguoiDung(req.ma, req.ten, req.mk, req.vaiTro);
  },

  listUsers: function (req) {
    const user = auth_(req);
    if (!isAdmin_(user)) throw new Error('Không có quyền');
    return rows_('Users').map(function (u) { return { ma: u.ma, ten: u.ten, vaiTro: u.vaiTro, hoatDong: u.hoatDong }; });
  },

  saveSlotNote: function (req) {
    const loc = String(req.loc || '').trim().toUpperCase();
    const note = String(req.note || '').trim();
    if (!loc) throw new Error('Thiếu mã vị trí ô kệ');
    const props = PropertiesService.getScriptProperties();
    let map = {};
    try { map = JSON.parse(props.getProperty('SLOT_NOTES') || '{}'); } catch (e) {}
    if (note) {
      map[loc] = {
        note: note,
        px: String(req.px || '').trim(),
        chuyen: String(req.chuyen || '').trim(),
        status: String(req.status || '').trim(),
        time: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'),
        user: (req.user && (req.user.ten || req.user.ma)) || String(req.user || 'kho')
      };
    } else {
      delete map[loc];
    }
    props.setProperty('SLOT_NOTES', JSON.stringify(map));
    return { ok: true, slotNotes: map };
  },

  getSlotNotes: function () {
    const props = PropertiesService.getScriptProperties();
    let map = {};
    try { map = JSON.parse(props.getProperty('SLOT_NOTES') || '{}'); } catch (e) {}
    return map;
  }
};

/* ============================ NGHIỆP VỤ (ĐỌC 1 LẦN, GHI 1 LẦN) ============================ */

/**
 * Xử lý 1 thao tác đơn lẻ theo chuẩn payload { transactionId, action, binCode, hatCode, qty, user }
 * bằng cách chuyển vào bộ xử lý mảng `applyOps_` (Đọc 1 lần - Ghi 1 lần).
 */
function processWarehouseAction(payload) {
  const p = parseFlexiblePos_(payload.binCode || payload.ke, payload.tang, payload.o);
  if (!p) throw new Error('Mã vị trí ô kệ không hợp lệ: ' + (payload.binCode || payload.ke || ''));
  const loai = code_(payload.action || payload.loai) === 'KIEM_KE' ? 'KIEMKE' : code_(payload.action || payload.loai);
  const op = {
    id: String(payload.transactionId || payload.id || ('tx_' + Date.now())),
    loai: loai,
    ke: p.ke,
    tang: p.tang,
    o: p.o,
    maVT: code_(payload.hatCode || payload.maVT),
    soLuong: Number(payload.qty !== undefined ? payload.qty : payload.soLuong),
    ghiChu: String(payload.ghiChu || '')
  };
  const user = payload.token
    ? auth_(payload)
    : { ma: String(payload.user || 'kho').trim().toLowerCase(), ten: String(payload.userTen || '').trim() };
  const res = applyOps_([op], user);
  const first = (res.results && res.results[0]) || {};
  if (!first.ok) throw new Error(first.error || 'Lỗi ghi dữ liệu kho');
  return { message: first.dup ? 'Giao dịch đã được ghi nhận trước đó' : 'Đồng bộ thành công', duplicate: !!first.dup, kho: res.kho };
}

function getData_(user) {
  const canSeeLogs = !user || isAdmin_(user);
  const canSeeControl = !user || canControl_(user);
  const logs = sh_('Logs').getDataRange().getValues();
  const head = logs.shift() || SHEETS.Logs;
  const logPoSoMap = {};
  const logStats = {};
  for (let i = 0; i < logs.length; i++) {
    const r = logs[i];
    const ma = code_(r[5]).replace(/^(VT|MU):\s*/, '');
    if (!ma) continue;
    const noteStr = String(r[8] || '');
    const ext = extractPoSoFromNote_(noteStr);
    if (ext.po || ext.so) {
      if (!logPoSoMap[ma]) logPoSoMap[ma] = { po: '', so: '' };
      if (ext.po) logPoSoMap[ma].po = mergeCsvCodes_(logPoSoMap[ma].po, ext.po);
      if (ext.so) logPoSoMap[ma].so = mergeCsvCodes_(logPoSoMap[ma].so, ext.so);
    }
    const loai = code_(r[1]);
    const rawQty = Number(r[6]) || 0;
    const isReloc = /Sắp kệ từ|Chuyển vị trí/i.test(noteStr);
    if (!logStats[ma]) {
      logStats[ma] = { nhap: 0, xuat: 0, kiemKeDelta: 0, lastIn: '', lastOut: '', lastChuyen: '', lastPx: '' };
    }
    const st = logStats[ma];
    if (!isReloc) {
      if (loai === 'NHAP' && rawQty !== 0) {
        st.nhap += Math.abs(rawQty);
        st.lastIn = fmt_(r[0]);
      } else if (loai === 'XUAT' && rawQty !== 0) {
        st.xuat += Math.abs(rawQty);
        st.lastOut = fmt_(r[0]);
        const goLine = noteStr.match(/G[oò]\s*Line\s*(\d+)/i);
        const goTT = noteStr.match(/G[oò]\s*(?:truy[eêề]n\s*th[oôố]ng|TT)\s*(\d+)/i);
        const chLeg = noteStr.match(/Chuy[eêề]n(?:\s*g[oò])?\s*(\d+)/i);
        if (goLine) st.lastChuyen = 'Gò Line ' + goLine[1];
        else if (goTT) st.lastChuyen = 'Gò truyền thống ' + goTT[1];
        else if (chLeg) st.lastChuyen = 'Chuyền ' + chLeg[1];
        const pxM = noteStr.match(/PX\s*([A-Z]\d)/i);
        if (pxM) st.lastPx = 'PX ' + pxM[1].toUpperCase();
      } else if (loai === 'KIEMKE' || loai === 'KIEM_KE') {
        st.kiemKeDelta += rawQty;
      }
    }
  }
  const recent = logs.slice(-100).reverse().map(function (r) {
    const o = {}; head.forEach(function (k, i) { o[k] = r[i]; });
    o.thoiGian = fmt_(o.thoiGian);
    return o;
  });
  const items = rows_('Items').map(function (it) {
    const ma = code_(it.ma).replace(/^(VT|MU):\s*/, '');
    const fromNote = extractPoSoFromNote_(it.ghiChu);
    const fromLogs = logPoSoMap[ma] || { po: '', so: '' };
    let po = mergeCsvCodes_(it.po, '');
    let so = mergeCsvCodes_(it.so, '');
    if (!po && fromNote.po) po = fromNote.po;
    if (!so && fromNote.so) so = fromNote.so;
    if (!po && fromLogs.po) po = fromLogs.po;
    if (!so && fromLogs.so) so = fromLogs.so;
    it.po = po;
    it.so = so;
    it.slkh = Math.max(0, Math.round(Number(it.slkh) || 0));
    return it;
  });
  let slotNotes = {};
  try { slotNotes = JSON.parse(PropertiesService.getScriptProperties().getProperty('SLOT_NOTES') || '{}'); } catch (e) {}
  return {
    kho: KHO,
    shelves: rows_('Shelves'),
    items: items,
    stock: rows_('Stock').filter(function (s) { return Number(s.soLuong) > 0; })
      .map(function (s) {
        return {
          ke: code_(s.ke),
          tang: Number(s.tang),
          o: Number(s.o),
          maVT: code_(s.maVT).replace(/^(VT|MU):\s*/, ''),
          soLuong: Number(s.soLuong)
        };
      }),
    logStats: canSeeControl ? logStats : {},
    slotNotes: slotNotes,
    logs: canSeeLogs ? recent : [],
    serverTime: fmt_(new Date())
  };
}

/**
 * Đọc danh sách họ tên nhân viên theo mã từ sheet Users.
 */
function getUserNameMap_() {
  const v = sh_('Users').getDataRange().getValues();
  if (!v || v.length < 2) return {};
  const head = (v[0] || []).map(function (h) { return String(h || '').trim().toLowerCase(); });
  let maIdx = head.indexOf('ma');
  if (maIdx < 0) maIdx = 0;
  let tenIdx = head.findIndex(function (h) { return h === 'ten' || h.indexOf('ten') >= 0 || h.indexOf('tên') >= 0; });
  if (tenIdx < 0) tenIdx = 1;
  const map = {};
  for (let i = 1; i < v.length; i++) {
    const k = String(v[i][maIdx] || '').trim().toLowerCase();
    const t = String(v[i][tenIdx] || '').trim();
    if (k && t) map[k] = t;
  }
  return map;
}

/**
 * Đọc toàn bộ Stock, Logs, Items 1 lần vào RAM -> tính toán -> Ghi ngược lại 1 lần bằng `setValues()`.
 */
function applyOps_(ops, user) {
  const stockSh = sh_('Stock');
  const stock = stockSh.getDataRange().getValues(); // gồm dòng tiêu đề
  const logSh = sh_('Logs');
  const lastLog = logSh.getLastRow();
  const doneIds = {};
  if (lastLog > 1) {
    const from = Math.max(2, lastLog - 2000);
    logSh.getRange(from, 10, lastLog - from + 1, 1).getValues().forEach(function (r) { if (r[0]) doneIds[String(r[0]).trim()] = true; });
  }
  const itemCodes = {};
  rows_('Items').forEach(function (i) { itemCodes[code_(i.ma)] = true; });
  const userNameMap = getUserNameMap_();

  const results = [];
  const newLogs = [];
  const newItems = [];
  const itemMetaUpdates = [];
  let stockChanged = false;
  const now = new Date();

  ops.forEach(function (op) {
    try {
      const txId = String((op && (op.id || op.transactionId)) || '').trim();
      if (!op || !txId) throw new Error('Thiếu mã giao dịch (transactionId/id)');
      if (doneIds[txId]) { results.push({ id: txId, ok: true, dup: true }); return; }

      const opUserMa = String((user && user.ma) || (op && op.nguoi) || 'kho').trim().toLowerCase();
      const sheetTen = userNameMap[opUserMa] || '';
      const sessTen = String((user && user.ten) || (op && op.nguoiTen) || '').trim();
      const opUserTen = (sheetTen && sheetTen.toLowerCase() !== opUserMa)
        ? sheetTen
        : ((sessTen && sessTen.toLowerCase() !== opUserMa) ? sessTen : (sheetTen || sessTen));
      const logNguoi = (opUserTen && opUserTen.toLowerCase() !== opUserMa)
        ? (opUserTen + ' (' + opUserMa + ')')
        : (opUserTen || opUserMa);

      const p = parseFlexiblePos_(op.ke || op.binCode, op.tang, op.o);
      if (!p) throw new Error('Vị trí kệ/tầng/ô không hợp lệ: ' + (op.ke || op.binCode || ''));
      const ke = p.ke, tang = p.tang, o = p.o;
      const ma = code_(op.maVT || op.hatCode).replace(/^(VT|MU):\s*/, '');
      const sl = Math.round(Number(op.soLuong !== undefined ? op.soLuong : op.qty) || 0);
      const loaiRaw = code_(op.loai || op.action);
      const loai = loaiRaw === 'KIEM_KE' ? 'KIEMKE' : loaiRaw;
      validPos_(ke, tang, o);
      if (!ma) throw new Error('Thiếu mã mũ');

      let idx = -1;
      let cur = 0;
      const dupIdxs = [];
      for (let i = 1; i < stock.length; i++) {
        const rowMa = code_(stock[i][3]).replace(/^(VT|MU):\s*/, '');
        if (code_(stock[i][0]) === ke && Number(stock[i][1]) === tang && Number(stock[i][2]) === o && rowMa === ma) {
          cur += Number(stock[i][4]) || 0;
          if (idx < 0) idx = i;
          else dupIdxs.push(i);
        }
      }
      let next = cur, delta = 0, note = op.ghiChu || '';

      const notePoSo = extractPoSoFromNote_(op.ghiChu);
      const opPo = mergeCsvCodes_(code_(op.po), notePoSo.po);
      const opSo = mergeCsvCodes_(code_(op.so), notePoSo.so);
      const opModel = String(op.khuon || op.model || '').trim();
      const opMau = String(op.he || op.mau || '').trim();
      const opSize = String(op.size || '').trim();

      if (loai === 'NHAP') {
        if (sl <= 0) throw new Error('Số lượng phải > 0');
        next = cur + sl; delta = sl;
        if (!itemCodes[ma]) {
          newItems.push({
            ma: ma,
            ten: op.tenVT || op.ten || ma,
            model: opModel,
            mau: opMau,
            size: opSize,
            dvt: op.dvt || 'đôi',
            ghiChu: '',
            po: opPo,
            so: opSo
          });
          itemCodes[ma] = true;
        } else if (opPo || opSo || opModel || opMau || opSize) {
          itemMetaUpdates.push({
            ma: ma,
            ten: op.tenVT || op.ten || '',
            model: opModel,
            mau: opMau,
            size: opSize,
            po: opPo,
            so: opSo
          });
        }
      } else if (loai === 'XUAT') {
        if (sl <= 0) throw new Error('Số lượng phải > 0');
        if (sl > cur) {
          zaloQueue_({ loai: 'XUAT_THIEU', ke: ke, tang: tang, o: o, ma: ma, sl: sl, cur: cur,
                       note: op.ghiChu || '', userMa: opUserMa, userTen: opUserTen, time: now });
          throw new Error('Ô ' + ke + '-T' + tang + '-O' + o + ' chỉ còn ' + cur + ' ' + ma);
        }
        next = cur - sl; delta = -sl;
      } else if (loai === 'KIEMKE') {
        if (isWorker_(user)) throw new Error('Tài khoản Công nhân không có quyền Kiểm kê & Đối chiếu');
        if (sl < 0) throw new Error('Số đếm không hợp lệ');
        next = sl; delta = sl - cur;
        note = 'Hệ thống: ' + cur + ' → Thực tế: ' + sl + (note ? ' · ' + note : '');
        if (!itemCodes[ma] && sl > 0) {
          newItems.push({
            ma: ma,
            ten: op.tenVT || op.ten || ma,
            model: opModel,
            mau: opMau,
            size: opSize,
            dvt: op.dvt || 'đôi',
            ghiChu: '',
            po: opPo,
            so: opSo
          });
          itemCodes[ma] = true;
        } else if (itemCodes[ma] && (opPo || opSo || opModel || opMau || opSize)) {
          itemMetaUpdates.push({
            ma: ma,
            ten: op.tenVT || op.ten || '',
            model: opModel,
            mau: opMau,
            size: opSize,
            po: opPo,
            so: opSo
          });
        }
      } else {
        throw new Error('Loại thao tác không hợp lệ: ' + loai);
      }

      if (idx > 0) {
        stock[idx][0] = ke; stock[idx][1] = tang; stock[idx][2] = o; stock[idx][3] = ma;
        stock[idx][4] = next; stock[idx][5] = now;
        dupIdxs.forEach(function (di) { stock[di][4] = 0; });
        stockChanged = true;
      } else if (next > 0) {
        stock.push([ke, tang, o, ma, next, now]);
        stockChanged = true;
      }

      newLogs.push([now, loai, ke, tang, o, ma, delta, logNguoi, note, txId]);
      let tongMa = 0;
      for (let i = 1; i < stock.length; i++) if (code_(stock[i][3]) === ma) tongMa += Number(stock[i][4]) || 0;
      zaloQueue_({ loai: loai, ke: ke, tang: tang, o: o, ma: ma, sl: Math.abs(delta), delta: delta,
                   cur: cur, next: next, tongMa: tongMa, note: note,
                   userMa: opUserMa, userTen: opUserTen, time: now });
      doneIds[txId] = true;
      results.push({ id: txId, ok: true, soLuong: next });
    } catch (err) {
      results.push({ id: op && (op.id || op.transactionId), ok: false, error: String(err.message || err) });
    }
  });

  // Ghi gộp danh mục mã mới & cập nhật metadata (PO, SO, Hệ, Khuôn) trong 1 lần
  if (newItems.length) {
    upsertItemsBatch_(newItems, false);
  }
  if (itemMetaUpdates.length) {
    upsertItemsBatch_(itemMetaUpdates, 'merge');
  }

  // Ghi gộp bảng tồn kho trong 1 lần (chỉ giữ dòng soLuong > 0 để bảng luôn sạch)
  if (stockChanged) {
    const cleanBody = stock.slice(1).filter(function (r) { return Number(r[4]) > 0; });
    if (stockSh.getLastRow() > 1) {
      stockSh.getRange(2, 1, stockSh.getLastRow() - 1, SHEETS.Stock.length).clearContent();
    }
    if (cleanBody.length) {
      stockSh.getRange(2, 1, cleanBody.length, SHEETS.Stock.length).setValues(cleanBody);
    }
  }

  // Ghi gộp lịch sử trong 1 lần
  if (newLogs.length) {
    logSh.getRange(lastLog + 1, 1, newLogs.length, SHEETS.Logs.length).setValues(newLogs);
    if (lastLog + newLogs.length > KHO.MAX_LOG_ROWS) {
      try { archiveOldLogs_(); } catch (archErr) {}
    }
  }

  return { results: results, kho: getData_(user) };
}

/**
 * Cập nhật hoặc thêm mới nhiều mã mũ trong 1 lần đọc + 1 lần ghi (`setValues`).
 * mode: false (chỉ thêm mới), true (ghi đè các trường được truyền), 'merge' (giữ ghi chú cũ, bổ sung metadata & gộp PO/SO),
 *       'sync' (chuẩn hoá từ file Excel MŨ BTP: sửa tên thiếu/trùng mã, cập nhật model/màu/size, gộp PO/SO, giữ ghi chú cũ).
 */
function upsertItemsBatch_(itemsList, mode) {
  if (!itemsList || !itemsList.length) return;
  const s = sh_('Items');
  const cols = SHEETS.Items.length;
  const toSlkhCell = function (v) {
    const n = Math.max(0, Math.round(Number(v) || 0));
    return n > 0 ? n : '';
  };
  const data = s.getDataRange().getValues();
  const mapIdx = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i].slice(0, cols);
    while (row.length < cols) row.push('');
    data[i] = row;
    const k = code_(row[0]);
    if (k) mapIdx[k] = i;
  }
  let changed = false;
  itemsList.forEach(function (it) {
    const ma = code_(it.ma);
    if (!ma) return;
    if (mapIdx[ma] !== undefined) {
      const existing = data[mapIdx[ma]];
      if (mode === true) {
        SHEETS.Items.forEach(function (k, idx) {
          if (idx === 0) { existing[0] = ma; return; }
          if (it[k] !== undefined) {
            const val = (k === 'po' || k === 'so') ? mergeCsvCodes_(it[k], '') : (k === 'slkh' ? toSlkhCell(it.slkh) : it[k]);
            if (existing[idx] !== val) { existing[idx] = val; changed = true; }
          }
        });
      } else if (mode === 'merge') {
        const newTen = String(it.ten || '').trim();
        if (newTen && newTen !== ma && (!String(existing[1] || '').trim() || code_(existing[1]) === ma)) {
          existing[1] = newTen; changed = true;
        }
        if (it.model && !String(existing[2] || '').trim()) { existing[2] = String(it.model).trim(); changed = true; }
        if (it.mau && !String(existing[3] || '').trim()) { existing[3] = String(it.mau).trim(); changed = true; }
        if (it.size && !String(existing[4] || '').trim()) { existing[4] = String(it.size).trim(); changed = true; }
        if (it.dvt && !String(existing[5] || '').trim()) { existing[5] = String(it.dvt).trim(); changed = true; }
        const mergedPo = mergeCsvCodes_(existing[7], it.po);
        if (mergedPo !== String(existing[7] || '').trim()) { existing[7] = mergedPo; changed = true; }
        const mergedSo = mergeCsvCodes_(existing[8], it.so);
        if (mergedSo !== String(existing[8] || '').trim()) { existing[8] = mergedSo; changed = true; }
        if (it.slkh !== undefined && Number(it.slkh) > 0) {
          const slkhCell = toSlkhCell(it.slkh);
          if (existing[9] !== slkhCell) { existing[9] = slkhCell; changed = true; }
        }
      } else if (mode === 'sync') {
        const newTen = String(it.ten || '').trim();
        if (newTen && code_(newTen) !== ma && String(existing[1] || '').trim() !== newTen) {
          existing[1] = newTen; changed = true;
        }
        const newModel = String(it.model || it.khuon || '').trim();
        if (newModel && String(existing[2] || '').trim() !== newModel) { existing[2] = newModel; changed = true; }
        const newMau = String(it.mau || it.he || '').trim();
        if (newMau && String(existing[3] || '').trim() !== newMau) { existing[3] = newMau; changed = true; }
        const newSize = String(it.size || '').trim();
        if (newSize && String(existing[4] || '').trim() !== newSize) { existing[4] = newSize; changed = true; }
        if (!String(existing[5] || '').trim()) { existing[5] = String(it.dvt || 'đôi').trim() || 'đôi'; changed = true; }
        const mergedPo = mergeCsvCodes_(existing[7], it.po);
        if (mergedPo !== String(existing[7] || '').trim()) { existing[7] = mergedPo; changed = true; }
        const mergedSo = mergeCsvCodes_(existing[8], it.so);
        if (mergedSo !== String(existing[8] || '').trim()) { existing[8] = mergedSo; changed = true; }
        if (it.slkh !== undefined && Number(it.slkh) > 0) {
          const slkhCell = toSlkhCell(it.slkh);
          if (existing[9] !== slkhCell) { existing[9] = slkhCell; changed = true; }
        }
      } else if (mode === 'plan') {
        if (it.slkh !== undefined) {
          const slkhCell = toSlkhCell(it.slkh);
          if (existing[9] !== slkhCell) { existing[9] = slkhCell; changed = true; }
        }
        const newTen = String(it.ten || '').trim();
        if (newTen && code_(newTen) !== ma && (!String(existing[1] || '').trim() || code_(existing[1]) === ma)) {
          existing[1] = newTen; changed = true;
        }
        const newModel = String(it.model || it.khuon || '').trim();
        if (newModel && !String(existing[2] || '').trim()) { existing[2] = newModel; changed = true; }
        const newMau = String(it.mau || it.he || '').trim();
        if (newMau && !String(existing[3] || '').trim()) { existing[3] = newMau; changed = true; }
        const newSize = String(it.size || '').trim();
        if (newSize && !String(existing[4] || '').trim()) { existing[4] = newSize; changed = true; }
        if (!String(existing[5] || '').trim()) { existing[5] = String(it.dvt || 'đôi').trim() || 'đôi'; changed = true; }
        if (it.overwriteNote && it.ghiChu !== undefined) {
          const nextNote = String(it.ghiChu || '').trim();
          if (String(existing[6] || '').trim() !== nextNote) { existing[6] = nextNote; changed = true; }
        } else if (it.ghiChu && !String(existing[6] || '').trim()) {
          existing[6] = String(it.ghiChu).trim(); changed = true;
        }
        const mergedPo = mergeCsvCodes_(existing[7], it.po);
        if (mergedPo !== String(existing[7] || '').trim()) { existing[7] = mergedPo; changed = true; }
        const mergedSo = mergeCsvCodes_(existing[8], it.so);
        if (mergedSo !== String(existing[8] || '').trim()) { existing[8] = mergedSo; changed = true; }
      }
    } else if (!(mode === 'sync' && it.onlyUpdateExisting)) {
      const row = SHEETS.Items.map(function (k) {
        if (k === 'ma') return ma;
        if (k === 'ten') return String(it.ten || ma).trim() || ma;
        if (k === 'model') return String(it.model || it.khuon || '').trim();
        if (k === 'mau') return String(it.mau || it.he || '').trim();
        if (k === 'dvt') return String(it.dvt || 'đôi').trim() || 'đôi';
        if (k === 'po' || k === 'so') return mergeCsvCodes_(it[k], '');
        if (k === 'slkh') return toSlkhCell(it.slkh);
        return it[k] === undefined ? '' : it[k];
      });
      mapIdx[ma] = data.length;
      data.push(row);
      changed = true;
    }
  });
  if (changed && data.length > 1) {
    const body = data.slice(1);
    try { s.getRange(2, 8, body.length, 2).setNumberFormat('@'); } catch (e) {}
    s.getRange(2, 1, body.length, cols).setValues(body);
  }
}

/* ============================ PHIÊN & TIỆN ÍCH ============================ */

function putSession_(token, user) {
  const payload = { user: user, exp: Date.now() + KHO.PHIEN_GIAY * 1000 };
  const raw = JSON.stringify(payload);
  CacheService.getScriptCache().put('t_' + token, raw, Math.min(21600, KHO.PHIEN_GIAY));
  const props = PropertiesService.getScriptProperties();
  props.setProperty('tok_' + token, raw);
  cleanupSessions_(props);
}

function getSession_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  let raw = cache.get('t_' + token);
  if (!raw) {
    raw = PropertiesService.getScriptProperties().getProperty('tok_' + token);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.exp > Date.now()) {
          const ttl = Math.max(60, Math.min(21600, Math.floor((parsed.exp - Date.now()) / 1000)));
          cache.put('t_' + token, raw, ttl);
        }
      } catch (e) {}
    }
  }
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || !obj.user || (obj.exp && obj.exp < Date.now())) {
      PropertiesService.getScriptProperties().deleteProperty('tok_' + token);
      cache.remove('t_' + token);
      return null;
    }
    return obj.user;
  } catch (e) {
    return null;
  }
}

function cleanupSessions_(props) {
  try {
    const all = props.getProperties();
    const now = Date.now();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('tok_') !== 0) return;
      try {
        const o = JSON.parse(all[k]);
        if (!o || (o.exp && o.exp < now)) props.deleteProperty(k);
      } catch (e) {
        props.deleteProperty(k);
      }
    });
  } catch (e) {}
}

function normalizeRole_(vaiTro) {
  const r = String(vaiTro || '').trim().toUpperCase();
  if (r === 'ADMIN' || r === 'QUANTRI' || r === 'QUẢN TRỊ') return 'ADMIN';
  if (r === 'THUKHO' || r === 'THU_KHO' || r === 'THỦ KHO' || r === 'KEEPER') return 'THUKHO';
  if (r === 'WORKER' || r === 'CONGNHAN' || r === 'CONG_NHAN' || r === 'CÔNG NHÂN' || r === 'CN') return 'WORKER';
  return 'WORKER';
}

function isAdmin_(user) {
  return !!(user && normalizeRole_(user.vaiTro) === 'ADMIN');
}

function isWorker_(user) {
  return !!(user && user.vaiTro !== undefined && user.vaiTro !== '' && normalizeRole_(user.vaiTro) === 'WORKER');
}

function canControl_(user) {
  if (!user) return false;
  const r = normalizeRole_(user.vaiTro);
  return r === 'ADMIN' || r === 'THUKHO';
}

function auth_(req) {
  const user = getSession_(String(req.token || ''));
  if (!user) throw new Error('PHIEN_HET_HAN');
  return user;
}

function validPos_(ke, tang, o) {
  const n = Number(String(ke).replace(/\D/g, ''));
  if (!/^K\d{2}$/.test(ke) || n < 1 || n > KHO.SO_KE) throw new Error('Kệ không hợp lệ: ' + ke);
  if (!(tang >= 1 && tang <= KHO.SO_TANG)) throw new Error('Tầng không hợp lệ: ' + tang);
  if (!(o >= 1 && o <= KHO.SO_O)) throw new Error('Ô không hợp lệ: ' + o);
}

function maKe_(i) { return 'K' + (i < 10 ? '0' : '') + i; }
function code_(v) { return String(v === undefined || v === null ? '' : v).trim().toUpperCase(); }

function mergeCsvCodes_(a, b) {
  const seen = {};
  const out = [];
  [a, b].forEach(function (src) {
    String(src === undefined || src === null ? '' : src)
      .split(/[,;|\n\r]+/)
      .forEach(function (part) {
        const v = code_(part);
        if (v && v !== '0' && v !== '—' && !seen[v]) {
          seen[v] = true;
          out.push(v);
        }
      });
  });
  return out.join(', ');
}

function extractPoSoFromNote_(note) {
  const s = String(note || '');
  if (!s) return { po: '', so: '' };
  const poM = s.match(/(?:^|[\s·|;,(\[])PO\s*[:#\-]\s*([^·|;\n\r()]+?)(?=\s*(?:·|\||;|\(|\)|$|,?\s*(?:PO|SO|H[EỆ]|KHU[OÔ]N|CHUY[EỀ]N|PX)\s*[:#\-\d]))/i);
  const soM = s.match(/(?:^|[\s·|;,(\[])SO\s*[:#\-]\s*([^·|;\n\r()]+?)(?=\s*(?:·|\||;|\(|\)|$|,?\s*(?:PO|SO|H[EỆ]|KHU[OÔ]N|CHUY[EỀ]N|PX)\s*[:#\-\d]))/i);
  return {
    po: poM ? mergeCsvCodes_(poM[1], '') : '',
    so: soM ? mergeCsvCodes_(soM[1], '') : ''
  };
}

function sh_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  const expected = SHEETS[name];
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
    s.setFrozenRows(1);
  } else if (expected) {
    const lastCol = s.getLastColumn();
    if (lastCol === 0) {
      s.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
      s.setFrozenRows(1);
    } else if (lastCol < expected.length) {
      const missing = expected.slice(lastCol);
      s.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    }
  }
  return s;
}

function rows_(name) {
  const v = sh_(name).getDataRange().getValues();
  const h = v.shift();
  return v.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    const o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
}

function hash_(s, salt) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + s, Utilities.Charset.UTF_8));
}

function fmt_(d) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'dd/MM HH:mm');
}
