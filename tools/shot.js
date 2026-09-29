// Usage: node tools/shot.js "<hash-path>" out.png [width] [height] [--dark] [--as=u2] [--click=<css selector>]
// --as: user id to log in as (u1 admin, u2 kế toán, u3 thủ quỹ, u4 BGH, u5 phụ huynh). Default u2.
// Renders http://localhost:5178/index.html#<path> in headless Chromium and saves a screenshot; prints console errors.
const path = require('path'), fs = require('fs'), os = require('os');
const gRoot = require('child_process').execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(gRoot, 'playwright'));
const pwDir = path.join(os.homedir(), 'AppData/Local/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).find((d) => /^chromium-\d+$/.test(d));
const exe = path.join(pwDir, chromeDir, 'chrome-win64', 'chrome.exe');
(async () => {
  const [route, out, w = 1440, h = 900, ...rest] = process.argv.slice(2);
  const dark = rest.includes('--dark');
  const as = (rest.find((a) => a.startsWith('--as=')) || '--as=u2').slice(5);
  const clicks = rest.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8));
  const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: dark ? 'dark' : 'light' });
  await page.addInitScript((u) => { try { if (!sessionStorage.getItem('x')) { localStorage.setItem('edupay-session', u); sessionStorage.setItem('x', '1'); } } catch (e) {} }, as);
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5178/index.html#' + route);
  await page.waitForTimeout(400);
  for (const c of clicks) { await page.click(c); await page.waitForTimeout(300); }
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
})().catch((e) => { console.error(e.message); process.exit(1); });
