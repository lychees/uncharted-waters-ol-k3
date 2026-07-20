// 无头截图验证：node scripts/screenshot.mjs [url] [outPrefix]
import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:4173/';
const prefix = process.argv[3] ?? 'shot';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__game, { timeout: 20000 });
await page.evaluate(() => window.__game.modal.close());

// 白天上午
await page.evaluate(() => {
  window.__game.state.day = Math.floor(window.__game.state.day) + 0.35;
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${prefix}-day.png` });

// 扬帆航行
await page.keyboard.press('KeyW');
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: `${prefix}-sail.png` });

// 黄昏
await page.evaluate(() => {
  window.__game.state.day = Math.floor(window.__game.state.day) + 0.78;
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${prefix}-dusk.png` });

console.log('console errors:', errors.length ? errors : '(none)');
await browser.close();
