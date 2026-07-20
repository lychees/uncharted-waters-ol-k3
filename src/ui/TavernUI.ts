import type { Game } from '../core/Game';
import type { Port } from '../scenes/WorldScene';
import { SHIP_TYPE_MAP } from '../systems/Shipyard';
import { CREW_PRICE, TIP_PRICE, makeTip, recruitCrew } from '../systems/Tavern';

/** 酒馆界面：招募船员 / 打听情报 */
export function createTavernUI(game: Game, port: Port): HTMLElement {
  const st = game.state;
  const container = document.createElement('div');

  function render(tipText?: string): void {
    const flag = st.fleet[0];
    const t = SHIP_TYPE_MAP.get(flag.typeId)!;
    container.innerHTML = `
      <div style="font-size:14px;line-height:2">
        💰 <b>${Math.floor(st.money)}</b> 金币<br>
        旗舰「${flag.name}」船员：<b>${flag.crew}</b> / ${t.crewMax}（最低需要 ${t.crewMin}）<br>
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" id="recruit10">招募 10 人（${10 * CREW_PRICE}金）</button>
        <button class="btn" id="recruitMax">尽量招募（${CREW_PRICE}金/人）</button>
        <button class="btn" id="tip">打听情报（${TIP_PRICE}金）</button>
      </div>
      ${tipText ? `<div style="margin-top:14px;padding:10px;background:rgba(255,217,122,0.08);border-radius:6px;font-size:14px">${tipText}</div>` : ''}
    `;
    container.querySelector<HTMLButtonElement>('#recruit10')!.onclick = () => {
      const n = recruitCrew(st, 10);
      game.hud.toast(n > 0 ? `招募了 ${n} 名船员` : '无法招募（人满或钱不够）');
      render();
    };
    container.querySelector<HTMLButtonElement>('#recruitMax')!.onclick = () => {
      const n = recruitCrew(st, 999);
      game.hud.toast(n > 0 ? `招募了 ${n} 名船员` : '无法招募（人满或钱不够）');
      render();
    };
    container.querySelector<HTMLButtonElement>('#tip')!.onclick = () => {
      if (st.money < TIP_PRICE) {
        game.hud.toast('金币不足');
        return;
      }
      st.money -= TIP_PRICE;
      render(makeTip(st, port.region));
    };
  }

  render();
  return container;
}
