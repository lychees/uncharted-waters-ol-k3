// 线上冒烟测试：GitHub Pages 版本能否正常加载运行
import puppeteer from 'puppeteer-core';

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

await page.goto('https://lychees.github.io/uncharted-waters-ol-k3/', {
  waitUntil: 'networkidle0',
  timeout: 60000,
});
await page.waitForFunction(() => window.__game, { timeout: 30000 });
await page.evaluate(() => {
  window.__game.state.day = Math.floor(window.__game.state.day) + 0.4;
  window.__game.modal.close();
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: 'live.png' });
console.log('live OK, console errors:', errors.length ? errors : '(none)');
await browser.close();
