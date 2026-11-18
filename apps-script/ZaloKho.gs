/**
 * ZALO BOT cho KHO MŨ TBS
 * Script Properties cần có: ZALO_BOT_TOKEN, ZALO_GROUP_CHAT_ID
 */
const ZALO = { API: 'https://bot-api.zaloplatforms.com/bot', MAX_LEN: 1800 };
var ZALO_QUEUE_ = [];   // sự kiện chờ gửi trong 1 lần chạy

/* ---------- Cấu hình (chạy từ menu) ---------- */
function zaloCaiToken() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Zalo Bot', 'Dán ZALO_BOT_TOKEN:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  PropertiesService.getScriptProperties().setProperty('ZALO_BOT_TOKEN', r.getResponseText().trim());
  ui.alert('Đã lưu token. Hãy nhắn 1 tin vào nhóm/bot rồi chạy "Lấy Chat ID".');
}

function zaloLayChatId() {
  const token = zaloProp_('ZALO_BOT_TOKEN');
  if (!token) throw new Error('Chưa có ZALO_BOT_TOKEN');
  const res = UrlFetchApp.fetch(ZALO.API + token + '/getUpdates', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ timeout: '5' }), muteHttpExceptions: true
  });
  const j = JSON.parse(res.getContentText() || '{}');
  const list = Array.isArray(j.result) ? j.result : (j.result ? [j.result] : []);
  const ids = list.map(function (u) {
    const c = u.message && u.message.chat;
    return c ? (c.id + ' (' + (c.chat_type || c.type || '') + ')') : '';
  }).filter(Boolean);
  if (!ids.length) { SpreadsheetApp.getUi().alert('Chưa có tin nhắn mới. Nhắn vào nhóm rồi chạy lại.\n' + res.getContentText().slice(0, 300)); return; }
  const first = ids[0].split(' ')[0];
  PropertiesService.getScriptProperties().setProperty('ZALO_GROUP_CHAT_ID', first);
  SpreadsheetApp.getUi().alert('Đã lưu ZALO_GROUP_CHAT_ID = ' + first + (ids.length > 1 ? '\nCác ID khác: ' + ids.slice(1).join(', ') : ''));
}

function zaloKiemTra() {
  const r = zaloSend_('✅ Kho Mũ TBS: kết nối Zalo bot thành công.\n' + fmtFull_(new Date()));
  SpreadsheetApp.getUi().alert(r.ok ? 'Đã gửi tin thử vào Zalo.' : 'Lỗi: ' + r.error);
}

/* ---------- Gửi ---------- */
function zaloProp_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

function zaloSend_(text) {
  const token = zaloProp_('ZALO_BOT_TOKEN'), chat = zaloProp_('ZALO_GROUP_CHAT_ID');
  if (!token || !chat) return { ok: false, error: 'Chưa cấu hình ZALO_BOT_TOKEN / ZALO_GROUP_CHAT_ID' };
  try {
    const res = UrlFetchApp.fetch(ZALO.API + token + '/sendMessage', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chat, text: text }), muteHttpExceptions: true
    });
    const j = JSON.parse(res.getContentText() || '{}');
    return j.ok === false ? { ok: false, error: j.description || res.getContentText().slice(0, 200) } : { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function fmtFull_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
}
function n_(v) { return Number(v || 0).toLocaleString('vi-VN'); }

/* ---------- Tách chuyền / PX / thiếu từ ghi chú ---------- */
function parseGhiChuZalo_(note) {
  const s = String(note || '');
  const ch = s.match(/Chuy[eêề]n\s*(\d+)/i);
  const px = s.match(/PX\s*([A-Z]\d)/i);
  const th = s.match(/thi[eếê]u\s*(\d+)/i);
  return {
    chuyen: ch ? ch[1] : '',
    px: px ? px[1].toUpperCase() : '',
    thieu: th ? Number(th[1]) : 0,
    coThieu: /thi[eếê]u|còn nợ|con no|chờ bù|cho bu/i.test(s)
  };
}

/* ---------- Hàng đợi sự kiện (gọi từ applyOps_) ---------- */
function zaloQueue_(ev) {
  const note = String(ev.note || '');
  if (/Cân đối|Chuyển vị trí/i.test(note)) return;                 // cân tồn theo file: không báo
  if (ev.loai === 'KIEMKE' && Number(ev.delta) === 0) return;
  if (ev.loai === 'NHAP' && /Sắp kệ từ/i.test(note)) return;      // sắp kệ chỉ báo 1 tin (bên XUAT)
  ZALO_QUEUE_.push(ev);
}

function zaloFlush_() {
  if (!ZALO_QUEUE_.length) return;
  const events = ZALO_QUEUE_; ZALO_QUEUE_ = [];
  if (!zaloProp_('ZALO_BOT_TOKEN') || !zaloProp_('ZALO_GROUP_CHAT_ID')) return;
  try {
    const items = {}; rows_('Items').forEach(function (i) { items[code_(i.ma)] = i; });
    const users = {}; rows_('Users').forEach(function (u) { users[String(u.ma).toLowerCase()] = u.ten; });
    const msgs = events.map(function (ev) { return zaloBuildMsg_(ev, items[ev.ma] || {}, users); });
    // gộp nhiều tin vào ít tin nhất (mỗi tin ≤ ~1800 ký tự)
    let buf = '';
    msgs.forEach(function (m) {
      if (buf && (buf.length + m.length + 30) > ZALO.MAX_LEN) { zaloSend_(buf); buf = ''; }
      buf += (buf ? '\n──────────\n' : '') + m;
    });
    if (buf) zaloSend_(buf);
  } catch (e) { /* không để lỗi Zalo ảnh hưởng nghiệp vụ kho */ }
}

function zaloBuildMsg_(ev, it, users) {
  const maU = String(ev.userMa || 'kho').toLowerCase();
  const nguoi = (users[maU] ? users[maU] + ' (' + maU + ')' : maU);
  const info = parseGhiChuZalo_(ev.note);
  const vitri = ev.ke + '-T' + ev.tang + '-O' + ev.o;
  const mu = ev.ma + (it.ten && it.ten !== ev.ma ? ' — ' + it.ten : '');
  const spec = [it.model, it.mau, it.size && ('Size ' + it.size)].filter(Boolean).join(' · ');
  const L = [];

  if (ev.loai === 'NHAP') L.push('📥 NHẬP KHO MŨ', '👤 Người nhập: ' + nguoi);
  else if (ev.loai === 'XUAT' && /Sắp kệ từ/i.test(ev.note || '')) L.push('🔄 SẮP KỆ MŨ', '👤 Người thực hiện: ' + nguoi);
  else if (ev.loai === 'XUAT') L.push('📤 XUẤT KHO MŨ', '👤 Người xuất: ' + nguoi);
  else if (ev.loai === 'XUAT_THIEU') L.push('❌ XUẤT KHÔNG ĐỦ HÀNG', '👤 Người xuất: ' + nguoi);
  else L.push('📝 KIỂM KÊ Ô', '👤 Người kiểm: ' + nguoi);

  L.push('🕒 ' + fmtFull_(ev.time || new Date()));
  L.push('🧢 Mã mũ: ' + mu);
  if (spec) L.push('🎯 ' + spec);
  L.push('📍 Vị trí: ' + vitri);

  if (ev.loai === 'NHAP') L.push('🔢 Số lượng nhập: +' + n_(ev.sl) + ' đôi');
  else if (ev.loai === 'XUAT') L.push('🔢 Số lượng xuất: −' + n_(ev.sl) + ' đôi');
  else if (ev.loai === 'XUAT_THIEU') L.push('🔢 Yêu cầu xuất: ' + n_(ev.sl) + ' đôi', '⚠️ Ô chỉ còn: ' + n_(ev.cur) + ' đôi → THIẾU ' + n_(ev.sl - ev.cur) + ' đôi');
  else L.push('🔢 Hệ thống ' + n_(ev.cur) + ' → Thực tế ' + n_(ev.next) + ' (lệch ' + (ev.delta > 0 ? '+' : '') + n_(ev.delta) + ')');

  if (ev.loai !== 'XUAT_THIEU') L.push('📦 Tồn ô sau thao tác: ' + n_(ev.next) + ' đôi · Tổng tồn mã: ' + n_(ev.tongMa) + ' đôi');

  if (info.chuyen || info.px) L.push('🧵 Chuyền may: ' + (info.chuyen ? 'Chuyền ' + info.chuyen : '—') + (info.px ? ' · PX ' + info.px : ''));
  if (info.coThieu || ev.loai === 'XUAT_THIEU') {
    L.push('⚠️ THIẾU HÀNG' + (info.chuyen ? ' — Chuyền ' + info.chuyen : '') + (info.px ? ' (PX ' + info.px + ')' : '') +
      (info.thieu ? ': còn thiếu ' + n_(info.thieu) + ' đôi' : ': cần bù thêm'));
  }
  if (ev.note) L.push('💬 Ghi chú: ' + ev.note);
  return L.join('\n');
}

/* ---------- Báo cáo thiếu theo chuyền (24h gần nhất) ---------- */
function baoCaoThieuZalo() {
  const v = sh_('Logs').getDataRange().getValues();
  const since = Date.now() - 24 * 3600 * 1000;
  const byLine = {};
  for (let i = v.length - 1; i >= 1 && i > v.length - 1500; i--) {
    const r = v[i], t = r[0] instanceof Date ? r[0].getTime() : 0;
    if (t && t < since) break;
    const info = parseGhiChuZalo_(r[8]);
    if (!info.coThieu) continue;
    const key = (info.chuyen ? 'Chuyền ' + info.chuyen : 'Chưa rõ chuyền') + (info.px ? ' · PX ' + info.px : '');
    (byLine[key] = byLine[key] || []).push(code_(r[5]) + ' (' + r[2] + '-T' + r[3] + '-O' + r[4] + ')' + (info.thieu ? ' thiếu ' + n_(info.thieu) : ''));
  }
  const keys = Object.keys(byLine).sort();
  if (!keys.length) { zaloSend_('✅ Kho Mũ TBS — 24h qua không có chuyền nào bị thiếu mũ.'); return; }
  let txt = '⚠️ BÁO CÁO CHUYỀN THIẾU MŨ (24h qua)\n' + fmtFull_(new Date());
  keys.forEach(function (k) { txt += '\n\n🧵 ' + k + ':\n• ' + byLine[k].join('\n• '); });
  zaloSend_(txt.slice(0, ZALO.MAX_LEN));
}

function zaloBatTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'baoCaoThieuZalo') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('baoCaoThieuZalo').timeBased().everyDays(1).atHour(17).create();
  return 'Đã bật báo cáo thiếu mũ theo chuyền mỗi ngày lúc 17:00.';
}