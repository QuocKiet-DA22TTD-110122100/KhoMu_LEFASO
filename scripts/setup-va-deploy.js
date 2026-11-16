/**
 * Cong cu kiem tra cu phap va tu dong deploy Kho Mu TBS:
 *   - Google Apps Script qua `clasp` (`apps-script/`)
 *   - Tu dong gan link Web App `/exec` vao `DEFAULT_API` trong `docs/index.html` & `index.html`
 *   - GitHub & GitHub Pages qua `git` (nhanh `main`, thu muc `/docs`)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAS_DIR = path.join(ROOT_DIR, 'apps-script');
const CODE_GS_PATH = path.join(GAS_DIR, 'Code.gs');
const CLASP_JSON_PATH = path.join(GAS_DIR, '.clasp.json');
const DOCS_INDEX_PATH = path.join(ROOT_DIR, 'docs', 'index.html');
const ROOT_INDEX_PATH = path.join(ROOT_DIR, 'index.html');

function runCmd(cmd, cwd = ROOT_DIR) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function getArgValue(args, flag) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  const eq = args.find(a => a.startsWith(flag + '='));
  return eq ? eq.slice(flag.length + 1) : '';
}

/**
 * Kiem tra cu phap Code.gs + JS inline trong docs/index.html va dong bo docs/index.html -> index.html.
 */
function checkAndSync() {
  const gsCode = fs.readFileSync(CODE_GS_PATH, 'utf8');
  new vm.Script(gsCode, { filename: 'apps-script/Code.gs' });
  console.log('[OK] Cu phap hop le: apps-script/Code.gs');

  const html = fs.readFileSync(DOCS_INDEX_PATH, 'utf8');
  const scriptMatches = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scriptMatches.length) throw new Error('Khong tim thay the <script> chinh trong docs/index.html');
  scriptMatches.forEach((m, i) => {
    new vm.Script(m[1], { filename: `docs/index.html#script-${i + 1}` });
  });
  console.log('[OK] Cu phap hop le: docs/index.html');

  fs.copyFileSync(DOCS_INDEX_PATH, ROOT_INDEX_PATH);
  console.log('[OK] Da dong bo docs/index.html -> index.html');
}

/**
 * Ghi apps-script/.clasp.json cho Script ID da tao san.
 */
function writeClaspConfig(scriptId, parentId) {
  const cfg = {
    scriptId,
    rootDir: '',
    scriptExtensions: ['.js', '.gs'],
    htmlExtensions: ['.html'],
    jsonExtensions: ['.json'],
    filePushOrder: [],
    skipSubdirectories: false
  };
  if (parentId) cfg.parentId = parentId;
  fs.writeFileSync(CLASP_JSON_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log('[OK] Da ghi apps-script/.clasp.json (scriptId=' + scriptId + ')');
}

/**
 * Gan Web App URL `/exec` vao DEFAULT_API trong docs/index.html va index.html.
 */
function embedDefaultApi(execUrl) {
  const html = fs.readFileSync(DOCS_INDEX_PATH, 'utf8');
  const re = /const DEFAULT_API = '[^']*';/;
  if (!re.test(html)) throw new Error('Khong tim thay `const DEFAULT_API = ...;` trong docs/index.html');
  const updated = html.replace(re, `const DEFAULT_API = '${execUrl}';`);
  fs.writeFileSync(DOCS_INDEX_PATH, updated, 'utf8');
  fs.copyFileSync(DOCS_INDEX_PATH, ROOT_INDEX_PATH);
  console.log('[OK] Da gan DEFAULT_API vao docs/index.html va index.html: ' + execUrl);
}

/**
 * Tim deployment ID Web App hien co (khong phai @HEAD) neu da tung deploy.
 */
function findExistingDeploymentId() {
  try {
    const out = runCmd('clasp deployments', GAS_DIR);
    const lines = out.split(/\r?\n/).filter(l => /AKfycb[A-Za-z0-9_-]+/.test(l) && !/@HEAD\b/.test(l));
    if (!lines.length) return '';
    const m = lines[lines.length - 1].match(/(AKfycb[A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
  } catch (e) {
    return '';
  }
}

const WEBAPP_MANIFEST = {
  timeZone: 'Asia/Ho_Chi_Minh',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
  webapp: {
    executeAs: 'USER_DEPLOYING',
    access: 'ANYONE_ANONYMOUS'
  }
};

function ensureWebappManifest() {
  const manifestPath = path.join(GAS_DIR, 'appsscript.json');
  fs.writeFileSync(manifestPath, JSON.stringify(WEBAPP_MANIFEST, null, 2) + '\n', 'utf8');
}

/**
 * Tao Google Sheet + Apps Script (neu chua co .clasp.json), push Code.gs va deploy Web App.
 */
function deployGas() {
  if (!fs.existsSync(CLASP_JSON_PATH)) {
    console.log('[GAS] Chua co apps-script/.clasp.json -> tao Google Sheet + Apps Script "Kho Mu TBS"...');
    const createOut = runCmd('clasp create --type sheets --title "Kho Mu TBS"', GAS_DIR);
    console.log(createOut.trim());
  }

  ensureWebappManifest();
  const claspCfg = JSON.parse(fs.readFileSync(CLASP_JSON_PATH, 'utf8'));
  console.log('[GAS] Dang day Code.gs & appsscript.json len Apps Script...');
  console.log(runCmd('clasp push -f', GAS_DIR).trim());

  const existingDepId = findExistingDeploymentId();
  const deployCmd = existingDepId
    ? `clasp deploy -i ${existingDepId} -d "Kho Mu TBS"`
    : 'clasp deploy -d "Kho Mu TBS"';
  console.log('[GAS] Dang trien khai Web App (' + deployCmd + ')...');
  const deployOut = runCmd(deployCmd, GAS_DIR);
  console.log(deployOut.trim());

  const match = deployOut.match(/(AKfycb[A-Za-z0-9_-]+)/);
  if (!match) {
    throw new Error('Khong tach duoc Deployment ID tu ket qua `clasp deploy`:\n' + deployOut);
  }

  const depId = match[1];
  const execUrl = `https://script.google.com/macros/s/${depId}/exec`;
  embedDefaultApi(execUrl);

  console.log('\n=== THONG TIN APPS SCRIPT ===');
  console.log('Script ID   :', claspCfg.scriptId || '(xem .clasp.json)');
  if (claspCfg.parentId) {
    console.log('Google Sheet: https://docs.google.com/spreadsheets/d/' + claspCfg.parentId + '/edit');
  }
  console.log('Web App URL :', execUrl);
  return { scriptId: claspCfg.scriptId, parentId: claspCfg.parentId || '', execUrl };
}

/**
 * Commit thay doi va push len GitHub nhanh main.
 */
function deployGit(repoUrl) {
  if (!fs.existsSync(path.join(ROOT_DIR, '.git'))) {
    runCmd('git init');
    runCmd('git branch -M main');
  }
  if (repoUrl) {
    try {
      runCmd('git remote get-url origin');
      runCmd(`git remote set-url origin "${repoUrl}"`);
    } catch (e) {
      runCmd(`git remote add origin "${repoUrl}"`);
    }
  }
  runCmd('git add -A');
  const status = runCmd('git status --porcelain').trim();
  if (status) {
    runCmd('git commit -m "Cap nhat Kho Mu TBS"');
    console.log('[GIT] Da commit thay doi moi.');
  } else {
    console.log('[GIT] Khong co thay doi moi can commit.');
  }
  const remoteUrl = runCmd('git remote get-url origin').trim();
  console.log('[GIT] Dang push len ' + remoteUrl + ' (main)...');
  const pushOut = runCmd('git push -u origin main');
  if (pushOut.trim()) console.log(pushOut.trim());
  console.log('[OK] Da push code len GitHub nhanh main.');
}

function main() {
  const args = process.argv.slice(2);
  const scriptId = getArgValue(args, '--script-id');
  const parentId = getArgValue(args, '--sheet-id');
  const setApiUrl = getArgValue(args, '--set-api');
  const repoUrl = getArgValue(args, '--repo');
  const runAll = args.includes('--all');
  const doCheck = args.includes('--check') || runAll || args.includes('--gas');
  const doGas = args.includes('--gas') || runAll;
  const doGit = args.includes('--git') || runAll;

  if (scriptId) writeClaspConfig(scriptId, parentId);
  if (setApiUrl) embedDefaultApi(setApiUrl);
  if (doCheck) checkAndSync();
  if (doGas) deployGas();
  if (doGit) deployGit(repoUrl);
  if (!scriptId && !setApiUrl && !doCheck && !doGas && !doGit) {
    console.log('Cach dung: node scripts/setup-va-deploy.js [--check] [--script-id <ID>] [--set-api <URL>] [--gas] [--repo <URL>] [--git] [--all]');
  }
}

try {
  main();
} catch (err) {
  console.error('[LOI]', err && err.stderr ? String(err.stderr) : (err && err.message ? err.message : err));
  process.exit(1);
}
