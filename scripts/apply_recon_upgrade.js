const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(targetPath, 'utf8');

// Find start of reconcileRun and end of applyReconRow / handleReconUpload
const startMarker = "function reconcileRun(){";
const endMarker = "if ($('#kkReconMixedFile')) $('#kkReconMixedFile').onchange = function(){ handleReconUpload(this, 'mixed'); };";

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers in docs/index.html');
  process.exit(1);
}

const newReconLogic = `
function showReconProgress(show, title, cur, total, step){
  const modal = $('#reconProgressModal');
  if (!modal) return;
  modal.hidden = !show;
  if (!show) return;
  if (title && $('#rpmTitle')) $('#rpmTitle').textContent = title;
  const pct = total > 0 ? Math.min(100, Math.round((cur / total) * 100)) : 0;
  if ($('#rpmBar')) $('#rpmBar').style.width = pct + '%';
  if ($('#rpmStep')) $('#rpmStep').textContent = step || ('Tiến độ: ' + cur + ' / ' + total + ' thao tác (' + pct + '%)');
  if ($('#rpmText')) $('#rpmText').textContent = 'Đang gửi dữ liệu lên Google Sheet và cân đối tồn kho... (' + pct + '%)';
}

function reconcileRun(){
  const allLines = kkReconMixed.concat(kkReconIn, kkReconOut);
  if (!allLines.length) {
    toast('Hãy chọn file đối chiếu hoặc bấm "Nạp dữ liệu file mẫu" trước', 'err');
    return;
  }
  const fromDate = ($('#kkReconFrom') && $('#kkReconFrom').value) || '';
  const toDate = ($('#kkReconTo') && $('#kkReconTo').value) || '';
  const keyMode = ($('#kkReconKeyMode') && $('#kkReconKeyMode').value) || 'PO';

  const byMa = {};
  const maGiayToGroups = {};
  const ensureGroup = (key, maGiay, tenDefault) => {
    if (!byMa[key]) {
      const it = itemOf(key) || itemOf(maGiay) || {};
      byMa[key] = {
        ma: key,
        maGiay: maGiay || key,
        ten: it.ten || tenDefault || maGiay || key,
        po:'', so:'', model: it.model || '', mau: it.mau || '', size: it.size || '',
        fileKe:'', rawKe:'', keOutOfRange:false, fileTang:0, fileO:0, rawBin:'', multiBin:false, multiBins:[],
        extPlan:0, hasExtPlan:false, extIn:0, extOut:0, extStock:0, hasExtStock:false,
        appIn:0, appOut:0, appStock:0, appLocs:[]
      };
      if (maGiay) {
        if (!maGiayToGroups[maGiay]) maGiayToGroups[maGiay] = [];
        maGiayToGroups[maGiay].push(byMa[key]);
      }
    }
    return byMa[key];
  };

  allLines.forEach(l => {
    const mg = l.maGiay || l.maVT;
    const key = (keyMode === 'PO' && l.po) ? l.po : mg;
    const g = ensureGroup(key, mg, (keyMode === 'PO' && l.po) ? mg : (l.ten || mg));
    if (l.ten && l.ten !== l.maVT && keyMode !== 'PO') g.ten = l.ten;
    else if (keyMode === 'PO') g.ten = mg;
    if (l.po) g.po = g.po && g.po !== l.po ? (g.po.split(', ').length < 3 ? g.po + ', ' + l.po : g.po) : l.po;
    if (l.so) g.so = l.so;
    if (l.model) g.model = l.model;
    if (l.mau) g.mau = l.mau;
    if (l.size) g.size = l.size;
    if (l.rawKe) { g.rawKe = l.rawKe; g.keOutOfRange = g.keOutOfRange || !!l.keOutOfRange; }
    if (l.ke) { g.fileKe = l.ke; g.fileTang = l.tang || g.fileTang; g.fileO = l.o || g.fileO; }
    if (l.rawBin) { g.rawBin = l.rawBin; g.multiBin = g.multiBin || !!l.multiBin; g.multiBins = l.multiBins || g.multiBins; }
    if (l.hasSlkh) { g.extPlan += l.slkh; g.hasExtPlan = true; }
    g.extIn += l.inQty || 0;
    g.extOut += l.outQty || 0;
    if (l.hasTon) { g.extStock += l.tonFile; g.hasExtStock = true; }
  });

  // Cộng tồn thực tế trên App cho các mã có trong file đối chiếu (hỗ trợ khớp theo PO hoặc theo Mã giày)
  stockRows().forEach(r => {
    const gDirect = byMa[r.maVT];
    const gFallback = !gDirect && keyMode === 'PO' && maGiayToGroups[r.maVT] && maGiayToGroups[r.maVT].length === 1 ? maGiayToGroups[r.maVT][0] : null;
    const g = gDirect || gFallback;
    if (!g) return;
    g.appStock += r.soLuong;
    g.appLocs.push({ ke:r.ke, tang:r.tang, o:r.o, soLuong:r.soLuong });
  });

  // Cộng giao dịch Nhập / Xuất trên App (lọc theo Từ ngày - Đến ngày nếu có)
  getAllLogs().forEach(lg => {
    if (!lg.maVT) return;
    const gDirect = byMa[lg.maVT];
    const gFallback = !gDirect && keyMode === 'PO' && maGiayToGroups[lg.maVT] && maGiayToGroups[lg.maVT].length === 1 ? maGiayToGroups[lg.maVT][0] : null;
    const g = gDirect || gFallback;
    if (!g) return;
    if (fromDate || toDate) {
      const d = parseLogIsoDate(lg.thoiGian);
      if (d && ((fromDate && d < fromDate) || (toDate && d > toDate))) return;
    }
    const sl = Number(lg.soLuong) || 0;
    if (lg.loai === 'NHAP') g.appIn += Math.abs(sl);
    else if (lg.loai === 'XUAT') g.appOut += Math.abs(sl);
  });

  const rows = Object.values(byMa).map(g => {
    g.appLocs.sort((a, b) => b.soLuong - a.soLuong);
    const topApp = g.appLocs[0] || { ke:'', tang:0, o:0 };
    const appKe = Array.from(new Set(g.appLocs.map(x => x.ke))).join(', ');
    const appTang = topApp.tang || 0;
    const appO = topApp.o || 0;

    const targetStock = g.hasExtStock ? g.extStock : Math.max(0, g.extIn - g.extOut);
    const inDiff = g.appIn - g.extIn;
    const outDiff = g.appOut - g.extOut;
    const stockDiff = g.appStock - targetStock;

    const isPlanOnly = g.hasExtPlan && targetStock === 0 && g.appStock === 0 && g.extIn === 0;
    const isDoneOrder = (g.extIn > 0 && g.extOut >= g.extIn && targetStock === 0 && g.appStock === 0);
    const isNoShelf = (targetStock > 0 || g.appStock > 0) && !g.fileKe && !appKe;
    const isLocDiff = !!(g.keOutOfRange || (g.fileKe && appKe && !g.appLocs.some(l => l.ke === g.fileKe && (!g.fileTang || l.tang === g.fileTang) && (!g.fileO || l.o === g.fileO))));
    const isQtyDiff = g.hasExtStock ? (stockDiff !== 0) : ((g.extIn > 0 && inDiff !== 0) || (g.extOut > 0 && outDiff !== 0));
    
    // Đồng bộ chuẩn lên Sheet
    const isStockMatched = targetStock === g.appStock;
    const isFullySyncedOnSheet = (isStockMatched && !isLocDiff && (!isNoShelf || g.appStock > 0)) || (isDoneOrder && !isQtyDiff);
    const ok = isFullySyncedOnSheet;

    let status = 'Khớp hoàn toàn';
    if (g.keOutOfRange) status = 'Kệ ' + g.rawKe + ' vượt K' + SO_KE;
    else if (isPlanOnly) status = 'Chỉ có SLKH (chưa nhập)';
    else if (isDoneOrder) status = 'Đã xuất hết (tồn 0)';
    else if (isNoShelf && g.appStock === targetStock && targetStock > 0) status = '✔ Đã lưu Sheet · ⚠️ Chờ xếp kệ';
    else if (isNoShelf) status = '⚠️ Tồn chưa xếp kệ';
    else if (stockDiff !== 0 && isLocDiff) status = 'Lệch tồn & vị trí';
    else if (stockDiff !== 0) status = (stockDiff > 0 ? 'Thừa tồn +' : 'Thiếu tồn ') + fmt(stockDiff);
    else if (isLocDiff) status = 'Lệch Kệ / Tầng / Ô';
    else if (isQtyDiff) status = 'Lệch Nhập / Xuất';

    return Object.assign(g, {
      appKe, appTang, appO, targetStock,
      inDiff, outDiff, stockDiff,
      isPlanOnly, isDoneOrder, isNoShelf, isLocDiff, isQtyDiff, isFullySyncedOnSheet, ok, status
    });
  }).sort((a, b) => {
    const score = x => (x.keOutOfRange ? 6 : 0) + (x.isNoShelf && !x.isFullySyncedOnSheet ? 5 : 0) + (x.targetStock > 0 && !x.ok ? 4 : 0) + (x.targetStock > 0 ? 3 : 0) + (!x.ok ? 1 : 0);
    const d = score(b) - score(a);
    return d !== 0 ? d : a.ma.localeCompare(b.ma);
  });

  kkReconResult = { rows };
  renderReconResult();
}

function diffCellHtml(d){
  if (!d) return '<span class="d-zero">0</span>';
  return '<span class="' + (d > 0 ? 'd-pos' : 'd-neg') + '">' + (d > 0 ? '+' : '') + fmt(d) + '</span>';
}

function renderReconResult(){
  if (!kkReconResult) return;
  const rows = kkReconResult.rows;
  const noShelfN = rows.filter(x => x.isNoShelf).length;
  const planOnlyN = rows.filter(x => x.isPlanOnly).length;
  const locDiffN = rows.filter(x => x.isLocDiff).length;
  const diffN = rows.filter(x => x.isQtyDiff).length;
  const okN = rows.filter(x => x.ok).length;

  // Lọc chỉ những dòng có phát sinh tồn kho thực tế
  const stockRowsList = rows.filter(x => x.targetStock > 0);
  const totalStockRows = stockRowsList.length;
  const syncedStockRows = stockRowsList.filter(x => x.appStock === x.targetStock && !x.isLocDiff).length;

  $('#cntFilterAll').textContent = fmt(rows.length);
  $('#cntFilterNoShelf').textContent = fmt(noShelfN);
  $('#cntFilterPlanOnly').textContent = fmt(planOnlyN);
  $('#cntFilterLocDiff').textContent = fmt(locDiffN);
  $('#cntFilterDiff').textContent = fmt(diffN);
  $('#cntFilterOk').textContent = fmt(okN);

  $('#kkReconFilterTabs').hidden = false;
  $('#kkReconTableWrap').hidden = false;
  $('#kkReconExport').disabled = !rows.length;
  $('#kkReconClear').hidden = false;

  const sum = rows.reduce((a, r) => {
    a.plan += r.extPlan; a.fIn += r.extIn; a.aIn += r.appIn;
    a.fOut += r.extOut; a.aOut += r.appOut; a.fStk += r.targetStock; a.aStk += r.appStock;
    return a;
  }, { plan:0, fIn:0, aIn:0, fOut:0, aOut:0, fStk:0, aStk:0 });

  const stockSyncPct = sum.fStk > 0 ? Math.min(100, Math.round((sum.aStk / sum.fStk) * 100)) : 100;
  const stockRowPct = totalStockRows > 0 ? Math.min(100, Math.round((syncedStockRows / totalStockRows) * 100)) : 100;

  // Nút Lưu chênh lệch & Đồng bộ lên Sheet
  const adjustBtn = $('#kkReconSaveAdjust');
  if (adjustBtn) {
    adjustBtn.hidden = false;
    const needSyncRows = Math.max(0, totalStockRows - syncedStockRows);
    if (needSyncRows > 0) {
      adjustBtn.innerHTML = '💾 Lưu chênh lệch &amp; Đồng bộ ' + fmt(needSyncRows) + ' mã tồn lên Sheet';
      adjustBtn.className = 'btn btn-pri btn-sm';
    } else {
      adjustBtn.innerHTML = '✔ Đã đồng bộ 100% (' + fmt(totalStockRows) + ' mã tồn trên Sheet)';
      adjustBtn.className = 'btn btn-ghost btn-sm';
    }
  }

  const isFull100 = (syncedStockRows === totalStockRows && totalStockRows > 0);
  const statusBadge = isFull100
    ? '<span class="tag tag-ok" style="font-size:13px;font-weight:800;padding:6px 12px">✔ ĐÃ LƯU &amp; ĐỒNG BỘ 100% LÊN GOOGLE SHEET</span>'
    : '<span class="tag tag-XUAT" style="font-size:13px;font-weight:700;padding:6px 12px">⏳ Tiến độ lưu Sheet: ' + fmt(syncedStockRows) + ' / ' + fmt(totalStockRows) + ' mã tồn (' + stockRowPct + '%)</span>';

  $('#kkReconSummary').innerHTML =
    '<div style="margin-bottom:12px;padding:14px 16px;border-radius:14px;background:#f8fafc;border:1.5px solid var(--line)">' +
      '<div class="row wrap" style="justify-content:space-between;margin-bottom:8px;gap:8px">' +
        '<div>' +
          '<b style="font-size:14px;color:var(--ink)">TIẾN ĐỘ ĐỒNG BỘ TỒN MŨ THEO FILE LÊN GOOGLE SHEET</b>' +
          '<div class="small muted" style="margin-top:2px">Hệ thống đối chiếu 4 cột: Kế hoạch (SLKH), Nhập, Xuất, Tồn mũ. Tách riêng 2,033 đơn hàng chỉ có kế hoạch ở bảng bên dưới.</div>' +
        '</div>' +
        '<div>' + statusBadge + '</div>' +
      '</div>' +
      '<div class="bar-track" style="height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden">' +
        '<div class="bar-fill" style="width:' + Math.max(3, stockRowPct) + '%;background:' + (isFull100 ? 'var(--emerald-600)' : 'linear-gradient(90deg,#0d9488,#0284c7)') + ';height:100%;transition:width .3s"></div>' +
      '</div>' +
      '<div class="row wrap small" style="justify-content:space-between;margin-top:8px;color:var(--muted)">' +
        '<span>• Tiến độ Tồn mũ trên Sheet / File: <b style="color:var(--brand)">' + fmt(sum.aStk) + ' / ' + fmt(sum.fStk) + ' đôi (' + stockSyncPct + '%)</b></span>' +
        '<span>• Tiến độ Mã tồn đã lưu Sheet: <b>' + fmt(syncedStockRows) + ' / ' + fmt(totalStockRows) + ' mã (' + stockRowPct + '%)</b></span>' +
        (sum.plan > 0 ? ('<span>• Tổng SLKH từ file: <b>' + fmt(sum.plan) + ' đôi</b></span>') : '') +
      '</div>' +
    '</div>' +
    '<div class="recon-kpis">' +
      '<div class="rk-card"><div class="rk-lbl">1. SLKH (File)</div><div class="rk-val">' + fmt(sum.plan) + '</div></div>' +
      '<div class="rk-card"><div class="rk-lbl">2. Nhập (File / App)</div><div class="rk-val">' + fmt(sum.fIn) + ' / ' + fmt(sum.aIn) + '</div></div>' +
      '<div class="rk-card"><div class="rk-lbl">3. Xuất (File / App)</div><div class="rk-val">' + fmt(sum.fOut) + ' / ' + fmt(sum.aOut) + '</div></div>' +
      '<div class="rk-card"><div class="rk-lbl">4. Tồn mũ (File / App)</div><div class="rk-val">' + fmt(sum.fStk) + ' / ' + fmt(sum.aStk) + ' (' + stockSyncPct + '%)</div></div>' +
      '<div class="rk-card"><div class="rk-lbl">5. Tồn chưa xếp kệ</div><div class="rk-val" style="color:var(--rose-700)">' + fmt(noShelfN) + ' dòng</div></div>' +
      '<div class="rk-card"><div class="rk-lbl">6. Chưa tồn (Chỉ SLKH)</div><div class="rk-val" style="color:var(--sky-700)">' + fmt(planOnlyN) + ' dòng</div></div>' +
    '</div>';

  const filtered = rows.filter(x => {
    if (kkReconFilter === 'noShelf') return x.isNoShelf;
    if (kkReconFilter === 'planOnly') return x.isPlanOnly;
    if (kkReconFilter === 'locDiff') return x.isLocDiff;
    if (kkReconFilter === 'diff') return x.isQtyDiff;
    if (kkReconFilter === 'ok') return x.ok;
    // Mặc định tab "Tất cả": Ưu tiên hiển thị các mã có phát sinh tồn kho thực tế hoặc có nhập xuất để bảng không bị ngập 2,033 mã kế hoạch
    return x.targetStock > 0 || x.appStock > 0 || x.isLocDiff || (x.extIn > 0 && x.extOut > 0);
  });

  const displayRows = filtered.slice(0, 350);
  const moreNote = filtered.length > displayRows.length
    ? '<tr><td colspan="19" class="muted" style="text-align:center;padding:12px;background:#f8fafc">Đang hiển thị <b>' + fmt(displayRows.length) + ' / ' + fmt(filtered.length) + '</b> dòng ưu tiên (các dòng có kệ &amp; có tồn mũ hiển thị lên đầu). Bấm <b>"Tải báo cáo Excel (.csv)"</b> để xuất toàn bộ ' + fmt(rows.length) + ' dòng.</td></tr>'
    : '';

  $('#kkReconBody').innerHTML = (displayRows.map(x => {
    const idx = rows.indexOf(x);
    const meta = [x.model, x.mau, x.size && 'Sz ' + x.size].filter(Boolean).join(' · ') || '—';
    const keHtml = x.keOutOfRange
      ? '<span class="tag tag-err mono" title="Kho Mũ chỉ có ' + SO_KE + ' kệ (K01-K' + (SO_KE < 10 ? '0' : '') + SO_KE + ')">' + esc(x.rawKe) + ' (>K' + SO_KE + ')</span>'
      : (x.fileKe && x.appKe
        ? (x.isLocDiff ? '<span class="d-neg">F:' + esc(x.fileKe) + '</span> / <span style="color:var(--sky-700);font-weight:700">A:' + esc(x.appKe) + '</span>' : '<span class="tag tag-NHAP mono">' + esc(x.fileKe) + '</span>')
        : (x.fileKe ? '<span class="tag tag-KIEMKE mono">F:' + esc(x.fileKe) + '</span>' : (x.appKe ? '<span class="tag tag-NHAP mono">A:' + esc(x.appKe) + '</span>' : '<span class="d-neg">Chưa kệ</span>')));
    const tHtml = (x.fileTang || x.appTang) ? ('T' + (x.fileTang || x.appTang)) : '—';
    const oHtml = x.multiBin
      ? ('Ô ' + (x.fileO || x.appO || 1) + ' <span class="xs muted" title="File ghi nhiều ô: ' + esc(x.rawBin) + '">(' + esc(x.rawBin) + ')</span>')
      : ((x.fileO || x.appO) ? ('Ô ' + (x.fileO || x.appO)) : '—');
    const stCls = x.ok ? 'tag-ok' : (x.keOutOfRange || x.isNoShelf || x.stockDiff !== 0 ? 'tag-err' : 'tag-XUAT');

    return '<tr>' +
      '<td><b class="mono">' + esc(x.ma) + '</b><div class="xs muted">' + esc(x.ten) + '</div></td>' +
      '<td class="mono">' + esc(x.po || '—') + '</td>' +
      '<td class="mono">' + esc(x.so || '—') + '</td>' +
      '<td>' + esc(meta) + '</td>' +
      '<td class="num-tab" style="text-align:right;font-weight:700">' + (x.hasExtPlan ? fmt(x.extPlan) : '—') + '</td>' +
      '<td>' + keHtml + '</td>' +
      '<td class="mono" style="text-align:center">' + tHtml + '</td>' +
      '<td class="mono" style="text-align:center">' + oHtml + '</td>' +
      '<td class="num-tab" style="text-align:right">' + fmt(x.extIn) + '</td>' +
      '<td class="num-tab" style="text-align:right">' + fmt(x.appIn) + '</td>' +
      '<td class="num-tab" style="text-align:center">' + diffCellHtml(x.inDiff) + '</td>' +
      '<td class="num-tab" style="text-align:right">' + fmt(x.extOut) + '</td>' +
      '<td class="num-tab" style="text-align:right">' + fmt(x.appOut) + '</td>' +
      '<td class="num-tab" style="text-align:center">' + diffCellHtml(x.outDiff) + '</td>' +
      '<td class="num-tab" style="text-align:right;font-weight:800;color:var(--brand)">' + fmt(x.targetStock) + '</td>' +
      '<td class="num-tab" style="text-align:right;font-weight:800">' + fmt(x.appStock) + '</td>' +
      '<td class="num-tab" style="text-align:center">' + diffCellHtml(x.stockDiff) + '</td>' +
      '<td><span class="tag ' + stCls + '">' + esc(x.status) + '</span></td>' +
      '<td style="text-align:center">' +
        '<div class="row" style="gap:4px;justify-content:center">' +
          (!x.ok && !x.keOutOfRange ? '<button type="button" class="btn btn-pri btn-sm" data-rfix="' + idx + '">Cân tồn</button>' : '') +
          '<button type="button" class="btn btn-ghost btn-sm" data-rass="' + idx + '" title="Gán vị trí kệ">⚡ Xếp kệ</button>' +
          (x.appLocs.length || x.fileKe ? '<button type="button" class="btn btn-ghost btn-sm" data-rloc="' + idx + '">Định vị</button>' : '') +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('') + moreNote) || '<tr><td colspan="19" class="muted" style="text-align:center;padding:18px">Không có dòng nào thuộc bộ lọc này.</td></tr>';

  $('#kkReconBody').querySelectorAll('[data-rfix]').forEach(b => b.onclick = () => applyReconRow(+b.dataset.rfix));
  $('#kkReconBody').querySelectorAll('[data-rass]').forEach(b => b.onclick = () => assignShelfForReconRow(+b.dataset.rass));
  $('#kkReconBody').querySelectorAll('[data-rloc]').forEach(b => b.onclick = () => {
    const r = rows[+b.dataset.rloc];
    const targets = r.appLocs.length ? r.appLocs : (r.fileKe ? [{ ke:r.fileKe, tang:r.fileTang || 1, o:r.fileO || 1 }] : []);
    if (targets.length) go('map', targets);
  });

  renderKkPlanOnlySection();
}

function renderKkPlanOnlySection(){
  const wrap = $('#kkPlanOnlyWrap');
  if (!wrap) return;
  if (!kkReconResult || !Array.isArray(kkReconResult.rows)) {
    wrap.innerHTML = '';
    return;
  }
  const planOnlyRows = kkReconResult.rows.filter(x => x.isPlanOnly);
  if (!planOnlyRows.length) {
    wrap.innerHTML = '';
    return;
  }
  const totalPlanPairs = planOnlyRows.reduce((acc, r) => acc + (r.extPlan || 0), 0);
  wrap.innerHTML =
    '<div class="panel" style="margin-top:20px;border:1.5px solid #7dd3fc;background:#f0f9ff;border-radius:14px;padding:16px">' +
      '<div class="row wrap" style="justify-content:space-between;margin-bottom:12px;gap:12px">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:800;color:#0369a1;display:flex;align-items:center;gap:6px">' +
            '<span>📋</span> DANH SÁCH MÃ CHỈ CÓ KẾ HOẠCH (SLKH) — CHƯA CÓ TỒN MŨ TRONG KHO (' + fmt(planOnlyRows.length) + ' mã · ' + fmt(totalPlanPairs) + ' đôi)' +
          '</div>' +
          '<div class="small" style="color:#0c4a6e;margin-top:4px">' +
            'Dành cho thủ kho: Đây là các đơn hàng <b>mới có Lệnh kế hoạch</b> ghi trên file kiểm soát, <b>hàng thực tế chưa về xưởng (Tồn kho = 0)</b>. ' +
            'Thủ kho <b>KHÔNG cần cho công nhân đi tìm xếp kệ</b> lúc này. Có thể bấm "Quy hoạch kệ trước" để định sẵn vị trí đón hàng.' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<input type="text" id="kkPlanOnlySearch" class="inp" placeholder="Lọc theo PO / SO / Mã giày..." style="max-width:260px;padding:6px 10px;font-size:13px" oninput="filterPlanOnlyTable(this.value)">' +
        '</div>' +
      '</div>' +
      '<div class="tbl-wrap" style="max-height:420px;overflow-y:auto;background:#fff;border-radius:10px;border:1px solid #bae6fd">' +
        '<table class="recon-tbl" id="kkPlanOnlyTable" style="font-size:12px;white-space:nowrap">' +
          '<thead>' +
            '<tr style="background:#e0f2fe;color:#0369a1">' +
              '<th>MÃ GIÀY / TÊN MŨ</th>' +
              '<th>PO / SO</th>' +
              '<th>MODEL / MÀU / SIZE</th>' +
              '<th style="text-align:right">SL KẾ HOẠCH (SLKH)</th>' +
              '<th style="text-align:center">TỒN MŨ THỰC TẾ</th>' +
              '<th>TRẠNG THÁI</th>' +
              '<th>GHI CHÚ CHO THỦ KHO</th>' +
              '<th style="text-align:center">THAO TÁC</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            planOnlyRows.map((r, pIdx) => {
              const origIdx = kkReconResult.rows.indexOf(r);
              const meta = [r.model, r.mau, r.size && 'Sz ' + r.size].filter(Boolean).join(' · ') || '—';
              return '<tr data-search="' + esc((r.ma + ' ' + (r.ten||'') + ' ' + (r.po||'') + ' ' + (r.so||'')).toUpperCase()) + '">' +
                '<td><b>' + esc(r.ma) + '</b><div class="xs muted">' + esc(r.ten || r.ma) + '</div></td>' +
                '<td>' + (r.po ? ('<b style="color:#0284c7">PO: ' + esc(r.po) + '</b>') : '—') + (r.so ? ('<div class="xs muted">SO: ' + esc(r.so) + '</div>') : '') + '</td>' +
                '<td>' + esc(meta) + '</td>' +
                '<td style="text-align:right;font-weight:700;color:#0369a1">' + fmt(r.extPlan) + ' đôi</td>' +
                '<td style="text-align:center"><span class="tag" style="background:#f1f5f9;color:#64748b;font-weight:700">0 đôi</span></td>' +
                '<td><span class="tag tag-XUAT" style="font-size:11px;font-weight:700">⏳ Chưa có tồn mũ (Chỉ có SLKH)</span></td>' +
                '<td><div class="small" style="color:#0284c7">💡 Hàng chưa về xưởng — chờ kế hoạch sản xuất giao sang</div></td>' +
                '<td style="text-align:center">' +
                  '<button type="button" class="btn btn-ghost btn-sm" onclick="assignShelfForReconRow(' + origIdx + ')" style="padding:3px 8px;font-size:11px">⚡ Quy hoạch kệ trước</button>' +
                '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
}

function filterPlanOnlyTable(query){
  query = String(query || '').trim().toUpperCase();
  const rows = $$('#kkPlanOnlyTable tbody tr');
  rows.forEach(tr => {
    const txt = tr.dataset.search || tr.textContent.toUpperCase();
    tr.hidden = !!(query && !txt.includes(query));
  });
}

function assignShelfForReconRow(idx){
  if (!kkReconResult || !kkReconResult.rows[idx]) return;
  const r = kkReconResult.rows[idx];
  const curLoc = (r.fileKe ? r.fileKe + '-T' + (r.fileTang || 1) + '-O' + (r.fileO || 1) : (r.appKe ? r.appKe + '-T' + (r.appTang || 1) + '-O' + (r.appO || 1) : 'K01-T1-O1'));
  const promptVal = prompt('Gán vị trí Kệ - Tầng - Ô cho mã: ' + r.ma + '\\n(VD: K02-T1-O2 hoặc K14-T2-O3):', curLoc);
  if (!promptVal) return;
  const match = promptVal.trim().toUpperCase().match(/K?\\s*(\\d{1,2})[\\s\\-_/T]*(\\d)?[\\s\\-_/O]*(\\d)?/i);
  if (!match) {
    toast('Định dạng không hợp lệ! Hãy nhập dạng K01-T1-O2', 'err');
    return;
  }
  const keNum = parseInt(match[1], 10);
  if (keNum < 1 || keNum > SO_KE) {
    toast('Kệ phải từ K01 đến K' + (SO_KE < 10 ? '0' : '') + SO_KE, 'err');
    return;
  }
  const ke = 'K' + (keNum < 10 ? '0' : '') + keNum;
  const tang = parseInt(match[2], 10) || 1;
  const o = parseInt(match[3], 10) || 1;
  r.fileKe = ke; r.fileTang = tang; r.fileO = o;
  toast('Đã gán ' + r.ma + ' vào ' + ke + '-T' + tang + '-O' + o + ' (Bấm "Lưu chênh lệch & Đồng bộ" để lưu lên Sheet)', 'ok');
  reconcileRun();
}

function applyReconRow(idx, silent){
  if (!kkReconResult || !kkReconResult.rows[idx]) return 0;
  const r = kkReconResult.rows[idx];
  if (r.keOutOfRange) {
    if (!silent) toast('Dòng ' + r.ma + ' có kệ ' + r.rawKe + ' vượt quá ' + SO_KE + ' kệ (K01-K' + (SO_KE < 10 ? '0' : '') + SO_KE + '), cần sửa kệ trước!', 'err');
    return 0;
  }
  const defLocVal = ($('#kkReconDefaultLoc') && $('#kkReconDefaultLoc').value) || 'K01-T1-O1';
  let ke = r.fileKe || (r.appLocs[0] && r.appLocs[0].ke);
  let tang = r.fileTang || (r.appLocs[0] && r.appLocs[0].tang) || 1;
  let o = r.fileO || (r.appLocs[0] && r.appLocs[0].o) || 1;

  if (!ke && defLocVal !== 'NONE') {
    const parts = defLocVal.split('-');
    ke = parts[0] || 'K01';
    tang = parseInt((parts[1] || '1').replace(/[^\\d]/g, ''), 10) || 1;
    o = parseInt((parts[2] || '1').replace(/[^\\d]/g, ''), 10) || 1;
  }

  if (!ke) {
    if (!silent) toast('Dòng ' + r.ma + ' chưa có vị trí Kệ trong file, hãy chọn "Ô kệ mặc định" ở trên để cân vào kho đệm!', 'err');
    return 0;
  }

  if (!itemOf(r.ma)) {
    K.items.push({ ma:r.ma, ten:r.ten || r.ma, model:r.model || '', mau:r.mau || '', size:r.size || '', dvt:'đôi' });
  }
  // Nếu chuyển kệ/ô khác, đưa các ô cũ về 0 trước khi gán tồn chuẩn vào ô mục tiêu
  r.appLocs.forEach(old => {
    if (old.ke !== ke || old.tang !== tang || (r.multiBins && r.multiBins.length ? !r.multiBins.includes(old.o) : old.o !== o)) {
      enqueue({ loai:'KIEMKE', ke:old.ke, tang:old.tang, o:old.o, maVT:r.ma, soLuong:0, ghiChu:'Chuyển vị trí đối chiếu file sang ' + ke + '-T' + tang + '-O' + o });
    }
  });

  if (r.multiBins && r.multiBins.length > 1) {
    // Phân bổ đều tồn sang các ô (VD 1.2.3 -> chia đều cho Ô 1, Ô 2, Ô 3)
    const n = r.multiBins.length;
    const base = Math.floor(r.targetStock / n);
    const rem = r.targetStock % n;
    r.multiBins.forEach((binIdx, bI) => {
      const q = base + (bI < rem ? 1 : 0);
      enqueue({ loai:'KIEMKE', ke, tang, o:binIdx, maVT:r.ma, soLuong:q, ghiChu:'Cân đối MŨ BTP (' + (bI + 1) + '/' + n + ' ô ' + r.rawBin + (r.po ? ' · PO: ' + r.po : '') + ')' });
    });
  } else {
    enqueue({ loai:'KIEMKE', ke, tang, o, maVT:r.ma, soLuong:r.targetStock, ghiChu:'Cân đối theo file MŨ BTP' + (r.po ? ' · PO: ' + r.po : '') });
  }
  save(LS.data, K);
  if (!silent) {
    beep(true);
    const locNote = r.multiBins && r.multiBins.length > 1 ? ke + '-T' + tang + '-(Ô ' + r.multiBins.join(',') + ')' : ke + '-T' + tang + '-O' + o;
    toast('Đã cân tồn ' + r.ma + ' = ' + fmt(r.targetStock) + ' tại ' + locNote, 'ok');
    reconcileRun();
  }
  return 1;
}

async function saveReconBatchToSheet(){
  if (!kkReconResult || !kkReconResult.rows.length) return;
  const rows = kkReconResult.rows;
  const defLocVal = ($('#kkReconDefaultLoc') && $('#kkReconDefaultLoc').value) || 'K01-T1-O1';

  // Lấy các dòng có tồn kho mục tiêu > 0 hoặc đang có tồn trên App bị lệch
  const candidates = rows.filter(r => !r.keOutOfRange && (r.targetStock > 0 || r.appStock > 0 || r.isLocDiff));
  if (!candidates.length) {
    toast('Tất cả các dòng tồn kho đã khớp 100%!', 'ok');
    return;
  }

  const ops = [];
  let noShelfAssignedCount = 0;

  candidates.forEach(r => {
    let ke = r.fileKe || (r.appLocs[0] && r.appLocs[0].ke);
    let tang = r.fileTang || (r.appLocs[0] && r.appLocs[0].tang) || 1;
    let o = r.fileO || (r.appLocs[0] && r.appLocs[0].o) || 1;

    if (!ke && defLocVal !== 'NONE') {
      const parts = defLocVal.split('-');
      ke = parts[0] || 'K01';
      tang = parseInt((parts[1] || '1').replace(/[^\\d]/g, ''), 10) || 1;
      o = parseInt((parts[2] || '1').replace(/[^\\d]/g, ''), 10) || 1;
      noShelfAssignedCount++;
    }

    if (!ke) return; // Bỏ qua nếu chọn NONE và không có kệ

    // Nếu chuyển vị trí, clear vị trí cũ
    r.appLocs.forEach(old => {
      if (old.ke !== ke || old.tang !== tang || (r.multiBins && r.multiBins.length ? !r.multiBins.includes(old.o) : old.o !== o)) {
        ops.push({
          id: 'DC-CLR-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
          loai: 'KIEMKE',
          ke: old.ke,
          tang: old.tang,
          o: old.o,
          maVT: r.ma,
          tenVT: r.ten || r.ma,
          soLuong: 0,
          ghiChu: 'Chuyển vị trí sang ' + ke + '-T' + tang + '-O' + o
        });
      }
    });

    // Gán tồn mục tiêu
    if (r.multiBins && r.multiBins.length > 1) {
      const n = r.multiBins.length;
      const base = Math.floor(r.targetStock / n);
      const rem = r.targetStock % n;
      r.multiBins.forEach((binIdx, bI) => {
        const q = base + (bI < rem ? 1 : 0);
        ops.push({
          id: 'DC-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + bI,
          loai: 'KIEMKE',
          ke: ke,
          tang: tang,
          o: binIdx,
          maVT: r.ma,
          tenVT: r.ten || r.ma,
          soLuong: q,
          ghiChu: 'Cân tồn MŨ BTP (' + (bI + 1) + '/' + n + ' ô ' + r.rawBin + (r.po ? ' · PO: ' + r.po : '') + ')'
        });
      });
    } else {
      ops.push({
        id: 'DC-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        loai: 'KIEMKE',
        ke: ke,
        tang: tang,
        o: o,
        maVT: r.ma,
        tenVT: r.ten || r.ma,
        soLuong: r.targetStock,
        ghiChu: 'Cân đối theo file MŨ BTP' + (r.po ? ' · PO: ' + r.po : '')
      });
    }
  });

  if (!ops.length) {
    toast('Không có dòng nào cần lưu.', 'err');
    return;
  }

  let confirmMsg = 'Chuẩn bị đồng bộ ' + ops.length + ' thao tác (thuộc ' + candidates.length + ' mã mũ) lên Google Sheet.\\n';
  if (noShelfAssignedCount > 0) {
    confirmMsg += '• Có ' + noShelfAssignedCount + ' dòng chưa ghi kệ được quy hoạch tạm vào Ô ' + defLocVal + '.\\n';
  }
  confirmMsg += 'Sau khi đồng bộ, Google Sheet và App sẽ khớp 100% với File đối chiếu. Bạn có chắc chắn muốn lưu?';

  if (!confirm(confirmMsg)) return;

  // Mở modal tiến trình
  showReconProgress(true, 'Đang đồng bộ dữ liệu lên Google Sheet...', 0, ops.length);

  const batchSize = 35;
  const batches = [];
  for (let i = 0; i < ops.length; i += batchSize) {
    batches.push(ops.slice(i, i + batchSize));
  }

  let doneCount = 0;
  try {
    for (let bi = 0; bi < batches.length; bi++) {
      const chunk = batches[bi];
      const stepText = 'Đợt ' + (bi + 1) + ' / ' + batches.length + ' (' + doneCount + ' / ' + ops.length + ' thao tác)';
      showReconProgress(true, 'Đang gửi dữ liệu lên Google Sheet...', doneCount, ops.length, stepText);

      // Gửi đợt này lên Google Apps Script
      if (API) {
        let sent = false;
        for (let retry = 1; retry <= 3; retry++) {
          try {
            await post('BATCH_SYNC', { ops: chunk, user: SESS ? SESS.user.ma : 'kho' });
            sent = true;
            break;
          } catch (err) {
            if (retry === 3) throw err;
            await new Promise(res => setTimeout(res, 1200 * retry));
          }
        }
      } else {
        localSync(chunk);
      }

      doneCount += chunk.length;
      showReconProgress(true, 'Đã lưu xong đợt ' + (bi + 1) + ' / ' + batches.length, doneCount, ops.length);
      await new Promise(res => setTimeout(res, 250));
    }

    showReconProgress(true, 'Đang tải lại dữ liệu mới nhất từ Google Sheet...', ops.length, ops.length, 'Hoàn tất ghi Sheet!');
    if (API) {
      K = await post('getData');
      save(LS.data, K);
    }
    await new Promise(res => setTimeout(res, 400));
    showReconProgress(false);
    beep(true);
    toast('✔ ĐÃ ĐỒNG BỘ THÀNH CÔNG 100% (' + doneCount + ' thao tác) LÊN GOOGLE SHEET!', 'ok');
    reconcileRun();
  } catch (err) {
    showReconProgress(false);
    toast('Lỗi đồng bộ: ' + (err.message || err), 'err');
    beep(false);
  }
}

`;

html = html.slice(0, startIdx) + newReconLogic + html.slice(endIdx);

// Also replace the button onclick to call saveReconBatchToSheet
const oldSaveAdjustClick = `if ($('#kkReconSaveAdjust')) $('#kkReconSaveAdjust').onclick = () => {
  if (!kkReconResult) return;
  const defLocVal = ($('#kkReconDefaultLoc') && $('#kkReconDefaultLoc').value) || 'NONE';
  let cnt = 0;
  kkReconResult.rows.forEach((r, i) => {
    if (!r.ok && !r.keOutOfRange && (r.fileKe || r.appKe || defLocVal !== 'NONE')) {
      cnt += applyReconRow(i, true);
    }
  });
  beep(true);
  toast('Đã đồng bộ & cân tồn ' + cnt + ' dòng theo File đối chiếu', 'ok');
  reconcileRun();
};`;

const newSaveAdjustClick = `if ($('#kkReconSaveAdjust')) $('#kkReconSaveAdjust').onclick = () => {
  saveReconBatchToSheet();
};`;

html = html.replace(oldSaveAdjustClick, newSaveAdjustClick);

fs.writeFileSync(targetPath, html, 'utf8');
console.log('Upgraded reconciliation logic successfully in docs/index.html');
