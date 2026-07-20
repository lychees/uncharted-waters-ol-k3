import { Game } from './core/Game';

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const res = await fetch('./data/land-110m.json');
  const topo = await res.json();
  const game = new Game(canvas, topo);
  game.start();
  document.getElementById('loading')!.style.display = 'none';
  game.showMainMenu();
  // 调试/自动化测试挂钩
  (window as unknown as { __game: Game }).__game = game;
}

boot().catch((err) => {
  const el = document.querySelector('.loading-text');
  if (el) el.textContent = `加载失败：${err}`;
  console.error(err);
});
