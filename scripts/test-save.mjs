// 最终验证：主菜单 → 新游戏 → 航行 → 存档 → 刷新 → 继续游戏
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
await page.screenshot({ path: 'final-menu.png' });

// 新游戏
await page.evaluate(() => {
  const g = window.__game;
  g.state.day = Math.floor(g.state.day) + 0.4;
  g.modal.close();
});
// 航行一段
await page.keyboard.press('KeyW');
await new Promise((r) => setTimeout(r, 4000));
// 手动存档
await page.evaluate(() => {
  const g = window.__game;
  g.state.money = 7777;
  const { x, z } = g.state;
  localStorage.setItem('dol-save-v1', JSON.stringify(g.state));
  console.log('saved at', x, z);
});
const before = await page.evaluate(() => ({
  money: window.__game.state.money,
  x: window.__game.state.x,
  z: window.__game.state.z,
}));

// 刷新页面 → 继续游戏
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__game, { timeout: 20000 });
await page.screenshot({ path: 'final-menu2.png' });
// 点击"继续游戏"
const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.menu-item')];
  const cont = items.find((el) => el.textContent.includes('继续游戏'));
  if (cont) {
    cont.click();
    return true;
  }
  return false;
});
await new Promise((r) => setTimeout(r, 800));
const after = await page.evaluate(() => ({
  money: window.__game.state.money,
  x: window.__game.state.x,
  z: window.__game.state.z,
}));
await page.screenshot({ path: 'final-loaded.png' });

console.log('clicked 继续游戏:', clicked);
console.log('before reload:', before);
console.log('after load:', after);
console.log('save/load OK:', before.money === after.money && Math.abs(before.x - after.x) < 0.001);
console.log('console errors:', errors.length ? errors : '(none)');
await browser.close();
