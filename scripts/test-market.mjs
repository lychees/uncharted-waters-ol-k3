// 市场交易测试：入港 → 开市场 → 买货 → 验证金币/货舱变化
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

await page.evaluate(() => {
  const g = window.__game;
  g.state.day = Math.floor(g.state.day) + 0.4;
  g.state.x = -9.14;
  g.state.z = -38.72;
});
await new Promise((r) => setTimeout(r, 400));
await page.keyboard.press('KeyE'); // 入港
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => {
  window.__game.scenes.current.player.position.set(-11, 0, -6);
});
await new Promise((r) => setTimeout(r, 300));
await page.keyboard.press('KeyE'); // 开市场
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: 'market-1.png' });

// 买 10 个第一个商品（橄榄油）
const before = await page.evaluate(() => ({
  money: window.__game.state.money,
  cargo: JSON.stringify(window.__game.state.fleet[0].cargo),
}));
await page.click('button[data-act="buy"][data-q="10"]');
await new Promise((r) => setTimeout(r, 300));
const after = await page.evaluate(() => ({
  money: window.__game.state.money,
  cargo: JSON.stringify(window.__game.state.fleet[0].cargo),
}));
await page.screenshot({ path: 'market-2.png' });
console.log('before:', before, 'after:', after);

// 补给
await page.click('button[data-supply="food"]');
await new Promise((r) => setTimeout(r, 200));
const food = await page.evaluate(() => window.__game.state.food);
console.log('food after supply:', food);

console.log('console errors:', errors.length ? errors : '(none)');
await browser.close();
