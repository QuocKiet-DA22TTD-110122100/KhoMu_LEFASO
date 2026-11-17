const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'docs', 'index.html');
let html = fs.readFileSync(targetFile, 'utf8');

// 1. CSS
const cssTarget = '.find-acts{display:flex;gap:6px;flex-wrap:wrap}';
const cssToAdd = `.find-acts{display:flex;gap:6px;flex-wrap:wrap}

/* =====================================================================
   HỘP GỢI Ý THÔNG MINH AUTOCOMPLETE (TRA CỨU, NHẬP KHO, XUẤT KHO, SƠ ĐỒ)
   ===================================================================== */
.suggest-box-wrap{position:relative}
.live-suggest-box{
  position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:9999;
  background:#ffffff;border-radius:14px;
  border:1.5px solid #2dd4bf;
  box-shadow:0 14px 35px rgba(15,23,42,.18), 0 4px 14px rgba(13,148,136,.14);
  max-height:320px;overflow-y:auto;overscroll-behavior:contain;
  padding:6px;display:flex;flex-direction:column;gap:4px;
}
.live-suggest-box[hidden]{display:none!important}
.suggest-hdr{
  padding:6px 10px 4px;font-size:11px;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;color:#0f766e;display:flex;justify-content:space-between;
  align-items:center;border-bottom:1px solid #e2e8f0;margin-bottom:2px;
}
.suggest-hdr .hdr-count{background:#ccfbf1;color:#0f766e;padding:1px 7px;border-radius:999px;font-size:10.5px}
.suggest-row{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:9px 12px;border-radius:10px;background:#f8fafc;
  border:1.5px solid transparent;cursor:pointer;transition:all .15s ease;
  text-align:left;user-select:none;
}
.suggest-row:hover, .suggest-row.active{
  background:#f0fdfa;border-color:#5eead4;transform:translateX(2px);box-shadow:0 2px 8px rgba(13,148,136,.12);
}
.suggest-row.warning-loc{
  background:#fffbeb;border-color:#fef3c7;
}
.suggest-row.warning-loc:hover, .suggest-row.warning-loc.active{
  background:#fef3c7;border-color:#f59e0b;
}
.suggest-main{flex:1 1 auto;min-width:0}
.suggest-title{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.25;
}
.suggest-po{
  font-family:var(--font-mono);font-size:13.5px;font-weight:800;color:#0f172a;letter-spacing:.02em;
}
.suggest-model{
  font-size:12.5px;font-weight:700;color:#0d9488;
}
.suggest-sub{
  font-size:11px;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
}
.suggest-loc-badge{
  display:inline-flex;align-items:center;gap:3px;font-family:var(--font-mono);font-size:10.5px;
  font-weight:700;padding:1px 6px;border-radius:5px;background:#e2e8f0;color:#334155;
}
.suggest-loc-badge.in-slot{
  background:#ccfbf1;color:#0f766e;border:1px solid #99f6e4;font-weight:800;
}
.suggest-loc-badge.warn{
  background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:800;
}
.suggest-right{text-align:right;flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.suggest-qty{
  font-family:var(--font-mono);font-size:13px;font-weight:800;color:#0d9488;
  padding:2px 7px;border-radius:7px;background:#f0fdfa;white-space:nowrap;
}
.suggest-qty.warn{
  color:#b45309;background:#fef3c7;
}
.suggest-qty.empty{
  color:#94a3b8;background:#f1f5f9;
}
.suggest-mark{background:#fef08a;color:#854d0e;font-weight:800;padding:0 2px;border-radius:3px}
.suggest-empty{padding:14px;text-align:center;font-size:12.5px;color:#94a3b8}`;

if (!html.includes('.live-suggest-box')) {
  if (!html.includes(cssTarget)) throw new Error('CSS target not found');
  html = html.split(cssTarget).join(cssToAdd);
}

// 2. HTML Inputs
// 2A. #manual
const manualOld = `<input class="inp inp-lg mono" id="manual" list="itemList" placeholder="Gõ hoặc bắn mã vạch rồi Enter" autocapitalize="characters" autocomplete="off">`;
const manualNew = `<div class="suggest-box-wrap" style="position:relative;flex:1 1 auto;min-width:0">
          <input class="inp inp-lg mono" id="manual" list="itemList" placeholder="Gõ hoặc bắn mã vạch rồi Enter" autocapitalize="characters" autocomplete="off">
          <div id="manualSuggest" class="live-suggest-box" hidden></div>
        </div>`;
if (html.includes(manualOld)) {
  html = html.split(manualOld).join(manualNew);
}

// 2B. #mapSearch
const mapSearchOld = `<input class="inp" id="mapSearch" style="max-width:250px;min-height:40px" placeholder="Lọc mã mũ trên sơ đồ…" autocapitalize="characters">`;
const mapSearchNew = `<div class="suggest-box-wrap" style="position:relative;max-width:260px;flex:1 1 auto">
          <input class="inp" id="mapSearch" style="width:100%;min-height:40px" placeholder="Lọc mã mũ trên sơ đồ…" autocapitalize="characters" autocomplete="off">
          <div id="mapSuggest" class="live-suggest-box" hidden></div>
        </div>`;
if (html.includes(mapSearchOld)) {
  html = html.split(mapSearchOld).join(mapSearchNew);
}

// 2C. #findInp
const findOld = `<input class="inp inp-lg" id="findInp" placeholder="Tìm mã mũ, tên, model, màu, size hoặc kệ (VD: K01, den 41)…" autocapitalize="characters" autocomplete="off">`;
const findNew = `<div class="suggest-box-wrap" style="position:relative;flex:1 1 auto;min-width:0">
            <input class="inp inp-lg" id="findInp" placeholder="Tìm mã mũ, PO, model, màu, size hoặc kệ (VD: RB20231, K01)…" autocapitalize="characters" autocomplete="off">
            <div id="findSuggest" class="live-suggest-box" hidden></div>
          </div>`;
if (html.includes(findOld)) {
  html = html.split(findOld).join(findNew);
}

// 3. Clear suggestions on go(v, arg) and flowStep(step)
const goOld = `function go(v, arg){`;
const goNew = `function go(v, arg){\n  hideAllLiveSuggestions();`;
if (html.includes(goOld) && !html.includes(goNew)) {
  html = html.split(goOld).join(goNew);
}

const flowStepOld = `function flowStep(step){\n  F.step = step;\n  hideFlowAreas();`;
const flowStepNew = `function flowStep(step){\n  F.step = step;\n  hideAllLiveSuggestions();\n  hideFlowAreas();`;
if (html.includes(flowStepOld) && !html.includes(flowStepNew)) {
  html = html.split(flowStepOld).join(flowStepNew);
}

// 4. Autocomplete Engine JavaScript
const jsEngineTarget = `let findT = null;
$('#findInp').addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(renderFind, 120); });`;

const jsEngineCode = `/* =====================================================================
   HỆ THỐNG GỢI Ý THÔNG MINH (LIVE AUTOCOMPLETE ENGINE)
   Gợi ý tức thì khi gõ cho: Tra cứu (#findInp), Nhập kho (#manual), Xuất kho (#manual), Sơ đồ (#mapSearch)
   ===================================================================== */

function getAggregatedItems() {
  const map = new Map();
  // 1. Lấy từ danh mục K.items
  (K.items || []).forEach(it => {
    const ma = String(it.ma || '').trim().toUpperCase();
    if (!ma) return;
    map.set(ma, {
      code: ma,
      po: it.po || ma,
      model: it.model || it.khuon || '',
      name: it.ten || ma,
      mau: it.mau || it.he || '',
      size: it.size || '',
      dvt: it.dvt || 'đôi',
      totalStock: 0,
      locations: []
    });
  });

  // 2. Lấy bổ sung từ danh sách đối chiếu kiểm kê nếu có (chứa chuẩn PO, model, khuôn)
  const reconRows = (window.kkReconMixed || []).concat(window.kkReconIn || [], window.kkReconOut || []);
  reconRows.forEach(r => {
    const ma = String(r.maGiay || r.maVT || r.po || '').trim().toUpperCase();
    if (!ma) return;
    let entry = map.get(ma);
    if (!entry) {
      entry = {
        code: ma,
        po: r.po || ma,
        model: r.khuon || r.model || '',
        name: r.ten || ma,
        mau: r.he || r.mau || '',
        size: r.size || '',
        dvt: 'đôi',
        totalStock: 0,
        locations: []
      };
      map.set(ma, entry);
    } else {
      if (!entry.model && r.khuon) entry.model = r.khuon;
      if (!entry.po && r.po) entry.po = r.po;
      if (!entry.mau && r.he) entry.mau = r.he;
    }
  });

  // 3. Cộng dồn số liệu tồn kho thực tế từ stockRows()
  const rows = stockRows();
  rows.forEach(r => {
    const ma = String(r.maVT || '').trim().toUpperCase();
    if (!ma) return;
    let entry = map.get(ma);
    if (!entry) {
      const it = itemOf(ma) || {};
      entry = {
        code: ma,
        po: it.po || ma,
        model: it.model || it.khuon || '',
        name: it.ten || ma,
        mau: it.mau || it.he || '',
        size: it.size || '',
        dvt: 'đôi',
        totalStock: 0,
        locations: []
      };
      map.set(ma, entry);
    }
    entry.totalStock += r.soLuong;
    entry.locations.push({ ke: r.ke, tang: r.tang, o: r.o, soLuong: r.soLuong });
  });

  return Array.from(map.values());
}

function highlightMatchText(text, query) {
  const str = String(text || '');
  if (!query || !query.trim()) return esc(str);
  const q = query.trim();
  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx >= 0) {
    return esc(str.slice(0, idx)) + '<mark class="suggest-mark">' + esc(str.slice(idx, idx + q.length)) + '</mark>' + esc(str.slice(idx + q.length));
  }
  return esc(str);
}

function getLiveSuggestions(rawQ, ctx) {
  ctx = ctx || {};
  const qStr = String(rawQ || '').trim();
  const qFold = foldVi(qStr);
  const rows = stockRows();
  const items = getAggregatedItems();

  // TH 1: Khi nhập vị trí ô kệ ở Bước 1
  if (ctx.type === 'manual' && ctx.step === 'loc') {
    if (!qStr) return [];
    const locMatches = [];
    const cellStockMap = {};
    rows.forEach(r => {
      const k = r.ke + '-T' + r.tang + '-O' + r.o;
      cellStockMap[k] = (cellStockMap[k] || 0) + r.soLuong;
    });

    const keMatch = qStr.match(/^k?(\d{1,2})/i);
    const targetKeNum = keMatch ? parseInt(keMatch[1], 10) : 0;

    for (let ki = 1; ki <= SO_KE; ki++) {
      const ke = keCode(ki);
      if (targetKeNum && ki !== targetKeNum && !ke.toLowerCase().includes(qStr.toLowerCase())) continue;
      for (let t = 1; t <= SO_TANG; t++) {
        for (let o = 1; o <= SO_O; o++) {
          const locCode = ke + '-T' + t + '-O' + o;
          if (!qFold || foldVi(locCode).includes(qFold) || locCode.toLowerCase().replace(/[-to]/g, '').includes(qStr.toLowerCase())) {
            const stk = cellStockMap[locCode] || 0;
            locMatches.push({
              isLoc: true,
              code: locCode,
              ke: ke, tang: t, o: o,
              title: 'Vị trí ' + locCode,
              sub: stk > 0 ? ('Đang chứa ' + fmt(stk) + ' đôi mũ') : 'Ô trống (sẵn sàng thao tác)',
              qtyStr: stk > 0 ? fmt(stk) + ' đôi' : 'Trống',
              inStock: stk > 0
            });
            if (locMatches.length >= 8) break;
          }
        }
        if (locMatches.length >= 8) break;
      }
      if (locMatches.length >= 8) break;
    }
    return locMatches;
  }

  // TH 2: Khi Nhập kho hoặc Xuất kho tại Bước 2 (#manual)
  if (ctx.type === 'manual' && ctx.step === 'item') {
    const isXuat = ctx.mode === 'XUAT';
    const loc = ctx.loc;
    const inCellList = loc ? cellItems(loc, rows) : [];
    const inCellMap = new Map();
    inCellList.forEach(r => inCellMap.set(r.maVT, r.soLuong));

    // Nếu Xuất kho và chưa gõ gì (hoặc vừa focus): hiển thị ngay tất cả các mã có trong ô!
    if (!qStr && isXuat) {
      if (!inCellList.length) {
        return [{ isEmptyNote: true, title: 'Ô ' + (loc ? locStr(loc) : '') + ' hiện đang trống hàng' }];
      }
      return inCellList.map(r => {
        const it = itemOf(r.maVT) || {};
        return {
          code: r.maVT,
          po: it.po || r.maVT,
          model: it.model || it.khuon || '',
          name: it.ten || r.maVT,
          locBadge: '✓ Tại ô ' + locStr(loc),
          inSlot: true,
          isWarning: false,
          qtyStr: 'Tồn ô: ' + fmt(r.soLuong) + ' đôi'
        };
      });
    }

    // Nếu Nhập kho và chưa gõ gì: gợi ý các mã đang có trong ô để nhập thêm + mã vừa thao tác
    if (!qStr && !isXuat) {
      const recent = load(LS.recent, []);
      const pool = [];
      inCellList.forEach(r => {
        const it = itemOf(r.maVT) || {};
        pool.push({
          code: r.maVT,
          po: it.po || r.maVT,
          model: it.model || it.khuon || '',
          name: it.ten || r.maVT,
          locBadge: 'Đang có trong ô này',
          inSlot: true,
          isWarning: false,
          qtyStr: 'Có sẵn: ' + fmt(r.soLuong) + ' đôi'
        });
      });
      recent.filter(m => !inCellMap.has(m)).slice(0, 4).forEach(m => {
        const it = itemOf(m) || {};
        pool.push({
          code: m,
          po: it.po || m,
          model: it.model || it.khuon || '',
          name: it.ten || m,
          locBadge: 'Vừa thao tác gần đây',
          inSlot: false,
          isWarning: false,
          qtyStr: 'Gần đây'
        });
      });
      return pool;
    }

    // Người dùng đang gõ (VD: "rb2")
    const tokens = qFold.split(/\\s+/).filter(Boolean);
    let matched = items.filter(it => {
      if (!tokens.length) return false;
      const hay = foldVi([it.code, it.po, it.model, it.name, it.mau, it.size].join(' '));
      return tokens.every(tok => hay.includes(tok));
    });

    if (isXuat) {
      // Xuất kho: Ưu tiên mã CÓ TRONG Ô lên hàng đầu
      matched.sort((a, b) => {
        const aIn = inCellMap.has(a.code) ? 1 : 0;
        const bIn = inCellMap.has(b.code) ? 1 : 0;
        if (aIn !== bIn) return bIn - aIn;
        return (inCellMap.get(b.code) || 0) - (inCellMap.get(a.code) || 0) || b.totalStock - a.totalStock;
      });

      return matched.slice(0, 10).map(it => {
        const inThisSlot = inCellMap.has(it.code);
        const thisQty = inCellMap.get(it.code) || 0;
        let locBadge = '';
        let isWarning = false;
        if (inThisSlot) {
          locBadge = '✓ Tại ô ' + (loc ? locStr(loc) : '');
        } else if (it.locations.length) {
          locBadge = '⚠️ Ở ' + locStr(it.locations[0]) + (it.locations.length > 1 ? ' (+' + (it.locations.length - 1) + ' ô)' : '');
          isWarning = true;
        } else {
          locBadge = 'Chưa có trong kho';
          isWarning = true;
        }

        return {
          code: it.code,
          po: it.po || it.code,
          model: it.model || it.name || '',
          name: it.name || it.code,
          locBadge: locBadge,
          inSlot: inThisSlot,
          isWarning: isWarning,
          qtyStr: inThisSlot ? ('Tồn ô: ' + fmt(thisQty) + ' đôi') : (it.totalStock > 0 ? ('Kho: ' + fmt(it.totalStock) + ' đôi') : 'Hết tồn')
        };
      });
    } else {
      // Nhập kho: Gợi ý theo tiền tố và lượng tồn
      matched.sort((a, b) => {
        const aStarts = a.code.startsWith(qStr.toUpperCase()) || (a.po && a.po.startsWith(qStr.toUpperCase()));
        const bStarts = b.code.startsWith(qStr.toUpperCase()) || (b.po && b.po.startsWith(qStr.toUpperCase()));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return b.totalStock - a.totalStock || a.code.localeCompare(b.code);
      });

      return matched.slice(0, 10).map(it => {
        const inThisSlot = inCellMap.has(it.code);
        const thisQty = inCellMap.get(it.code) || 0;
        return {
          code: it.code,
          po: it.po || it.code,
          model: it.model || it.name || '',
          name: it.name || it.code,
          locBadge: inThisSlot ? 'Đã có trong ô này' : (it.locations.length ? locStr(it.locations[0]) : 'Chưa xếp kệ'),
          inSlot: inThisSlot,
          isWarning: false,
          qtyStr: inThisSlot ? ('Trong ô: ' + fmt(thisQty) + ' đôi') : (it.totalStock > 0 ? ('Toàn kho: ' + fmt(it.totalStock) + ' đôi') : 'Mới')
        };
      });
    }
  }

  // TH 3: Tra cứu (#findInp) hoặc Sơ đồ (#mapSearch)
  if (!qStr) return [];
  const tokens = qFold.split(/\\s+/).filter(Boolean);
  const matched = items.filter(it => {
    const locStrAll = it.locations.map(l => locStr(l)).join(' ');
    const hay = foldVi([it.code, it.po, it.model, it.name, it.mau, it.size, locStrAll].join(' '));
    return tokens.every(tok => hay.includes(tok));
  });

  matched.sort((a, b) => {
    const aStarts = a.code.startsWith(qStr.toUpperCase()) || (a.po && a.po.startsWith(qStr.toUpperCase()));
    const bStarts = b.code.startsWith(qStr.toUpperCase()) || (b.po && b.po.startsWith(qStr.toUpperCase()));
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return b.totalStock - a.totalStock || a.code.localeCompare(b.code);
  });

  return matched.slice(0, 10).map(it => {
    let locBadge = '';
    if (it.locations.length === 1) {
      locBadge = locStr(it.locations[0]);
    } else if (it.locations.length > 1) {
      locBadge = locStr(it.locations[0]) + ' (+' + (it.locations.length - 1) + ' ô)';
    } else {
      locBadge = 'Chưa xếp kệ';
    }

    return {
      code: it.code,
      po: it.po || it.code,
      model: it.model || it.name || '',
      name: it.name || it.code,
      locBadge: locBadge,
      inSlot: false,
      locations: it.locations,
      qtyStr: it.totalStock > 0 ? fmt(it.totalStock) + ' đôi' : 'Tồn 0'
    };
  });
}

function renderLiveSuggestBox(boxEl, items, qStr, ctx, onSelect) {
  if (!boxEl) return;
  if (!items || !items.length) {
    boxEl.hidden = true;
    boxEl.innerHTML = '';
    return;
  }

  const hdrTitle = (ctx.type === 'manual' && ctx.step === 'loc')
    ? 'Gợi ý vị trí ô kệ'
    : (ctx.type === 'manual' && ctx.mode === 'XUAT')
      ? 'Mặt hàng có thể xuất'
      : (ctx.type === 'manual' && ctx.mode === 'NHAP')
        ? 'Gợi ý mã mũ / PO'
        : 'Gợi ý tìm kiếm';

  let html = '<div class="suggest-hdr"><span>' + esc(hdrTitle) + '</span><span class="hdr-count">' + items.length + ' gợi ý</span></div>';

  html += items.map((it, idx) => {
    if (it.isEmptyNote) {
      return '<div class="suggest-empty">' + esc(it.title) + '</div>';
    }
    if (it.isLoc) {
      return '<div class="suggest-row' + (idx === 0 ? ' active' : '') + '" data-sidx="' + idx + '" role="button" tabindex="0">' +
        '<div class="suggest-main">' +
          '<div class="suggest-title"><span class="suggest-po">' + highlightMatchText(it.code, qStr) + '</span></div>' +
          '<div class="suggest-sub">' + esc(it.sub) + '</div>' +
        '</div>' +
        '<div class="suggest-right">' +
          '<span class="suggest-qty' + (!it.inStock ? ' empty' : '') + '">' + esc(it.qtyStr) + '</span>' +
        '</div>' +
      '</div>';
    }

    const rowClass = 'suggest-row' + (idx === 0 ? ' active' : '') + (it.isWarning ? ' warning-loc' : '');
    const badgeClass = 'suggest-loc-badge' + (it.inSlot ? ' in-slot' : it.isWarning ? ' warn' : '');
    const qtyClass = 'suggest-qty' + (it.isWarning ? ' warn' : '');

    return '<div class="' + rowClass + '" data-sidx="' + idx + '" role="button" tabindex="0">' +
      '<div class="suggest-main">' +
        '<div class="suggest-title">' +
          '<span class="suggest-po">' + highlightMatchText(it.code, qStr) + '</span>' +
          (it.model ? '<span class="suggest-model">' + highlightMatchText(it.model, qStr) + '</span>' : '') +
        '</div>' +
        '<div class="suggest-sub">' +
          (it.name && it.name !== it.code && it.name !== it.model ? '<span>' + highlightMatchText(it.name, qStr) + '</span> · ' : '') +
          '<span class="' + badgeClass + '">' + esc(it.locBadge) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="suggest-right">' +
        '<span class="' + qtyClass + '">' + esc(it.qtyStr) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  boxEl.innerHTML = html;
  boxEl.hidden = false;

  boxEl.querySelectorAll('[data-sidx]').forEach(el => {
    el.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const item = items[+el.dataset.sidx];
      if (item && onSelect) onSelect(item);
    };
  });
}

function bindLiveSuggest(inputEl, boxEl, getContextFn, onSelectFn) {
  if (!inputEl || !boxEl) return;
  let timer = null;

  const update = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = inputEl.value;
      const ctx = getContextFn();
      const items = getLiveSuggestions(q, ctx);
      renderLiveSuggestBox(boxEl, items, q, ctx, item => {
        boxEl.hidden = true;
        onSelectFn(item, ctx);
      });
    }, 40);
  };

  inputEl.addEventListener('input', update);
  inputEl.addEventListener('focus', update);

  inputEl.addEventListener('keydown', e => {
    if (boxEl.hidden) return;
    const rows = Array.from(boxEl.querySelectorAll('.suggest-row'));
    if (!rows.length) return;
    const curIdx = rows.findIndex(r => r.classList.contains('active'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (curIdx + 1) % rows.length;
      rows.forEach((r, i) => r.classList.toggle('active', i === nextIdx));
      rows[nextIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (curIdx - 1 + rows.length) % rows.length;
      rows.forEach((r, i) => r.classList.toggle('active', i === prevIdx));
      rows[prevIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (curIdx >= 0 && rows[curIdx]) {
        e.preventDefault();
        e.stopImmediatePropagation();
        rows[curIdx].click();
      }
    } else if (e.key === 'Escape') {
      boxEl.hidden = true;
    }
  });
}

function hideAllLiveSuggestions() {
  $$('.live-suggest-box').forEach(b => {
    b.hidden = true;
    b.innerHTML = '';
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.suggest-box-wrap')) {
    hideAllLiveSuggestions();
  }
});

// Gắn bộ gợi ý cho 3 vị trí chính
function setupAutocompleteSuggestions() {
  // 1. Tra cứu (#findInp)
  bindLiveSuggest($('#findInp'), $('#findSuggest'), () => ({ type: 'find' }), (item) => {
    $('#findInp').value = item.code;
    renderFind();
    $('#findInp').focus();
  });

  // 2. Nhập kho & Xuất kho (#manual)
  bindLiveSuggest($('#manual'), $('#manualSuggest'), () => ({
    type: 'manual',
    step: F.step,
    mode: F.mode,
    loc: F.loc
  }), (item, ctx) => {
    if (item.isLoc) {
      $('#manual').value = item.code;
      flowScan(item.code);
      return;
    }
    if (ctx.mode === 'XUAT' && item.isWarning) {
      beep(false);
      toast('Mã ' + item.code + ' không có trong ô ' + locStr(ctx.loc) + ' (' + item.locBadge + ')', 'err');
      return;
    }
    $('#manual').value = item.code;
    flowScan(item.code);
  });

  // 3. Sơ đồ kệ (#mapSearch)
  bindLiveSuggest($('#mapSearch'), $('#mapSuggest'), () => ({ type: 'map' }), (item) => {
    $('#mapSearch').value = item.code;
    if (item.locations && item.locations.length) {
      go('map', item.locations);
    } else {
      mapSearchQ = item.code;
      renderMap();
    }
  });
}

// Khởi chạy khi tài liệu sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAutocompleteSuggestions);
} else {
  setTimeout(setupAutocompleteSuggestions, 50);
}

let findT = null;
$('#findInp').addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(renderFind, 120); });`;

if (!html.includes('function setupAutocompleteSuggestions')) {
  if (!html.includes(jsEngineTarget)) throw new Error('JS Engine target not found in docs/index.html');
  html = html.split(jsEngineTarget).join(jsEngineCode);
}

fs.writeFileSync(targetFile, html, 'utf8');
console.log('[OK] Da tich hop Live Autocomplete Suggestions vao docs/index.html');
