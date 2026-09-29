// Visit every App.frame path at desktop + phone widths; report console errors and horizontal overflow.
const path = require('path'), fs = require('fs'), os = require('os');
const gRoot = require('child_process').execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(gRoot, 'playwright'));
const pwDir = path.join(os.homedir(), 'AppData/Local/ms-playwright');
const exe = path.join(pwDir, fs.readdirSync(pwDir).find((d) => /^chromium-\d+$/.test(d)), 'chrome-win64', 'chrome.exe');
const outDir = process.argv[2];
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5178/index.html#/'); await page.waitForTimeout(300);
  const frames = await page.evaluate(() => { const out = []; UI.screenIndex(); document.querySelectorAll('.proto-list a').forEach((a) => out.push([a.querySelector('code').textContent, a.getAttribute('href').slice(1)])); return out; });
  console.log('frames:', frames.length);
  for (const [code, p] of frames) {
    for (const w of [1440, 400]) {
      errs.length = 0;
      await page.setViewportSize({ width: w, height: 900 });
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto('about:blank'); await page.goto('http://localhost:5178/index.html#' + p); await page.waitForTimeout(350);
      const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, title: (document.querySelector('.view-title, .dlg-head h2') || {}).textContent, err: !!document.querySelector('.note.danger') && document.querySelector('.note.danger').textContent.startsWith('Lỗi hiển thị') }));
      if (w === 1440 && outDir) await page.screenshot({ path: path.join(outDir, code.replace(/[^\w.]/g, '_') + '.png') });
      const bad = errs.length || r.over > 0 || r.err;
      console.log((bad ? 'FAIL ' : 'ok   ') + code.padEnd(6) + String(w).padEnd(5) + p + ' | ' + (r.title || '').trim().slice(0, 40) + (r.over > 0 ? ' OVERFLOW ' + r.over : '') + (errs.length ? ' ERR ' + errs.join(' || ') : ''));
    }
  }
  await browser.close();
})();
