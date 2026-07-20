import type { Game } from '../core/Game';
import { SHIP_TYPE_MAP, setFlagship } from '../systems/Shipyard';
import { cargoCapacity, cargoTotal } from '../systems/Economy';
import { cargoSummary } from './MarketUI';

/** 舰队总览（F 键）：船只列表 + 切换旗舰 + 货物清单 */
export function createFleetUI(game: Game): HTMLElement {
  const st = game.state;
  const container = document.createElement('div');

  function render(): void {
    const rows = st.fleet
      .map((sh, i) => {
        const t = SHIP_TYPE_MAP.get(sh.typeId)!;
        const used = Object.values(sh.cargo).reduce((a, b) => a + b, 0);
        return `<tr>
          <td>${i === 0 ? '⭐ ' : ''}${sh.name}</td>
          <td>${t.name}</td>
          <td>${sh.durability}/${t.durability}</td>
          <td>${sh.crew}/${t.crewMax}</td>
          <td>${used}/${t.cargoCap}</td>
          <td>${i === 0 ? '旗舰' : `<button class="btn" data-flag="${i}">设为旗舰</button>`}</td>
        </tr>`;
      })
      .join('');

    container.innerHTML = `
      <table class="goods">
        <thead><tr><th>船名</th><th>船型</th><th>耐久</th><th>船员</th><th>货舱</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:12px;font-size:14px">
        总货舱：${cargoTotal(st)} / ${cargoCapacity(st)}<br>
        货物：${cargoSummary(st)}<br>
        粮食 ${Math.floor(st.food)} ｜ 淡水 ${Math.floor(st.water)}
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>('button[data-flag]').forEach((btn) => {
      btn.onclick = () => {
        setFlagship(st, Number(btn.dataset.flag));
        game.hud.toast('已更换旗舰');
        render();
      };
    });
  }

  render();
  return container;
}
