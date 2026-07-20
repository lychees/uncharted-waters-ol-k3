// 陆地碰撞测试：多场景直冲/斜冲海岸，全程采样船位不得进入陆地
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => console.log('pageerror:', String(e)));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__game, { timeout: 20000 });
await page.evaluate(() => window.__game.modal.close());

// 场景：起点/航向/描述（航向：0=东 π/2=南 π=西 -π/2=北），起点均确保在水面
const scenarios = [
  { name: '正东冲西班牙', x: -12, z: -38, heading: 0 },
  { name: '斜向(东南)冲摩洛哥海岸', x: -10, z: -34, heading: Math.PI / 3 },
  { name: '斜向(东北)冲葡萄牙', x: -12, z: -40, heading: -Math.PI / 4 },
  { name: '向北冲英格兰', x: -2, z: -49, heading: -Math.PI / 2 },
  { name: '斜冲希腊半岛', x: 18, z: -38, heading: Math.PI / 4 },
  { name: '向东冲西奈半岛(苏伊士)', x: 30, z: -32.5, heading: 0 },
  { name: '向南横穿巴拿马地峡', x: -79.5, z: -8.5, heading: Math.PI / 2 },
  { name: '向西横穿佛罗里达', x: -80, z: -26, heading: Math.PI },
];

let allOk = true;
for (const s of scenarios) {
  const result = await page.evaluate(async (sc) => {
    const g = window.__game;
    const scene = g.scenes.current;
    g.state.x = sc.x;
    g.state.z = sc.z;
    g.state.heading = sc.heading;
    g.state.sailing = true;
    const startOnLand = scene.world.isLand(sc.x, sc.z);
    let everOnLand = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      await new Promise((r) => setTimeout(r, 200));
      if (scene.world.isLand(g.state.x, g.state.z)) {
        everOnLand = true;
        break;
      }
    }
    return {
      x: g.state.x.toFixed(2),
      z: g.state.z.toFixed(2),
      startOnLand,
      everOnLand,
      endOnLand: scene.world.isLand(g.state.x, g.state.z),
    };
  }, s);
  const ok = !result.startOnLand && !result.everOnLand && !result.endOnLand;
  allOk = allOk && ok;
  console.log(
    `${ok ? '✅' : '❌'} ${s.name}: 终点(${result.x}, ${result.z}) 起点在陆地=${result.startOnLand} 进入陆地=${result.everOnLand}`,
  );
}

console.log(allOk ? '全部通过：船不会开上陆地' : '失败：船进入了陆地！');
await browser.close();
process.exit(allOk ? 0 : 1);
