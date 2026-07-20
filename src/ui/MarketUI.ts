import type { Game } from '../core/Game';
import type { Port } from '../scenes/WorldScene';
import {
  GOODS,
  GOOD_MAP,
  addCargo,
  applyTradeImpact,
  buyPrice,
  cargoCapacity,
  cargoOf,
  cargoTotal,
  ensurePortIndices,
  getIndex,
  removeCargo,
  sellPrice,
} from '../systems/Economy';

const FOOD_PRICE = 2;
const WATER_PRICE = 1;
const SUPPLY_CAP = 300;

/** 市场界面：商品买卖 + 补给 */
export function createMarketUI(game: Game, port: Port): HTMLElement {
  const st = game.state;
  ensurePortIndices(st, port.id);
  const container = document.createElement('div');

  function trade(kind: 'buy' | 'sell', goodId: string, qty: number): void {
    const idx = getIndex(st, port.id, goodId);
    if (kind === 'buy') {
      const price = buyPrice(port.region, goodId, idx);
      const affordable = Math.floor(st.money / price);
      const space = cargoCapacity(st) - cargoTotal(st);
      const n = Math.min(qty, affordable, space);
      if (n <= 0) {
        game.hud.toast(space <= 0 ? '货舱已满！' : '金币不足！');
        return;
      }
      st.money -= price * n;
      addCargo(st, goodId, n);
      applyTradeImpact(st, port.id, goodId, n);
    } else {
      const price = sellPrice(port.region, goodId, idx);
      const n = Math.min(qty, cargoOf(st, goodId));
      if (n <= 0) return;
      st.money += price * n;
      removeCargo(st, goodId, n);
      applyTradeImpact(st, port.id, goodId, -n);
    }
    render();
  }

  function buySupply(kind: 'food' | 'water'): void {
    const price = kind === 'food' ? FOOD_PRICE : WATER_PRICE;
    const cur = kind === 'food' ? st.food : st.water;
    const n = Math.min(50, Math.floor(st.money / price), SUPPLY_CAP - Math.floor(cur));
    if (n <= 0) {
      game.hud.toast(cur >= SUPPLY_CAP ? '补给已满！' : '金币不足！');
      return;
    }
    st.money -= price * n;
    if (kind === 'food') st.food += n;
    else st.water += n;
    render();
  }

  function render(): void {
    const rows = GOODS.map((g) => {
      const idx = getIndex(st, port.id, g.id);
      const bp = buyPrice(port.region, g.id, idx);
      const sp = sellPrice(port.region, g.id, idx);
      const held = cargoOf(st, g.id);
      const trend = idx > 1.05 ? '📈' : idx < 0.95 ? '📉' : '';
      return `<tr>
        <td>${g.name} <span style="color:#8a94a8;font-size:12px">${g.category}</span></td>
        <td>${bp} ${trend}</td>
        <td>${sp}</td>
        <td>${held}</td>
        <td>
          <button class="btn" data-act="buy" data-id="${g.id}" data-q="1">买1</button>
          <button class="btn" data-act="buy" data-id="${g.id}" data-q="10">买10</button>
          <button class="btn" data-act="sell" data-id="${g.id}" data-q="1">卖1</button>
          <button class="btn" data-act="sell" data-id="${g.id}" data-q="10">卖10</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:10px;font-size:14px">
        💰 <b>${Math.floor(st.money)}</b> 金币 ｜ 货舱 <b>${cargoTotal(st)}</b> / ${cargoCapacity(st)} ｜
        粮食 ${Math.floor(st.food)} ｜ 淡水 ${Math.floor(st.water)}
      </div>
      <table class="goods">
        <thead><tr><th>商品</th><th>买入价</th><th>卖出价</th><th>持有</th><th>交易</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:12px;font-size:14px">
        🍞 粮食（${FOOD_PRICE}金/50份）
        <button class="btn" data-supply="food">补给</button>
        💧 淡水（${WATER_PRICE}金/50份）
        <button class="btn" data-supply="water">补给</button>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((btn) => {
      btn.onclick = () =>
        trade(btn.dataset.act as 'buy' | 'sell', btn.dataset.id!, Number(btn.dataset.q));
    });
    container.querySelectorAll<HTMLButtonElement>('button[data-supply]').forEach((btn) => {
      btn.onclick = () => buySupply(btn.dataset.supply as 'food' | 'water');
    });
  }

  render();
  return container;
}

/** 船队货舱清单（用于其他界面展示） */
export function cargoSummary(state: Parameters<typeof cargoOf>[0]): string {
  const parts: string[] = [];
  for (const g of GOODS) {
    const n = cargoOf(state, g.id);
    if (n > 0) parts.push(`${GOOD_MAP.get(g.id)!.name}×${n}`);
  }
  return parts.length ? parts.join('、') : '（空）';
}
