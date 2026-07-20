// 海战测试：把 NPC 拉到玩家旁边 → 开战 → 齐射 → 击沉 → 结算
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
  // 把一个 NPC 拉到玩家旁边
  const scene = g.scenes.current;
  const npc = scene.npcs[0];
  npc.data.x = g.state.x + 2;
  npc.data.z = g.state.z;
  npc.data.wait = 0;
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: 'battle-0.png' });
await page.keyboard.press('KeyB'); // 开战
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: 'battle-1.png' });

// 等待舷侧齐射发生
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: 'battle-2.png' });
const dur = await page.evaluate(() => {
  const s = window.__game.scenes.current;
  return { player: s.player?.durability, enemy: s.enemy?.durability };
});
console.log('durability:', dur);

// 把敌船打到 0，验证击沉结算
await page.evaluate(() => {
  window.__game.scenes.current.enemy.durability = 0;
});
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: 'battle-3.png' });
const money = await page.evaluate(() => window.__game.state.money);
console.log('money after loot:', money);

console.log('console errors:', errors.length ? errors : '(none)');
await browser.close();
