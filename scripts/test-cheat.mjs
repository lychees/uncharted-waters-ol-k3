// 秘籍测试：输入 show me the money → 金币 +999999
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__game, { timeout: 20000 });
await page.evaluate(() => window.__game.modal.close());

const before = await page.evaluate(() => window.__game.state.money);
await page.keyboard.type('show me the money', { delay: 30 });
await new Promise((r) => setTimeout(r, 500));
const after = await page.evaluate(() => window.__game.state.money);
await page.screenshot({ path: 'cheat.png' });

console.log('money:', before, '->', after);
console.log('cheat OK:', after - before === 999999);
console.log('page errors:', errors.length ? errors : '(none)');
await browser.close();
