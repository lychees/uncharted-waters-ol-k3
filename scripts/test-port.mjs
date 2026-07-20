// 港口场景测试：传送到里斯本 → 入港 → 行走 → 进建筑 → 出港
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

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__game, { timeout: 20000 });
await page.evaluate(() => window.__game.modal.close());

// 白天 + 传送到里斯本锚点附近
await page.evaluate(() => {
  const g = window.__game;
  g.state.day = Math.floor(g.state.day) + 0.4;
  g.state.x = -9.14;
  g.state.z = -38.72;
});
await new Promise((r) => setTimeout(r, 500));
await page.keyboard.press('KeyE'); // 入港
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: 'port-1.png' });

// 走到市场门口（直接定位到门附近验证交互）
await page.evaluate(() => {
  window.__game.scenes.current.player.position.set(-11, 0, -6);
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: 'port-2.png' });
await page.keyboard.press('KeyE'); // 进市场
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: 'port-3.png' });
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));

// 到码头尽头出港
await page.evaluate(() => {
  window.__game.scenes.current.player.position.set(0, 0, 19);
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: 'port-4.png' });
await page.keyboard.press('KeyE'); // 出港
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: 'port-5.png' });

console.log('console errors:', errors.length ? errors : '(none)');
await browser.close();
