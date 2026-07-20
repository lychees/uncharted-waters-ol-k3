import type { GameState } from '../core/State';
import { SHIP_TYPE_MAP } from './Shipyard';
import { GOODS, buyPrice, sellPrice } from './Economy';
import portsData from '../data/ports.json';

export const CREW_PRICE = 5;
export const TIP_PRICE = 20;

/** 招募船员到旗舰。返回实际招募人数 */
export function recruitCrew(state: GameState, want: number): number {
  const flag = state.fleet[0];
  const t = SHIP_TYPE_MAP.get(flag.typeId)!;
  const n = Math.min(want, t.crewMax - flag.crew, Math.floor(state.money / CREW_PRICE));
  if (n <= 0) return 0;
  state.money -= n * CREW_PRICE;
  flag.crew += n;
  return n;
}

/** 打听情报：推荐一条从本港出发的赚钱路线 */
export function makeTip(state: GameState, fromRegion: string): string {
  // 找本港便宜、别港昂贵的商品
  let best: { good: string; port: string; profit: number } | null = null;
  for (const g of GOODS) {
    const local = buyPrice(fromRegion, g.id, 1);
    for (const p of portsData) {
      if (p.region === fromRegion) continue;
      const remote = sellPrice(p.region, g.id, 1);
      const profit = remote - local;
      if (!best || profit > best.profit) {
        best = { good: g.name, port: p.name, profit };
      }
    }
  }
  if (!best) return '水手们嘟囔着，没什么新鲜消息。';
  return `水手醉醺醺地说："听说把${best.good}运到${best.port}，能赚不少钱……"`;
}
