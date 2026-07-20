import type { Game } from '../core/Game';
import type { Port } from '../scenes/WorldScene';
import {
  MAX_FLEET,
  SHIP_TYPES,
  SHIP_TYPE_MAP,
  buyShip,
  repairCost,
  repairShip,
  sellShip,
} from '../systems/Shipyard';

/** 造船厂界面：买船 / 卖船 / 修理 */
export function createShipyardUI(game: Game, port: Port): HTMLElement {
  const st = game.state;
  const container = document.createElement('div');

  function render(): void {
    const fleetRows = st.fleet
      .map((sh, i) => {
        const t = SHIP_TYPE_MAP.get(sh.typeId)!;
        const cost = repairCost(sh);
        return `<tr>
          <td>${i === 0 ? '⭐ ' : ''}${sh.name}</td>
          <td>${t.name}</td>
          <td>${sh.durability}/${t.durability}</td>
          <td>${sh.crew}/${t.crewMax}</td>
          <td>
            <button class="btn" data-repair="${i}" ${cost <= 0 ? 'disabled' : ''}>修理（${cost}金）</button>
            <button class="btn" data-sell="${i}">出售</button>
          </td>
        </tr>`;
      })
      .join('');

    const shopRows = SHIP_TYPES.map(
      (t) => `<tr>
        <td>${t.name}</td>
        <td>${t.baseSpeed.toFixed(1)}</td>
        <td>${t.cargoCap}</td>
        <td>${t.crewMin}~${t.crewMax}</td>
        <td>${t.durability}</td>
        <td>${t.cannons}</td>
        <td>${t.price}</td>
        <td><button class="btn" data-buy="${t.id}" ${st.money < t.price || st.fleet.length >= MAX_FLEET ? 'disabled' : ''}>购买</button></td>
      </tr>`,
    ).join('');

    container.innerHTML = `
      <div style="margin-bottom:10px;font-size:14px">💰 <b>${Math.floor(st.money)}</b> 金币 ｜ 舰队 ${st.fleet.length}/${MAX_FLEET} 艘</div>
      <h3 style="margin:8px 0 4px;color:#ffd97a;font-size:15px">我的舰队</h3>
      <table class="goods">
        <thead><tr><th>船名</th><th>船型</th><th>耐久</th><th>船员</th><th>操作</th></tr></thead>
        <tbody>${fleetRows}</tbody>
      </table>
      <h3 style="margin:14px 0 4px;color:#ffd97a;font-size:15px">出售中的船</h3>
      <table class="goods">
        <thead><tr><th>船型</th><th>航速</th><th>货舱</th><th>船员</th><th>耐久</th><th>炮位</th><th>价格</th><th></th></tr></thead>
        <tbody>${shopRows}</tbody>
      </table>
    `;

    container.querySelectorAll<HTMLButtonElement>('button[data-buy]').forEach((btn) => {
      btn.onclick = () => {
        const err = buyShip(st, btn.dataset.buy!);
        game.hud.toast(err ?? '新船加入舰队！');
        render();
      };
    });
    container.querySelectorAll<HTMLButtonElement>('button[data-sell]').forEach((btn) => {
      btn.onclick = () => {
        const err = sellShip(st, Number(btn.dataset.sell));
        game.hud.toast(err ?? '船已售出');
        render();
      };
    });
    container.querySelectorAll<HTMLButtonElement>('button[data-repair]').forEach((btn) => {
      btn.onclick = () => {
        const err = repairShip(st, Number(btn.dataset.repair));
        game.hud.toast(err ?? '修理完成');
        render();
      };
    });
  }

  render();
  return container;
}
