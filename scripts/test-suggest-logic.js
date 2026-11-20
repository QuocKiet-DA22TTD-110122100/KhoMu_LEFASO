const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

function createEl() {
  return {
    addEventListener: () => {},
    onclick: null,
    onkeydown: null,
    oninput: null,
    onchange: null,
    textContent: '',
    innerHTML: '',
    value: '',
    hidden: false,
    disabled: false,
    dataset: {},
    querySelectorAll: () => [],
    querySelector: () => null,
    classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {} },
    focus: () => {},
    blur: () => {},
    select: () => {},
    scrollIntoView: () => {}
  };
}

const elCache = new Map();
const getMockEl = (sel) => {
  if (!elCache.has(sel)) elCache.set(sel, createEl());
  return elCache.get(sel);
};

// Mock browser environment
const domMock = {
  window: { addEventListener: () => {} },
  document: {
    addEventListener: () => {},
    readyState: 'complete',
    body: { style: {} },
    querySelectorAll: () => [],
    querySelector: getMockEl
  },
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  },
  console: console
};
domMock.addEventListener = () => {};
domMock.scrollTo = () => {};
domMock.window = domMock;
domMock.window.addEventListener = () => {};
domMock.window.localStorage = domMock.localStorage;

// Extract inline script
const scriptMatches = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const code = scriptMatches[0][1];

const sandbox = vm.createContext({
  ...domMock,
  navigator: { userAgent: 'test' },
  location: { search: '', href: 'http://localhost', hostname: 'localhost' },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {}
});

vm.runInContext(code, sandbox);

console.log('Testing suggestions & PO/SO logic in sandbox...');

// Set up sample data in sandbox (giữ tương thích 5 test ban đầu + bổ sung mã giày có PO/SO/Hệ/Khuôn)
vm.runInContext(`
  K = {
    items: [
      { ma: 'RB20231', ten: 'TRAILZILLO DMX', model: 'TRAILZILLO DMX', mau: 'Đen', size: '41', dvt: 'đôi', po: 'RB20231', so: 'SO8801' },
      { ma: 'RB20617', ten: 'DIRTZILLA DMX', model: 'DIRTZILLA DMX', mau: 'Xám', size: '42', dvt: 'đôi', po: 'RB20617', so: 'SO8802' },
      { ma: 'G-NIKE-01', ten: 'Mũ Nike Air', model: 'KHUON-NK26', mau: 'Hệ A1', size: '41', dvt: 'đôi', po: 'PO2601', so: 'SO9901' },
      { ma: 'G-OLD-02', ten: 'G-OLD-02', model: 'KHUON-OLD', mau: 'Hệ B2', size: '', dvt: 'đôi', ghiChu: 'PO: PO2602 · SO: SO9902 · Chuyền 2' },
      { ma: 'G-LOG-03', ten: 'Mũ từ Logs', model: 'KHUON-LOG', mau: 'Hệ C3', size: '', dvt: 'đôi' },
      { ma: 'G-ZERO-04', ten: 'Mũ Hết Tồn', model: 'KHUON-Z4', mau: 'Hệ Z', size: '40', dvt: 'đôi', po: 'PO2604', so: 'SO9904' }
    ],
    stock: [
      { ke: 'K01', tang: 1, o: 1, maVT: 'RB20231', soLuong: 122 },
      { ke: 'K02', tang: 2, o: 1, maVT: 'RB20617', soLuong: 80 },
      { ke: 'K03', tang: 1, o: 2, maVT: 'G-NIKE-01', soLuong: 150 },
      { ke: 'K04', tang: 2, o: 3, maVT: 'G-OLD-02', soLuong: 60 },
      { ke: 'K05', tang: 3, o: 4, maVT: 'G-LOG-03', soLuong: 45 }
    ],
    logs: [
      { thoiGian: '20/11 08:00', loai: 'KIEMKE', ke: 'K05', tang: 3, o: 4, maVT: 'G-LOG-03', soLuong: 45, ghiChu: 'Cân đối theo file MŨ BTP · PO: PO2603 · SO: SO9903' }
    ]
  };
  kkReconMixed = [
    { maGiay: 'G-RECON-05', maVT: 'G-RECON-05', ten: 'Mũ Recon Excel', po: 'PO2605', so: 'SO9905', he: 'Hệ R5', khuon: 'KHUON-R5', size: '43' }
  ];
`, sandbox);

// Test 1: Tra cứu with "rb2"
const findSugg = sandbox.getLiveSuggestions('rb2', { type: 'find' });
console.log('Test 1 (Find "rb2"): Count =', findSugg.length);
assert.strictEqual(findSugg.length, 2, 'Expected 2 suggestions for Find "rb2"');

// Test 2: Xuất kho at K01-T1-O1 with empty query
const xuatEmptySugg = sandbox.getLiveSuggestions('', { type: 'manual', step: 'item', mode: 'XUAT', loc: { ke: 'K01', tang: 1, o: 1 } });
console.log('Test 2 (Xuat empty at K01-T1-O1): Count =', xuatEmptySugg.length);
assert.strictEqual(xuatEmptySugg.length, 1);
assert.strictEqual(xuatEmptySugg[0].code, 'RB20231');
assert.strictEqual(xuatEmptySugg[0].so, 'SO8801');

// Test 3: Xuất kho at K01-T1-O1 with "rb2"
const xuatSugg = sandbox.getLiveSuggestions('rb2', { type: 'manual', step: 'item', mode: 'XUAT', loc: { ke: 'K01', tang: 1, o: 1 } });
console.log('Test 3 (Xuat "rb2" at K01-T1-O1): Count =', xuatSugg.length);
assert.ok(xuatSugg[0].inSlot && xuatSugg[1].isWarning, 'Sort order or warning flag invalid in Xuat');

// Test 4: Nhập kho at K01-T1-O1 with "rb2"
const nhapSugg = sandbox.getLiveSuggestions('rb2', { type: 'manual', step: 'item', mode: 'NHAP', loc: { ke: 'K01', tang: 1, o: 1 } });
console.log('Test 4 (Nhap "rb2" at K01-T1-O1): Count =', nhapSugg.length);
assert.strictEqual(nhapSugg[0].code, 'RB20231');

// Test 5: Bước 1 loc suggestion with "01"
const locSugg = sandbox.getLiveSuggestions('01', { type: 'manual', step: 'loc' });
console.log('Test 5 (Loc "01"): Count =', locSugg.length);
assert.strictEqual(locSugg[0].code, 'K01-T1-O1');

// Test 6: itemMeta extracts PO & SO from (a) columns, (b) ghiChu, (c) logs, (d) kkReconMixed
const mCol = sandbox.itemMeta('G-NIKE-01');
assert.strictEqual(mCol.po, 'PO2601');
assert.strictEqual(mCol.so, 'SO9901');
const mNote = sandbox.itemMeta('G-OLD-02');
assert.strictEqual(mNote.po, 'PO2602');
assert.strictEqual(mNote.so, 'SO9902');
const mLog = sandbox.itemMeta('G-LOG-03');
assert.strictEqual(mLog.po, 'PO2603');
assert.strictEqual(mLog.so, 'SO9903');
const mRecon = sandbox.itemMeta('G-RECON-05');
assert.strictEqual(mRecon.po, 'PO2605');
assert.strictEqual(mRecon.so, 'SO9905');
console.log('Test 6 (itemMeta sources: columns/ghiChu/logs/kkReconMixed): OK');

// Test 7: matchStockRow & getLiveSuggestions search by SO, PO, Mã giày, Hệ, Khuôn
const stock = sandbox.stockRows();
const findBySoFull = stock.filter(r => sandbox.matchStockRow(r, 'SO8801'));
assert.strictEqual(findBySoFull.length, 1);
assert.strictEqual(findBySoFull[0].maVT, 'RB20231');

const findBySoPartial = stock.filter(r => sandbox.matchStockRow(r, '8801'));
assert.strictEqual(findBySoPartial.length, 1);
assert.strictEqual(findBySoPartial[0].maVT, 'RB20231');

const findBySoPrefix = stock.filter(r => sandbox.matchStockRow(r, 'SO:9902'));
assert.strictEqual(findBySoPrefix.length, 1);
assert.strictEqual(findBySoPrefix[0].maVT, 'G-OLD-02');

const findByPo = stock.filter(r => sandbox.matchStockRow(r, 'PO2603'));
assert.strictEqual(findByPo.length, 1);
assert.strictEqual(findByPo[0].maVT, 'G-LOG-03');

const findByHe = stock.filter(r => sandbox.matchStockRow(r, 'Hệ A1'));
assert.strictEqual(findByHe.length, 1);
assert.strictEqual(findByHe[0].maVT, 'G-NIKE-01');

const findByKhuon = stock.filter(r => sandbox.matchStockRow(r, 'KHUON-OLD'));
assert.strictEqual(findByKhuon.length, 1);
assert.strictEqual(findByKhuon[0].maVT, 'G-OLD-02');

assert.strictEqual(sandbox.getLiveSuggestions('SO8801', { type: 'find' })[0].code, 'RB20231');
assert.strictEqual(sandbox.getLiveSuggestions('SO:9905', { type: 'map' })[0].code, 'G-RECON-05');
assert.strictEqual(sandbox.getLiveSuggestions('SO9901', { type: 'manual', step: 'item', mode: 'NHAP', loc: { ke: 'K03', tang: 1, o: 2 } })[0].code, 'G-NIKE-01');
assert.strictEqual(sandbox.getLiveSuggestions('SO9901', { type: 'manual', step: 'item', mode: 'XUAT', loc: { ke: 'K03', tang: 1, o: 2 } })[0].code, 'G-NIKE-01');
console.log('Test 7 (matchStockRow & getLiveSuggestions by SO/PO/MaGiay/He/Khuon): OK');

// Test 8: renderFind(), renderLiveSuggestBox(), renderShelfModal() HTML contain PO: and SO:
getMockEl('#findInp').value = 'SO9901';
sandbox.renderFind();
const findHtml = getMockEl('#findRes').innerHTML;
assert.ok(findHtml.includes('PO:'), 'renderFind HTML should contain PO:');
assert.ok(findHtml.includes('SO:'), 'renderFind HTML should contain SO:');
assert.ok(findHtml.includes('9901'), 'renderFind HTML should contain 9901');

getMockEl('#findInp').value = 'SO9904';
sandbox.renderFind();
const zeroHtml = getMockEl('#findRes').innerHTML;
assert.ok(zeroHtml.includes('PO:') && zeroHtml.includes('SO:') && zeroHtml.includes('9904'), 'zeroCatalog in renderFind should show PO & SO');

const boxEl = createEl();
sandbox.renderLiveSuggestBox(boxEl, sandbox.getLiveSuggestions('SO9901', { type: 'find' }), 'SO9901', { type: 'find' });
assert.ok(boxEl.innerHTML.includes('PO:') && boxEl.innerHTML.includes('SO:'), 'renderLiveSuggestBox HTML should contain PO: and SO:');

sandbox.openShelfModal('K03', 1, 2);
const modalHtml = getMockEl('#shelfModalBody').innerHTML;
assert.ok(modalHtml.includes('PO: PO2601'), 'renderShelfModal HTML should contain PO: PO2601');
assert.ok(modalHtml.includes('SO: SO9901'), 'renderShelfModal HTML should contain SO: SO9901');
console.log('Test 8 (renderFind / renderLiveSuggestBox / renderShelfModal HTML): OK');

// Test 9: Unit test Code.gs (extractPoSoFromNote_, mergeCsvCodes_, upsertItemsBatch_, sh_, getData_, applyOps_) + ZaloKho.gs
function createGasSandbox(initialItems) {
  const sheetsData = {
    Shelves: [['ma', 'khu', 'soTang', 'soO', 'ghiChu'], ['K01', 'Dãy A', 3, 4, '']],
    Items: initialItems || [['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu']], // 7-col legacy sheet
    Stock: [['ke', 'tang', 'o', 'maVT', 'soLuong', 'capNhat']],
    Logs: [['thoiGian', 'loai', 'ke', 'tang', 'o', 'maVT', 'soLuong', 'nguoi', 'ghiChu', 'clientId']],
    Users: [['ma', 'ten', 'vaiTro', 'salt', 'hash', 'hoatDong']]
  };

  function makeSheet(name) {
    const grid = sheetsData[name];
    return {
      getLastRow: () => grid.length,
      getLastColumn: () => (grid[0] ? grid[0].length : 0),
      setFrozenRows: () => {},
      getDataRange: () => ({ getValues: () => grid.map(r => r.slice()) }),
      getRange: (row, col, numRows, numCols) => {
        const range = {
          clearContent: () => {
            for (let r = row - 1; r < row - 1 + numRows && r < grid.length; r++) {
              for (let c = col - 1; c < col - 1 + numCols; c++) grid[r][c] = '';
            }
            return range;
          },
          setValues: (vals) => {
            vals.forEach((vRow, ri) => {
              const tr = row - 1 + ri;
              while (grid.length <= tr) grid.push([]);
              vRow.forEach((val, ci) => {
                grid[tr][col - 1 + ci] = val;
              });
            });
            if (row === 2 && grid.length > 1 + vals.length) {
              grid.length = 1 + vals.length;
            }
            return range;
          },
          getValues: () => {
            const out = [];
            for (let r = row - 1; r < row - 1 + numRows; r++) {
              const src = grid[r] || [];
              const rowOut = [];
              for (let c = col - 1; c < col - 1 + numCols; c++) rowOut.push(src[c] === undefined ? '' : src[c]);
              out.push(rowOut);
            }
            return out;
          },
          setFontWeight: () => range,
          setNumberFormat: () => range
        };
        return range;
      },
      appendRow: (r) => grid.push(r.slice())
    };
  }

  const ssMock = {
    getSheetByName: (name) => sheetsData[name] ? makeSheet(name) : null,
    insertSheet: (name) => { sheetsData[name] = []; return makeSheet(name); },
    getSpreadsheetTimeZone: () => 'Asia/Ho_Chi_Minh',
    setSpreadsheetTimeZone: () => {}
  };

  const propsStore = { SETUP_DONE: '1' };
  const gasSandbox = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ssMock, flush: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => propsStore[k] || null,
        setProperty: (k, v) => { propsStore[k] = String(v); },
        deleteProperty: k => { delete propsStore[k]; },
        getProperties: () => ({ ...propsStore })
      })
    },
    CacheService: {
      getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      formatDate: () => '20/11 13:30',
      getUuid: () => 'uuid-test',
      base64Encode: x => String(x),
      computeDigest: () => 'digest',
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' }
    },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    Logger: console,
    console: console
  });

  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), gasSandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ZaloKho.gs'), 'utf8'), gasSandbox);
  return { gasSandbox, sheetsData };
}

const { gasSandbox, sheetsData } = createGasSandbox();
assert.deepStrictEqual(Array.from(vm.runInContext('SHEETS.Items', gasSandbox)), ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so']);

// extractPoSoFromNote_ & mergeCsvCodes_
const ex1 = gasSandbox.extractPoSoFromNote_('Cân đối theo file MŨ BTP · PO: PO2601 · SO: SO8801 · Hệ: H1');
assert.strictEqual(ex1.po, 'PO2601');
assert.strictEqual(ex1.so, 'SO8801');

const exFalse = gasSandbox.extractPoSoFromNote_('Số lượng 50 đôi · Chuyền 3 · Giao thiếu');
assert.strictEqual(exFalse.po, '');
assert.strictEqual(exFalse.so, '');

assert.strictEqual(gasSandbox.mergeCsvCodes_('PO1, 0, PO2', 'po2; PO3'), 'PO1, PO2, PO3');

// sh_ upgrades 7-column Items header to 9 columns
gasSandbox.sh_('Items');
assert.deepStrictEqual(sheetsData.Items[0], ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so']);

// upsertItemsBatch_ mode false
gasSandbox.upsertItemsBatch_([
  { ma: 'G1', ten: 'Giày 1', model: 'K1', mau: 'H1', size: '41', dvt: 'đôi', ghiChu: 'Note cũ', po: 'PO1', so: 'SO1' }
], false);
assert.strictEqual(sheetsData.Items.length, 2);
assert.strictEqual(sheetsData.Items[1][7], 'PO1');
assert.strictEqual(sheetsData.Items[1][8], 'SO1');

// mode false ignores existing
gasSandbox.upsertItemsBatch_([{ ma: 'G1', po: 'PO999', so: 'SO999' }], false);
assert.strictEqual(sheetsData.Items[1][7], 'PO1');

// mode true partial update (như savePoNote chỉ gửi ghiChu) must NOT wipe po/so/ten/model
gasSandbox.upsertItemsBatch_([{ ma: 'G1', ghiChu: 'Chuyền 3 PX A2' }], true);
assert.strictEqual(sheetsData.Items[1][1], 'Giày 1');
assert.strictEqual(sheetsData.Items[1][6], 'Chuyền 3 PX A2');
assert.strictEqual(sheetsData.Items[1][7], 'PO1');
assert.strictEqual(sheetsData.Items[1][8], 'SO1');

// mode 'merge' keeps ghiChu cũ and merges multiple PO/SO
gasSandbox.upsertItemsBatch_([{ ma: 'G1', size: '42', po: 'PO2', so: 'SO2', ghiChu: 'Should not overwrite' }], 'merge');
assert.strictEqual(sheetsData.Items[1][6], 'Chuyền 3 PX A2');
assert.strictEqual(sheetsData.Items[1][7], 'PO1, PO2');
assert.strictEqual(sheetsData.Items[1][8], 'SO1, SO2');

// applyOps_ + getData_ enrichment from legacy ghiChu/Logs
gasSandbox.applyOps_([
  { id: 'tx1', loai: 'KIEMKE', ke: 'K01', tang: 1, o: 1, maVT: 'G2', tenVT: 'Giày 2', po: 'PO20', so: 'SO20', he: 'H2', khuon: 'K2', soLuong: 50, ghiChu: 'PO: PO20 · SO: SO20' }
], { ma: 'admin', ten: 'Quản trị' });
assert.strictEqual(sheetsData.Items[2][0], 'G2');
assert.strictEqual(sheetsData.Items[2][7], 'PO20');
assert.strictEqual(sheetsData.Items[2][8], 'SO20');

// Legacy item with PO/SO only in ghiChu & Logs
sheetsData.Items.push(['G3', 'Giày 3', '', '', '', 'đôi', 'PO: PO30 · SO: SO30', '', '']);
const kho = gasSandbox.getData_();
const g3 = kho.items.find(x => x.ma === 'G3');
assert.strictEqual(g3.po, 'PO30');
assert.strictEqual(g3.so, 'SO30');

// Zalo message includes PO & SO
const zMsg = gasSandbox.zaloBuildMsg_(
  { loai: 'NHAP', ke: 'K01', tang: 1, o: 1, ma: 'G1', sl: 10, next: 10, tongMa: 10, userMa: 'admin', userTen: 'Quản trị', time: new Date() },
  { ma: 'G1', ten: 'Giày 1', model: 'K1', mau: 'H1', po: 'PO1, PO2', so: 'SO1, SO2' },
  { admin: 'Quản trị' }
);
assert.ok(zMsg.includes('PO: PO1, PO2') && zMsg.includes('SO: SO1, SO2'), 'Zalo message should include PO and SO');
console.log('Test 9 (Code.gs & ZaloKho.gs unit tests): OK');

// Test 10: Mô phỏng đúng dữ liệu thực tế từ 2 ảnh (Sheet cũ + Excel MŨ BTP)
vm.runInContext(`
  K = {
    items: [
      { ma: 'RB20617', ten: 'RB20617', model: '', mau: '', size: '', dvt: 'đôi', ghiChu: 'Chuyền 1 PX A2', po: '', so: '' },
      { ma: 'RB20231', ten: 'TRAILZILLO DMX', model: '', mau: '', size: '', dvt: 'đôi', ghiChu: '', po: '', so: '' }
    ],
    stock: [
      { ke: 'K01', tang: 1, o: 1, maVT: 'RB20617', soLuong: 80 }
    ],
    logs: []
  };
  kkReconResult = null;
  kkReconIn = [];
  kkReconOut = [];
  kkReconAudit = null;
  const excelRows = [
    ['MÃ GIÀY', 'PO', 'SO', 'HỆ', 'KHUÔN', 'SLKH', 'KỆ', 'Ô', 'TẦNG', 'NHẬP', 'XUẤT', 'TỒN MŨ'],
    ['MOAB 3', 'W44073', '3140058862', "MEN'S", 'MRS-1707', 1162, 'K02', '1.2', 1, 500, 400, 100],
    ['MOAB 3', 'W44086', '3140058871', "WOMEN'S", 'MRS-1707', 300, 'K03', '1', 2, 200, 160, 40],
    ['REEBOK COURT ADVANCE (ĐB)', 'RB21333-1', '3170062093', "WOMEN'S", 'TPR0866', 950, '', '', '', 1900, 1900, 0],
    ['F/S LO PROJECT C', 'RB22424', '3170063982', 'UNISEX', '11312', 9, '', '', '', 0, 0, 0],
    ['DIRTZILLA DMX', 'RB20617', '3170061111', "MEN'S", 'KHUON-DZ', 80, 'K01', '1', 1, 80, 0, 80],
    ['TRAILZILLO DMX', 'RB20231', '3170060000', "MEN'S", 'KHUON-TZ', 100, '', '', '', 100, 100, 0]
  ];
  const parsed = parseReconRows(excelRows, 'mixed', 'MU_BTP_REAL.xlsx');
  kkReconMixed = parsed.lines;
`, sandbox);

sandbox.document.querySelector('#kkReconKeyMode').value = 'PO';
sandbox.reconcileRun();

const reconRows = vm.runInContext('kkReconResult.rows', sandbox);
const rW73 = reconRows.find(r => r.po === 'W44073');
const rW86 = reconRows.find(r => r.po === 'W44086');
const rRB17 = reconRows.find(r => r.po === 'RB20617');
const rRB24 = reconRows.find(r => r.po === 'RB22424');
assert.ok(rW73 && rW86 && rRB17 && rRB24, 'All Excel rows should remain separated by PO');
assert.strictEqual(rW73.stockMa, 'W44073');
assert.strictEqual(rW73.maGiay, 'MOAB 3');
assert.deepStrictEqual(Array.from(rW73.multiBins), [1, 2], 'W44073 should parse multiBins [1, 2]');
assert.strictEqual(rW86.stockMa, 'W44086');
assert.strictEqual(rW86.so, '3140058871');
assert.strictEqual(rW86.he, "WOMEN'S");
assert.strictEqual(rRB17.appStock, 80, 'RB20617 should match existing app stock 80');
assert.strictEqual(rRB17.maGiay, 'DIRTZILLA DMX', 'RB20617 should show real shoe name from Excel');
assert.strictEqual(rRB24.isPlanOnly, true);

// getReconCatalogSyncList() should catch RB20617, RB20231, W44073, W44086, and skip RB22424
const syncInfo = sandbox.getReconCatalogSyncList();
const syncMaSet = new Set(syncInfo.list.map(x => x.ma));
assert.ok(syncMaSet.has('RB20617') && syncMaSet.has('RB20231'), 'Should include existing sheet items needing fix');
assert.ok(syncMaSet.has('W44073') && syncMaSet.has('W44086'), 'Should include in-stock Excel POs');
assert.ok(!syncMaSet.has('RB22424'), 'Should skip plan-only RB22424 not on Sheet');
assert.ok(syncInfo.sampleBadNames.includes('RB20617'), 'Should flag RB20617 as bad duplicate name');

// Verify Code.gs API.syncItemsMeta ('sync' mode) fixes RB20617 & keeps ghiChu, without adding RB22424
const gasReal = createGasSandbox([
  ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so'],
  ['RB20617', 'RB20617', '', '', '', 'đôi', 'Chuyền 1 PX A2', '', ''],
  ['RB20231', 'TRAILZILLO DMX', '', '', '', 'đôi', '', '', '']
]);
vm.runInContext('auth_ = () => ({ ma: "admin", vaiTro: "ADMIN" });', gasReal.gasSandbox);
const syncResp = vm.runInContext('API.syncItemsMeta(' + JSON.stringify({ items: syncInfo.list }) + ')', gasReal.gasSandbox);
assert.strictEqual(syncResp.updated, syncInfo.list.length);
const rowRB20617 = gasReal.sheetsData.Items.find(r => r[0] === 'RB20617');
assert.strictEqual(rowRB20617[1], 'DIRTZILLA DMX', 'RB20617 ten should be updated to DIRTZILLA DMX');
assert.strictEqual(rowRB20617[2], 'KHUON-DZ');
assert.strictEqual(rowRB20617[3], "MEN'S");
assert.strictEqual(rowRB20617[6], 'Chuyền 1 PX A2', 'Existing ghiChu must be preserved');
assert.strictEqual(rowRB20617[7], 'RB20617');
assert.strictEqual(rowRB20617[8], '3170061111');
assert.ok(!gasReal.sheetsData.Items.some(r => r[0] === 'RB22424'), 'Plan-only RB22424 must not be added');

// Verify searching by SO, PO, Mã giày, Hệ, Khuôn works cleanly without mixing W44073 and W44086
vm.runInContext(`
  K.items = ${JSON.stringify(syncResp.kho.items)};
  K.stock = [
    { ke: 'K01', tang: 1, o: 1, maVT: 'RB20617', soLuong: 80 },
    { ke: 'K02', tang: 1, o: 1, maVT: 'W44073', soLuong: 100 },
    { ke: 'K03', tang: 2, o: 1, maVT: 'W44086', soLuong: 40 }
  ];
`, sandbox);
const realStock = sandbox.stockRows();
assert.strictEqual(realStock.filter(r => sandbox.matchStockRow(r, '3140058871')).map(r => r.maVT).join(','), 'W44086');
assert.strictEqual(realStock.filter(r => sandbox.matchStockRow(r, 'W44086')).map(r => r.maVT).join(','), 'W44086');
assert.strictEqual(realStock.filter(r => sandbox.matchStockRow(r, 'MOAB 3')).length, 2);
assert.strictEqual(realStock.filter(r => sandbox.matchStockRow(r, "WOMEN'S")).map(r => r.maVT).join(','), 'W44086');
assert.strictEqual(realStock.filter(r => sandbox.matchStockRow(r, 'MRS-1707')).length, 2);

const suggW86 = sandbox.getLiveSuggestions('3140058871', { type: 'find' });
assert.strictEqual(suggW86.length, 1);
assert.strictEqual(suggW86[0].code, 'W44086');
assert.strictEqual(suggW86[0].so, '3140058871');
assert.strictEqual(suggW86[0].he, "WOMEN'S");

// Verify table header count equals body td count (20 columns)
const theadMatch = html.match(/<div class="tbl-wrap" id="kkReconTableWrap"[\s\S]*?<thead>([\s\S]*?)<\/thead>/);
assert.ok(theadMatch, 'Should find #kkReconTableWrap thead');
const theadRows = [...theadMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
assert.strictEqual(theadRows.length, 2);
const row0Leaf = [...theadRows[0][1].matchAll(/<th\b([^>]*)>/g)].filter(m => !/colspan=/i.test(m[1])).length;
const row1Cols = [...theadRows[1][1].matchAll(/<th\b/g)].length;
assert.strictEqual(row0Leaf + row1Cols, 20, 'thead total columns must be 20');
const reconBodyHtml = getMockEl('#kkReconBody').innerHTML;
const firstTr = reconBodyHtml.match(/<tr>([\s\S]*?)<\/tr>/);
assert.ok(firstTr, 'Should render rows in #kkReconBody');
const bodyTdCount = [...firstTr[1].matchAll(/<td\b/g)].length;
assert.strictEqual(bodyTdCount, 20, 'tbody td count must match thead 20 columns');
console.log('Test 10 (Real screenshot data recon, catalog sync, PO/SO search, 20-col table): OK');

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🚀');
