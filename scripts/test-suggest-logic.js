const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

// Mock browser environment
const domMock = {
  window: {
    addEventListener: () => {}
  },
  document: {
    addEventListener: () => {},
    readyState: 'complete',
    querySelectorAll: () => [],
    querySelector: () => ({
      addEventListener: () => {},
      onclick: null,
      textContent: '',
      value: '',
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      style: {},
      focus: () => {},
      blur: () => {}
    })
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

// Extract script
const scriptMatches = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const code = scriptMatches[0][1];

const sandbox = vm.createContext({
  ...domMock,
  navigator: { userAgent: 'test' },
  location: { search: '', href: 'http://localhost', hostname: 'localhost' },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
});

vm.runInContext(code, sandbox);

console.log('Testing suggestions logic in sandbox...');

// Set up sample data in sandbox
vm.runInContext(`
  K = {
    items: [
      { ma: 'RB20231', ten: 'TRAILZILLO DMX', model: 'TRAILZILLO DMX', mau: 'Đen', size: '41', dvt: 'đôi' },
      { ma: 'RB20617', ten: 'DIRTZILLA DMX', model: 'DIRTZILLA DMX', mau: 'Xám', size: '42', dvt: 'đôi' }
    ],
    stock: [
      { ke: 'K01', tang: 1, o: 1, maVT: 'RB20231', soLuong: 122 },
      { ke: 'K02', tang: 2, o: 1, maVT: 'RB20617', soLuong: 80 }
    ]
  };
`, sandbox);

console.log('stockRows():', sandbox.stockRows());
console.log('items in sandbox:', sandbox.getAggregatedItems());

// Test 1: Tra cứu with "rb2"
const findSugg = sandbox.getLiveSuggestions('rb2', { type: 'find' });
console.log('Test 1 (Find "rb2"): Count =', findSugg.length);
if (findSugg.length !== 2) throw new Error('Expected 2 suggestions for Find');
console.log('  Item 0:', findSugg[0].code, findSugg[0].model, findSugg[0].qtyStr, findSugg[0].locBadge);
console.log('  Item 1:', findSugg[1].code, findSugg[1].model, findSugg[1].qtyStr, findSugg[1].locBadge);

// Test 2: Xuất kho at K01-T1-O1 with empty query
const xuatEmptySugg = sandbox.getLiveSuggestions('', { type: 'manual', step: 'item', mode: 'XUAT', loc: { ke: 'K01', tang: 1, o: 1 } });
console.log('Test 2 (Xuat empty at K01-T1-O1): Count =', xuatEmptySugg.length);
if (xuatEmptySugg.length !== 1 || xuatEmptySugg[0].code !== 'RB20231') throw new Error('Expected RB20231 in slot');
console.log('  In-slot item:', xuatEmptySugg[0].code, xuatEmptySugg[0].qtyStr, xuatEmptySugg[0].locBadge);

// Test 3: Xuất kho at K01-T1-O1 with "rb2"
const xuatSugg = sandbox.getLiveSuggestions('rb2', { type: 'manual', step: 'item', mode: 'XUAT', loc: { ke: 'K01', tang: 1, o: 1 } });
console.log('Test 3 (Xuat "rb2" at K01-T1-O1): Count =', xuatSugg.length);
console.log('  First item (in slot):', xuatSugg[0].code, xuatSugg[0].inSlot, xuatSugg[0].qtyStr);
console.log('  Second item (other slot):', xuatSugg[1].code, xuatSugg[1].isWarning, xuatSugg[1].locBadge);
if (!xuatSugg[0].inSlot || !xuatSugg[1].isWarning) throw new Error('Sort order or warning flag invalid in Xuat');

// Test 4: Nhập kho at K01-T1-O1 with "rb2"
const nhapSugg = sandbox.getLiveSuggestions('rb2', { type: 'manual', step: 'item', mode: 'NHAP', loc: { ke: 'K01', tang: 1, o: 1 } });
console.log('Test 4 (Nhap "rb2" at K01-T1-O1): Count =', nhapSugg.length);
console.log('  First item:', nhapSugg[0].code, nhapSugg[0].qtyStr, nhapSugg[0].locBadge);

// Test 5: Bước 1 loc suggestion with "01"
const locSugg = sandbox.getLiveSuggestions('01', { type: 'manual', step: 'loc' });
console.log('Test 5 (Loc "01"): Count =', locSugg.length);
console.log('  First loc:', locSugg[0].code, locSugg[0].sub);

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🚀');
