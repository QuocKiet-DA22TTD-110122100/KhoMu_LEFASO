/**
 * KHO MŨ TBS — Backend Google Apps Script (API cho giao diện GitHub Pages).
 * Dữ liệu lưu trong chính Google Sheet gắn với script này.
 *
 * Cài đặt nhanh:
 *  1. Tạo Google Sheet mới → Tiện ích mở rộng → Apps Script → dán toàn bộ file này.
 *  2. Bấm Triển khai → Tùy chọn triển khai mới → Ứng dụng web
 *     (Thực thi với tư cách: Tôi · Người có quyền truy cập: Bất kỳ ai) → copy URL /exec.
 *  3. Mở web GitHub Pages → Cài đặt → dán URL /exec → hệ thống tự cài đặt cấu trúc 24 kệ × 3 tầng × 4 ô.
 *  (Hoặc vào menu "Kho Mũ TBS" trên thanh công cụ Google Sheet để chạy cài đặt thủ công).
 */

const KHO = {
  TEN: 'Kho Mũ TBS',
  SO_KE: 24,            // K01 → K24 (Dãy A: K01–K12, Dãy B: K13–K24)
  SO_TANG: 3,           // T1 (đáy) → T3 (trên cùng)
  SO_O: 4,              // O1 → O4 (trái → phải)
  PHIEN_GIAY: 12 * 60 * 60 // 12 giờ (trọn ca làm việc)
};

const SHEETS = {
  Shelves: ['ma', 'khu', 'soTang', 'soO', 'ghiChu'],
  Items:   ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu'],
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
      .addItem('2. Nạp dữ liệu mẫu để test', 'seedSampleData')
      .addItem('3. Xoá sạch dữ liệu mẫu (giữ kệ & tài khoản)', 'clearSampleData')
      .addSeparator()
      .addItem('4. Reset mật khẩu admin về 123456', 'resetAdminPassword')
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
  lock.waitLock(15000);
  try {
    setup();
  } finally {
    lock.releaseLock();
  }
}

function resetAdminPassword() {
  ensureSetup_();
  return taoNguoiDung('admin', 'Quản trị', '123456', 'ADMIN');
}

function seedSampleData() {
  ensureSetup_();
  const sampleItems = [
    { ma: 'MU-NK-DEN-41', ten: 'Mũ Nike Air Đen', model: 'NK-AIR-26', mau: 'Đen', size: '41', dvt: 'đôi', ghiChu: 'Chuyền may 01' },
    { ma: 'MU-NK-TRG-42', ten: 'Mũ Nike Air Trắng', model: 'NK-AIR-26', mau: 'Trắng', size: '42', dvt: 'đôi', ghiChu: 'Chuyền may 01' },
    { ma: 'MU-AD-XAM-40', ten: 'Mũ Adidas Run Xám', model: 'AD-RUN-08', mau: 'Xám', size: '40', dvt: 'đôi', ghiChu: 'Chuyền may 02' },
    { ma: 'MU-AD-NAV-43', ten: 'Mũ Adidas Run Navy', model: 'AD-RUN-08', mau: 'Navy', size: '43', dvt: 'đôi', ghiChu: 'Chuyền may 02' },
    { ma: 'MU-RB-NAU-39', ten: 'Mũ Reebok Classic Nâu', model: 'RB-CLS-12', mau: 'Nâu', size: '39', dvt: 'đôi', ghiChu: 'Chuyền may 03' },
    { ma: 'MU-PM-DO-41',  ten: 'Mũ Puma Sport Đỏ', model: 'PM-SPT-05', mau: 'Đỏ', size: '41', dvt: 'đôi', ghiChu: 'Chuyền may 04' }
  ];
  sampleItems.forEach(function (it) { upsertItem_(it, true); });

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
    if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
  });
  return 'Đã xoá sạch tồn kho và nhật ký mẫu. Giữ nguyên 24 kệ, danh mục mũ và tài khoản.';
}

/** Có thể chạy trực tiếp trong trình soạn thảo để thêm người dùng. */
function taoNguoiDung(ma, ten, matKhau, vaiTro) {
  ma = String(ma).trim().toLowerCase();
  if (!ma || !matKhau) throw new Error('Thiếu mã hoặc mật khẩu');
  const salt = Utilities.getUuid();
  const s = sh_('Users');
  const data = s.getDataRange().getValues();
  const row = [ma, ten || ma, (vaiTro || 'WORKER').toUpperCase(), salt, hash_(matKhau, salt), true];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === ma) {
      s.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return 'Đã cập nhật ' + ma;
    }
  }
  s.appendRow(row);
  return 'Đã tạo ' + ma;
}

/* ============================ HTTP ============================ */

function doGet() {
  ensureSetup_();
  return json_(pingInfo_());
}

function doPost(e) {
  try {
    ensureSetup_();
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = API[req.action];
    if (!fn) throw new Error('Không có chức năng: ' + req.action);
    return json_({ ok: true, data: fn(req) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function pingInfo_() {
  return {
    ok: true,
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
    const u = rows_('Users').filter(function (x) { return String(x.ma).toLowerCase() === ma; })[0];
    if (!u || u.hoatDong === false || String(u.hoatDong).toUpperCase() === 'FALSE') throw new Error('Sai tài khoản hoặc mật khẩu');
    if (hash_(String(req.mk || ''), u.salt) !== u.hash) throw new Error('Sai tài khoản hoặc mật khẩu');
    const user = { ma: u.ma, ten: u.ten, vaiTro: String(u.vaiTro).toUpperCase() };
    const token = Utilities.getUuid();
    putSession_(token, user);
    return { token: token, user: user, kho: getData_() };
  },

  getData: function (req) {
    auth_(req);
    return getData_();
  },

  /** Đồng bộ một loạt thao tác từ hàng đợi của máy. Mỗi thao tác có clientId để không ghi trùng. */
  sync: function (req) {
    const user = auth_(req);
    const ops = Array.isArray(req.ops) ? req.ops : [];
    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      return applyOps_(ops, user);
    } finally {
      lock.releaseLock();
    }
  },

  saveItem: function (req) {
    auth_(req);
    const it = req.item || {};
    const ma = code_(it.ma);
    if (!ma) throw new Error('Thiếu mã mũ');
    upsertItem_({
      ma: ma,
      ten: String(it.ten || ma).trim(),
      model: String(it.model || '').trim(),
      mau: String(it.mau || '').trim(),
      size: String(it.size || '').trim(),
      dvt: String(it.dvt || 'đôi').trim(),
      ghiChu: String(it.ghiChu || '').trim()
    }, true);
    return { kho: getData_() };
  },

  deleteItem: function (req) {
    const user = auth_(req);
    if (user.vaiTro !== 'ADMIN') throw new Error('Chỉ quản trị được xoá mã mũ');
    const ma = code_(req.ma);
    if (!ma) throw new Error('Thiếu mã mũ');
    const hasStock = rows_('Stock').some(function (s) { return code_(s.maVT) === ma && Number(s.soLuong) > 0; });
    if (hasStock) throw new Error('Mã ' + ma + ' đang còn tồn trong kho, không thể xoá');
    const sh = sh_('Items');
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (code_(data[i][0]) === ma) sh.deleteRow(i + 1);
    }
    return { kho: getData_() };
  },

  seedSample: function (req) {
    const user = auth_(req);
    if (user.vaiTro !== 'ADMIN') throw new Error('Chỉ quản trị được nạp dữ liệu mẫu');
    const msg = seedSampleData();
    return { message: msg, kho: getData_() };
  },

  clearSample: function (req) {
    const user = auth_(req);
    if (user.vaiTro !== 'ADMIN') throw new Error('Chỉ quản trị được xoá dữ liệu');
    const msg = clearSampleData();
    return { message: msg, kho: getData_() };
  },

  addUser: function (req) {
    const user = auth_(req);
    if (user.vaiTro !== 'ADMIN') throw new Error('Chỉ quản trị được thêm người dùng');
    return taoNguoiDung(req.ma, req.ten, req.mk, req.vaiTro);
  },

  listUsers: function (req) {
    const user = auth_(req);
    if (user.vaiTro !== 'ADMIN') throw new Error('Không có quyền');
    return rows_('Users').map(function (u) { return { ma: u.ma, ten: u.ten, vaiTro: u.vaiTro, hoatDong: u.hoatDong }; });
  }
};

/* ============================ NGHIỆP VỤ ============================ */

function getData_() {
  const logs = sh_('Logs').getDataRange().getValues();
  const head = logs.shift();
  const recent = logs.slice(-100).reverse().map(function (r) {
    const o = {}; head.forEach(function (k, i) { o[k] = r[i]; });
    o.thoiGian = fmt_(o.thoiGian);
    return o;
  });
  return {
    kho: KHO,
    shelves: rows_('Shelves'),
    items: rows_('Items'),
    stock: rows_('Stock').filter(function (s) { return Number(s.soLuong) > 0; })
      .map(function (s) { return { ke: s.ke, tang: Number(s.tang), o: Number(s.o), maVT: String(s.maVT), soLuong: Number(s.soLuong) }; }),
    logs: recent,
    serverTime: fmt_(new Date())
  };
}

function applyOps_(ops, user) {
  const stockSh = sh_('Stock');
  const stock = stockSh.getDataRange().getValues(); // gồm dòng tiêu đề
  const logSh = sh_('Logs');
  const lastLog = logSh.getLastRow();
  const doneIds = {};
  if (lastLog > 1) {
    const from = Math.max(2, lastLog - 1500);
    logSh.getRange(from, 10, lastLog - from + 1, 1).getValues().forEach(function (r) { if (r[0]) doneIds[r[0]] = true; });
  }
  const itemCodes = {};
  rows_('Items').forEach(function (i) { itemCodes[code_(i.ma)] = true; });

  const results = [];
  const newLogs = [];
  const touched = {};
  const now = new Date();

  ops.forEach(function (op) {
    try {
      if (!op || !op.id) throw new Error('Thiếu mã thao tác');
      if (doneIds[op.id]) { results.push({ id: op.id, ok: true, dup: true }); return; }
      const ke = code_(op.ke), tang = Number(op.tang), o = Number(op.o), ma = code_(op.maVT);
      const sl = Math.round(Number(op.soLuong) || 0);
      validPos_(ke, tang, o);
      if (!ma) throw new Error('Thiếu mã mũ');

      let idx = -1;
      for (let i = 1; i < stock.length; i++) {
        if (code_(stock[i][0]) === ke && Number(stock[i][1]) === tang && Number(stock[i][2]) === o && code_(stock[i][3]) === ma) { idx = i; break; }
      }
      const cur = idx > 0 ? Number(stock[idx][4]) || 0 : 0;
      let next = cur, delta = 0, note = op.ghiChu || '';

      if (op.loai === 'NHAP') {
        if (sl <= 0) throw new Error('Số lượng phải > 0');
        next = cur + sl; delta = sl;
        if (!itemCodes[ma]) { upsertItem_({ ma: ma, ten: op.tenVT || ma, dvt: 'đôi' }, false); itemCodes[ma] = true; }
      } else if (op.loai === 'XUAT') {
        if (sl <= 0) throw new Error('Số lượng phải > 0');
        if (sl > cur) throw new Error('Ô ' + ke + '-T' + tang + '-O' + o + ' chỉ còn ' + cur + ' ' + ma);
        next = cur - sl; delta = -sl;
      } else if (op.loai === 'KIEMKE') {
        if (sl < 0) throw new Error('Số đếm không hợp lệ');
        next = sl; delta = sl - cur;
        note = 'Hệ thống: ' + cur + ' → Thực tế: ' + sl + (note ? ' · ' + note : '');
      } else {
        throw new Error('Loại thao tác không hợp lệ');
      }

      if (idx > 0) { stock[idx][4] = next; stock[idx][5] = now; touched[idx] = true; }
      else { stock.push([ke, tang, o, ma, next, now]); touched[stock.length - 1] = true; }

      newLogs.push([now, op.loai, ke, tang, o, ma, delta, user.ma, note, op.id]);
      doneIds[op.id] = true;
      results.push({ id: op.id, ok: true, soLuong: next });
    } catch (err) {
      results.push({ id: op && op.id, ok: false, error: String(err.message || err) });
    }
  });

  if (Object.keys(touched).length) {
    const body = stock.slice(1);
    if (body.length) stockSh.getRange(2, 1, body.length, SHEETS.Stock.length).setValues(body);
  }
  if (newLogs.length) logSh.getRange(lastLog + 1, 1, newLogs.length, SHEETS.Logs.length).setValues(newLogs);

  return { results: results, kho: getData_() };
}

function upsertItem_(it, overwrite) {
  const s = sh_('Items');
  const data = s.getDataRange().getValues();
  const row = SHEETS.Items.map(function (k) { return it[k] === undefined ? '' : it[k]; });
  for (let i = 1; i < data.length; i++) {
    if (code_(data[i][0]) === it.ma) {
      if (overwrite) s.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  s.appendRow(row);
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

function sh_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    s.setFrozenRows(1);
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
