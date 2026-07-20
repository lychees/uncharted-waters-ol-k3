// 造船厂/酒馆/舰队测试
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
  g.state.money = 50000; // 测试资金
});
await new Promise((r) => setTimeout(r, 400));
await page.keyboard.press('KeyE'); // 入港
await new Promise((r) => setTimeout(r, 800));

// 造船厂（16, -2，门朝广场）
await page.evaluate(() => {
  window.__game.scenes.current.player.position.set(12.5, 0, -3);
});
await new Promise((r) => setTimeout(r, 300));
await page.keyboard.press('KeyE');
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: 'shipyard-1.png' });
// 买一艘卡拉克帆船
await page.click('button[data-buy="carrack"]');
await new Promise((r) => setTimeout(r, 300));
const fleet = await page.evaluate(() =>
  window.__game.state.fleet.map((s) => `${s.name}(${s.typeId})`),
);
console.log('fleet after buy:', fleet);
await page.screenshot({ path: 'shipyard-2.png' });
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));

// 酒馆（-16, 6）
await page.evaluate(() => {
  window.__game.scenes.current.player.position.set(-13, 0, 3);
});
await new Promise((r) => setTimeout(r, 300));
await page.keyboard.press('KeyE');
await new Promise((r) => setTimeout(r, 500));
await page.click('#recruitMax');
await new Promise((r) => setTimeout(r, 200));
await page.click('#tip');
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: 'tavern-1.png' });
const crew = await page.evaluate(() => window.__game.state.fleet[0].crew);
console.log('flagship crew:', crew);
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));

// 舰队总览
await page.keyboard.press('KeyF');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: 'fleet-1.png' });

console.log('console errors:', errors.length ? errors : '(none)');
await browser.close();
