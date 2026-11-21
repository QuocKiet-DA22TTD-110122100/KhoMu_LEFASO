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

const makeStepEl = () => {
  const s = createEl();
  s.querySelector = () => createEl();
  return s;
};
const mockStepEls = [makeStepEl(), makeStepEl(), makeStepEl()];

// Mock browser environment
const domMock = {
  window: { addEventListener: () => {} },
  document: {
    addEventListener: () => {},
    readyState: 'complete',
    body: { style: {} },
    querySelectorAll: (sel) => (sel === '#steps .f-step' ? mockStepEls : []),
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
assert.deepStrictEqual(Array.from(vm.runInContext('SHEETS.Items', gasSandbox)), ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so', 'slkh']);

// extractPoSoFromNote_ & mergeCsvCodes_
const ex1 = gasSandbox.extractPoSoFromNote_('Cân đối theo file MŨ BTP · PO: PO2601 · SO: SO8801 · Hệ: H1');
assert.strictEqual(ex1.po, 'PO2601');
assert.strictEqual(ex1.so, 'SO8801');

const exFalse = gasSandbox.extractPoSoFromNote_('Số lượng 50 đôi · Chuyền 3 · Giao thiếu');
assert.strictEqual(exFalse.po, '');
assert.strictEqual(exFalse.so, '');

assert.strictEqual(gasSandbox.mergeCsvCodes_('PO1, 0, PO2', 'po2; PO3'), 'PO1, PO2, PO3');

// sh_ upgrades 7-column Items header to 10 columns (ending with slkh)
gasSandbox.sh_('Items');
assert.deepStrictEqual(sheetsData.Items[0], ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so', 'slkh']);

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

// Test 11: renderQty NHAP/XUAT rules (Chuyền gò 12 Gò Line + 4 Gò truyền thống, only PX A2/B2, positive qty buttons only)
vm.runInContext(`F = { mode: 'NHAP', step: 'qty', loc: { ke: 'K01', tang: 1, o: 1 }, ma: 'RB20617' }; renderQty();`, sandbox);
const nhapQtyHtml = getMockEl('#qtyArea').innerHTML;
assert.ok(!nhapQtyHtml.includes('qtyChuyen'), 'NHAP must not show qtyChuyen');
assert.ok(!nhapQtyHtml.includes('Chuyền 1'), 'NHAP must not show Chuyen chips');
assert.ok(!/PX\s*[AB]1/.test(nhapQtyHtml), 'NHAP must not contain PX A1 or PX B1');
assert.ok(nhapQtyHtml.includes('PX A2') && nhapQtyHtml.includes('PX B2'), 'NHAP must show PX A2 and PX B2');
assert.ok(!/data-d="-/.test(nhapQtyHtml), 'NHAP must not have negative delta buttons');
assert.ok(nhapQtyHtml.includes('data-d="1"') && nhapQtyHtml.includes('data-d="500"'), 'NHAP must have positive delta buttons +1..+500');

vm.runInContext(`F = { mode: 'XUAT', step: 'qty', loc: { ke: 'K01', tang: 1, o: 1 }, ma: 'RB20617' }; renderQty();`, sandbox);
const xuatQtyHtml = getMockEl('#qtyArea').innerHTML;
assert.ok(xuatQtyHtml.includes('qtyChuyen'), 'XUAT must keep qtyChuyen');
assert.ok(xuatQtyHtml.includes('<option value="">Chuyền gò</option>'), 'XUAT dropdown must say Chuyền gò');
assert.ok(!xuatQtyHtml.includes('Chuyền may'), 'XUAT must not say Chuyền may');
for (let i = 1; i <= 12; i++) {
  assert.ok(xuatQtyHtml.includes('<option value="Gò Line ' + i + '">Gò Line ' + i + '</option>'), 'XUAT must include Gò Line ' + i);
}
assert.ok(!xuatQtyHtml.includes('Gò Line 13'), 'XUAT must have at most 12 Gò Line options');
for (let i = 1; i <= 4; i++) {
  assert.ok(xuatQtyHtml.includes('<option value="Gò truyền thống ' + i + '">Gò truyền thống ' + i + '</option>'), 'XUAT must include Gò truyền thống ' + i);
}
assert.ok(!xuatQtyHtml.includes('Gò truyền thống 5'), 'XUAT must have at most 4 Gò truyền thống options');
assert.ok(xuatQtyHtml.includes('qtyAfterPreview'), 'XUAT must render live subtraction preview');
assert.ok(xuatQtyHtml.includes('PX A2') && xuatQtyHtml.includes('PX B2'), 'XUAT must show PX A2 and PX B2');
assert.ok(!/PX\s*[AB]1/.test(xuatQtyHtml), 'XUAT must not contain PX A1 or PX B1');
assert.ok(!/data-d="-/.test(xuatQtyHtml), 'XUAT must not have negative delta buttons');

assert.ok(!/PX\s*[AB]1/.test(html), 'docs/index.html must not contain PX A1 or PX B1 anywhere');
assert.ok(!/Chuyền may/i.test(html), 'docs/index.html must not contain Chuyền may anywhere');
console.log('Test 11 (renderQty NHAP/XUAT: Chuyền gò 12 Line + 4 TT, only PX A2/B2, positive qty buttons only): OK');

// Test 12: Xuất kho subtraction (40 - 36 = 4) across frontend single-bin/multi-bin, backend Code.gs duplicates, and ZaloKho.gs
const resetQtyInputs = () => {
  getMockEl('#qty').value = '';
  getMockEl('#qtyNote').value = '';
  getMockEl('#qtyChuyen').value = '';
  getMockEl('#qtyPx').value = '';
  getMockEl('#qtyThieu').value = '';
};

// 12a. Frontend single-bin 40 - 36 = 4 with Gò Line 3 + PX A2
resetQtyInputs();
vm.runInContext(`
  API = '';
  SESS = { token: 't', user: { ma: 'kho', ten: 'Thủ kho' } };
  Q = [];
  ERRS = [];
  K.stock = [{ ke: 'K01', tang: 1, o: 1, maVT: 'RB20617', soLuong: 40 }];
  F = { mode: 'XUAT', step: 'qty', loc: { ke: 'K01', tang: 1, o: 1 }, ma: 'RB20617' };
  renderQty();
`, sandbox);
getMockEl('#qty').value = '36';
getMockEl('#qtyChuyen').value = 'Gò Line 3';
getMockEl('#qtyPx').value = 'A2';
sandbox.saveQty();
const after12a = vm.runInContext(`stockRows()`, sandbox);
assert.strictEqual(after12a.length, 1);
assert.strictEqual(after12a[0].soLuong, 4, '40 - 36 must leave 4 in bin');
const toast12a = getMockEl('#toast').textContent;
assert.ok(toast12a.includes('Đã xuất 36') && toast12a.includes('Còn lại: 4'), 'Toast must confirm 36 exported and 4 left, got: ' + toast12a);
const log12a = vm.runInContext(`K.logs[0]`, sandbox);
assert.strictEqual(log12a.ghiChu, 'Gò Line 3 · PX A2');

// 12b. Frontend single-bin 40 - 36 = 4 even when #qtyChuyen is not selected
resetQtyInputs();
vm.runInContext(`
  Q = [];
  K.stock = [{ ke: 'K01', tang: 1, o: 1, maVT: 'RB20617', soLuong: 40 }];
  F = { mode: 'XUAT', step: 'qty', loc: { ke: 'K01', tang: 1, o: 1 }, ma: 'RB20617' };
  renderQty();
`, sandbox);
getMockEl('#qty').value = '36';
sandbox.saveQty();
const after12b = vm.runInContext(`stockRows()`, sandbox);
assert.strictEqual(after12b[0].soLuong, 4, 'Exporting 36 out of 40 without Chuyền selected must still subtract to 4');

// 12c. Frontend multi-bin (4 in O1 + 36 in O2 = 40 total), export 36 from O1 -> O1 empty, O2 = 4
resetQtyInputs();
vm.runInContext(`
  Q = [];
  K.stock = [
    { ke: 'K01', tang: 1, o: 1, maVT: 'W44073', soLuong: 4 },
    { ke: 'K01', tang: 1, o: 2, maVT: 'W44073', soLuong: 36 }
  ];
  F = { mode: 'XUAT', step: 'qty', loc: { ke: 'K01', tang: 1, o: 1 }, ma: 'W44073' };
  renderQty();
`, sandbox);
getMockEl('#qty').value = '36';
getMockEl('#qtyChuyen').value = 'Gò truyền thống 2';
getMockEl('#qtyPx').value = 'B2';
sandbox.saveQty();
const after12c = vm.runInContext(`stockRows()`, sandbox);
assert.strictEqual(after12c.length, 1);
assert.strictEqual(after12c[0].o, 2);
assert.strictEqual(after12c[0].soLuong, 4, 'Multi-bin 4 + 36 export 36 must leave 4 in O2');

// 12d. Over-stock rejection (41 > 40)
resetQtyInputs();
vm.runInContext(`
  Q = [];
  K.stock = [{ ke: 'K01', tang: 1, o: 1, maVT: 'W44073', soLuong: 40 }];
  F = { mode: 'XUAT', step: 'qty', loc: { ke: 'K01', tang: 1, o: 1 }, ma: 'W44073' };
`, sandbox);
getMockEl('#qty').value = '41';
sandbox.saveQty();
const after12d = vm.runInContext(`stockRows()`, sandbox);
assert.strictEqual(after12d[0].soLuong, 40, 'Over-stock export must be blocked and leave 40');

// 12e. Backend Code.gs applyOps_ duplicate rows in Stock (4 + 36 = 40 -> export 36 -> 1 row with 4)
const gasDup = createGasSandbox([
  ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so'],
  ['RB20617', 'DIRTZILLA DMX', 'KHUON-DZ', "MEN'S", '', 'đôi', '', 'RB20617', '3170061111']
]);
gasDup.sheetsData.Stock = [
  ['ke', 'tang', 'o', 'maVT', 'soLuong', 'capNhat'],
  ['K01', 1, 1, 'RB20617', 4, ''],
  ['K01', 1, 1, 'rb20617 ', 36, '']
];
const dupRes = vm.runInContext(
  `applyOps_([{ id: 'tx4036', loai: 'XUAT', ke: 'K01', tang: 1, o: 1, maVT: 'RB20617', soLuong: 36, ghiChu: 'Gò Line 12 · PX A2' }], { ma: 'kho', ten: 'Thủ kho' })`,
  gasDup.gasSandbox
);
assert.strictEqual(dupRes.results[0].ok, true, 'Duplicate rows summing to 40 must succeed exporting 36');
assert.strictEqual(dupRes.results[0].soLuong, 4, 'Backend applyOps_ must compute 40 - 36 = 4');
const remainingRbRows = gasDup.sheetsData.Stock.slice(1).filter(r => r[3] === 'RB20617');
assert.strictEqual(remainingRbRows.length, 1, 'Duplicate Stock rows must be consolidated into 1 clean row');
assert.strictEqual(remainingRbRows[0][4], 4, 'Consolidated Stock row must hold 4');

// 12f. Backend ZaloKho.gs Chuyền gò formatting
const parsedGoLine = vm.runInContext(`parseGhiChuZalo_('Gò Line 12 · PX A2 · Thiếu 4 đôi')`, gasDup.gasSandbox);
assert.strictEqual(parsedGoLine.chuyenLabel, 'Gò Line 12');
assert.strictEqual(parsedGoLine.px, 'A2');
assert.strictEqual(parsedGoLine.thieu, 4);
const parsedGoTT = vm.runInContext(`parseGhiChuZalo_('Gò truyền thống 4 · PX B2')`, gasDup.gasSandbox);
assert.strictEqual(parsedGoTT.chuyenLabel, 'Gò truyền thống 4');
assert.strictEqual(parsedGoTT.px, 'B2');
const msgGoLine = vm.runInContext(
  `zaloBuildMsg_({ loai: 'XUAT', ke: 'K01', tang: 1, o: 1, ma: 'RB20617', sl: 36, delta: -36, cur: 40, next: 4, tongMa: 4, note: 'Gò Line 12 · PX A2', userMa: 'kho', userTen: 'Thủ kho', time: new Date() }, { ma: 'RB20617', ten: 'DIRTZILLA DMX', po: 'RB20617', so: '3170061111' }, {})`,
  gasDup.gasSandbox
);
assert.ok(msgGoLine.includes('🧵 Chuyền gò: Gò Line 12 · PX A2'), 'Zalo message must say Chuyền gò: Gò Line 12 · PX A2');
const msgGoTT = vm.runInContext(
  `zaloBuildMsg_({ loai: 'XUAT', ke: 'K01', tang: 1, o: 2, ma: 'RB20617', sl: 36, delta: -36, cur: 40, next: 4, tongMa: 4, note: 'Gò truyền thống 4 · PX B2', userMa: 'kho', userTen: 'Thủ kho', time: new Date() }, { ma: 'RB20617', ten: 'DIRTZILLA DMX' }, {})`,
  gasDup.gasSandbox
);
assert.ok(msgGoTT.includes('🧵 Chuyền gò: Gò truyền thống 4 · PX B2'), 'Zalo message must say Chuyền gò: Gò truyền thống 4 · PX B2');
console.log('Test 12 (Xuất kho 40 - 36 = 4, multi-bin & duplicate rows, Zalo Chuyền gò): OK');

// Test 13: Kiểm soát số lượng Kế hoạch (SLKH — Backend Code.gs + Frontend Index.html)
// 13a. Backend sh_('Items') upgrades 9-column header -> 10 columns, savePlanBatch, logStats, cleanAndNormalizeSheetData
const gasPlan = createGasSandbox([
  ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so'],
  ['RB20617', 'DIRTZILLA DMX', 'KHUON-DZ', "MEN'S", '', 'đôi', 'Gò Line 3 · PX A2', 'RB20617', '3170061111']
]);
gasPlan.sheetsData.Logs = [
  ['thoiGian', 'loai', 'ke', 'tang', 'o', 'maVT', 'soLuong', 'nguoi', 'ghiChu', 'clientId'],
  [new Date(), 'NHAP', 'K01', 1, 1, 'RB20617', 40, 'kho', 'PX A2', 'tx_p1'],
  [new Date(), 'XUAT', 'K01', 1, 1, 'RB20617', -36, 'kho', 'Gò Line 3 · PX A2', 'tx_p2'],
  [new Date(), 'XUAT', 'K01', 1, 1, 'RB20617', -4, 'kho', 'Sắp kệ từ K01-T1-O1 sang K05-T2-O3', 'tx_p3'],
  [new Date(), 'NHAP', 'K05', 2, 3, 'RB20617', 4, 'kho', 'Sắp kệ từ K01-T1-O1 sang K05-T2-O3', 'tx_p4']
];
gasPlan.sheetsData.Stock = [
  ['ke', 'tang', 'o', 'maVT', 'soLuong', 'capNhat'],
  ['K05', 2, 3, 'RB20617', 4, '']
];
vm.runInContext('auth_ = () => ({ ma: "kho", vaiTro: "WORKER" });', gasPlan.gasSandbox);
gasPlan.gasSandbox.sh_('Items');
assert.deepStrictEqual(gasPlan.sheetsData.Items[0], ['ma', 'ten', 'model', 'mau', 'size', 'dvt', 'ghiChu', 'po', 'so', 'slkh']);

const planSaveRes = vm.runInContext(
  'API.savePlanBatch(' + JSON.stringify({
    items: [
      { ma: 'RB20617', slkh: 36, po: 'RB20617', so: '3170061111' },
      { ma: 'RB-PLAN-100', ten: 'MŨ PLAN 100', po: 'RB-PLAN-100', so: 'SO-PLAN-1', slkh: 100 }
    ]
  }) + ')',
  gasPlan.gasSandbox
);
assert.strictEqual(planSaveRes.updated, 2);
const rbRowPlan = gasPlan.sheetsData.Items.find(r => r[0] === 'RB20617');
assert.strictEqual(rbRowPlan[6], 'Gò Line 3 · PX A2', 'Existing ghiChu must be preserved in plan mode');
assert.strictEqual(rbRowPlan[9], 36, 'slkh column 10 must be saved as 36');
const newPlanRow = gasPlan.sheetsData.Items.find(r => r[0] === 'RB-PLAN-100');
assert.ok(newPlanRow && newPlanRow[9] === 100, 'New planned-only item must be created with slkh = 100');

assert.strictEqual(planSaveRes.kho.logStats.RB20617.nhap, 40, 'logStats must ignore internal relocation NHAP');
assert.strictEqual(planSaveRes.kho.logStats.RB20617.xuat, 36, 'logStats must ignore internal relocation XUAT');
assert.strictEqual(planSaveRes.kho.logStats.RB20617.lastChuyen, 'Gò Line 3');
assert.strictEqual(planSaveRes.kho.logStats.RB20617.lastPx, 'PX A2');

gasPlan.gasSandbox.cleanAndNormalizeSheetData();
const cleanedRbRow = gasPlan.sheetsData.Items.find(r => r[0] === 'RB20617');
assert.strictEqual(cleanedRbRow[9], 36, 'cleanAndNormalizeSheetData must preserve slkh');

// 13b. Frontend getPlanControlRows & renderPlan across all 6 statuses
vm.runInContext(`
  Q = [];
  K = {
    items: [
      { ma: 'M-DONE', ten: 'Mẫu Đủ KH', po: 'M-DONE', so: 'SO1', slkh: 36, ghiChu: 'Gò Line 3 · PX A2' },
      { ma: 'M-SHORT', ten: 'Mẫu Thiếu Nhập', po: 'M-SHORT', so: 'SO2', slkh: 100 },
      { ma: 'M-WAIT', ten: 'Mẫu Chưa Nhập', po: 'M-WAIT', so: 'SO3', slkh: 120 },
      { ma: 'M-READY', ten: 'Mẫu Chờ Xuất', po: 'M-READY', so: 'SO4', slkh: 80 },
      { ma: 'M-OVER', ten: 'Mẫu Vượt KH', po: 'M-OVER', so: 'SO5', slkh: 50 },
      { ma: 'M-NOPLAN', ten: 'Mẫu Chưa Gán KH', po: 'M-NOPLAN', so: 'SO6', slkh: 0 }
    ],
    stock: [
      { ke: 'K01', tang: 1, o: 1, maVT: 'M-DONE', soLuong: 4 },
      { ke: 'K01', tang: 1, o: 2, maVT: 'M-SHORT', soLuong: 40 },
      { ke: 'K02', tang: 1, o: 1, maVT: 'M-READY', soLuong: 50 },
      { ke: 'K02', tang: 1, o: 2, maVT: 'M-OVER', soLuong: 5 },
      { ke: 'K03', tang: 1, o: 1, maVT: 'M-NOPLAN', soLuong: 25 }
    ],
    logStats: {
      'M-DONE': { nhap: 40, xuat: 36, kiemKeDelta: 0 },
      'M-SHORT': { nhap: 60, xuat: 20, kiemKeDelta: 0 },
      'M-READY': { nhap: 80, xuat: 30, kiemKeDelta: 0 },
      'M-OVER': { nhap: 60, xuat: 55, kiemKeDelta: 0 }
    },
    logs: []
  };
  kkReconResult = null; kkReconMixed = [];
  planFilter = 'all';
`, sandbox);

const pRows = sandbox.getPlanControlRows();
const byMa = Object.fromEntries(pRows.map(r => [r.ma, r]));
assert.strictEqual(byMa['M-DONE'].status, 'done');
assert.strictEqual(byMa['M-DONE'].nhapDiff, 4);
assert.strictEqual(byMa['M-DONE'].conPhaiXuat, 0);
assert.strictEqual(byMa['M-DONE'].ton, 4);

assert.strictEqual(byMa['M-SHORT'].status, 'short_in');
assert.strictEqual(byMa['M-SHORT'].thieuNhap, 40);
assert.strictEqual(byMa['M-SHORT'].conPhaiXuat, 80);

assert.strictEqual(byMa['M-WAIT'].status, 'not_received');
assert.strictEqual(byMa['M-WAIT'].thieuNhap, 120);

assert.strictEqual(byMa['M-READY'].status, 'ready_out');
assert.strictEqual(byMa['M-READY'].thieuNhap, 0);
assert.strictEqual(byMa['M-READY'].conPhaiXuat, 50);

assert.strictEqual(byMa['M-OVER'].status, 'over');
assert.strictEqual(byMa['M-OVER'].xuatDiff, 5);

assert.strictEqual(byMa['M-NOPLAN'].status, 'no_plan');
assert.strictEqual(byMa['M-NOPLAN'].ton, 25);

getMockEl('#planSearch').value = '';
getMockEl('#planSort').value = 'short_desc';
sandbox.renderPlan();
assert.ok(getMockEl('#planSummary').innerHTML.includes('Tổng SL Kế hoạch'), 'Plan summary KPIs must render');
assert.ok(getMockEl('#planBody').innerHTML.includes('M-DONE') && getMockEl('#planBody').innerHTML.includes('M-SHORT'), 'Plan table body must render rows');
assert.ok(getMockEl('#planFoot').innerHTML.includes('TỔNG CỘNG (6 mã)'), 'Plan footer must render totals for 6 items');

vm.runInContext(`planFilter = 'short_in'; renderPlan();`, sandbox);
assert.ok(getMockEl('#planBody').innerHTML.includes('M-SHORT') && !getMockEl('#planBody').innerHTML.includes('M-DONE'), 'short_in filter must only include M-SHORT');

vm.runInContext(`planFilter = 'done'; renderPlan();`, sandbox);
assert.ok(getMockEl('#planBody').innerHTML.includes('M-DONE') && !getMockEl('#planBody').innerHTML.includes('M-SHORT'), 'done filter must only include M-DONE');

assert.ok(html.includes('id="vPlan"') && html.includes("id:'plan'"), 'HTML must contain vPlan section and plan nav item');
assert.ok(!/PX\s*[AB]1/.test(html), 'docs/index.html must still not contain PX A1 or PX B1');
assert.ok(!/Chuyền may/i.test(html), 'docs/index.html must still not contain Chuyền may');
console.log('Test 13 (Kiểm soát Kế hoạch SLKH — Backend savePlanBatch/logStats & Frontend statuses/table/filters): OK');

// Test 14: Mobile header cleanup, single camera, Tra cứu full cards + 1-tap direct map blink
assert.ok(!html.includes('id="fabGhCam"'), 'Floating bottom Camera GitHub FAB must be removed');
assert.ok(!html.includes('id="btnTopGhCam"'), 'Top header duplicate Camera GitHub button must be removed');
assert.ok(!html.includes('id="findSuggest"'), 'Overlapping #findSuggest dropdown must be removed');
assert.ok(html.includes("id:'ghCam'"), 'Bottom nav Camera GH shortcut must still exist');

vm.runInContext(`
  Q = [];
  K = {
    items: [
      { ma: 'RB21533', ten: 'QUESTION MID RECODED', po: 'RB21533', so: '3170061969', mau: "MEN'S", model: '30986', dvt: 'đôi' },
      { ma: 'W44099', ten: 'PRINCESS (ĐB)', po: 'W44099', so: '3180061969', mau: "WOMEN'S", model: 'KHUON-W99', dvt: 'đôi' }
    ],
    stock: [
      { ke: 'K01', tang: 1, o: 1, maVT: 'RB21533', soLuong: 640 },
      { ke: 'K02', tang: 2, o: 3, maVT: 'W44099', soLuong: 700 }
    ],
    logs: []
  };
  kkReconResult = null; kkReconMixed = [];
`, sandbox);

getMockEl('#findInp').value = '61969';
sandbox.renderFind();
assert.strictEqual(getMockEl('#findChips').hidden, true, '#findChips must hide while typing query');
const resHtml = getMockEl('#findRes').innerHTML;
const resPlain = resHtml.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'");
assert.ok(resHtml.includes('K01-T1-O1') && resHtml.includes('K02-T2-O3'), 'Both rack/cell locations must show cleanly');
assert.ok(resPlain.includes('RB21533') && resPlain.includes('W44099'), 'Both matching items with same 5 last SO digits must show');
assert.ok(resPlain.includes('3170061969') && resPlain.includes('3180061969'), 'Both full SOs must display clearly');
assert.ok(resPlain.includes('Hệ:') && resPlain.includes("WOMEN'S") && resPlain.includes("MEN'S"), 'He labels must appear cleanly');
assert.ok(resPlain.includes('30986') && resPlain.includes('KHUON-W99'), 'Khuon labels must appear cleanly');
assert.ok(resHtml.includes('640') && resHtml.includes('700'), 'Quantities must appear cleanly');
assert.ok(resHtml.includes('data-loc="0"') && resHtml.includes('data-loc="1"'), 'Direct 1-tap Tới kệ buttons must render');

sandbox.renderMap([{ ke: 'K02', tang: 2, o: 3, ma: 'W44099', qty: 700 }]);
assert.strictEqual(vm.runInContext('mapSel', sandbox), 'K02');
assert.deepStrictEqual(JSON.parse(JSON.stringify(vm.runInContext('mapSelCell', sandbox))), { ke: 'K02', tang: 2, o: 3 });
assert.ok(getMockEl('#mapHintBanner').innerHTML.includes('W44099') && getMockEl('#mapHintBanner').innerHTML.includes('700') && getMockEl('#mapHintBanner').innerHTML.includes('K02-T2-O3'), 'mapHintBanner must display targeted item & bin');
assert.ok(getMockEl('#mapRacks').innerHTML.includes('blink'), 'Target cell must blink in #mapRacks');

// Single object arg must also work cleanly
sandbox.renderMap({ ke: 'K01', tang: 1, o: 1 });
assert.strictEqual(vm.runInContext('mapSel', sandbox), 'K01');
assert.ok(getMockEl('#mapRacks').innerHTML.includes('blink'), 'Single-object renderMap arg must blink cell');
console.log('Test 14 (Mobile header cleanup, single camera, Tra cứu full cards + direct map blink): OK');

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🚀');
