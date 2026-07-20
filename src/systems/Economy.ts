import type { GameState } from '../core/State';
import goodsData from '../data/goods.json';
import shipsData from '../data/ships.json';

export interface Good {
  id: string;
  name: string;
  category: string;
  basePrice: number;
}

export const GOODS = goodsData as Good[];
export const GOOD_MAP = new Map(GOODS.map((g) => [g.id, g]));

/** 各区域物价修正：<1 产地便宜，>1 稀缺昂贵。经典低买高卖贸易路线由此产生。 */
const REGION_MODS: Record<string, Record<string, number>> = {
  西欧: {
    oliveOil: 0.6, wine: 0.6, glassware: 0.7, wool: 0.8,
    pepper: 1.6, cinnamon: 1.6, cloves: 1.7, nutmeg: 1.7, silk: 1.5, porcelain: 1.5,
    tea: 1.5, tobacco: 1.4, coffee: 1.3, cocoa: 1.4, ivory: 1.4, gold: 1.2, pearls: 1.3,
  },
  地中海: {
    wine: 0.7, oliveOil: 0.7, cotton: 0.8, coffee: 0.8, wheat: 0.9,
    pepper: 1.4, cinnamon: 1.4, cloves: 1.5, nutmeg: 1.5, silk: 1.4, porcelain: 1.4,
    tobacco: 1.3, tea: 1.4, ivory: 1.3,
  },
  北欧: {
    wool: 0.6, timber: 0.6, iron: 0.7, copper: 0.8, wheat: 0.8,
    wine: 1.3, oliveOil: 1.3, pepper: 1.6, cinnamon: 1.6, cloves: 1.7, silk: 1.5,
    porcelain: 1.5, sugar: 1.3, tobacco: 1.4, coffee: 1.4, cotton: 1.2, tea: 1.5,
  },
  西非: {
    ivory: 0.6, gold: 0.7, timber: 0.8,
    wine: 1.4, glassware: 1.3, iron: 1.3, copper: 1.2, wheat: 1.3, porcelain: 1.4,
    silk: 1.4, cotton: 1.2, wool: 1.3,
  },
  南非: {
    ivory: 0.8, gold: 0.8, timber: 0.9,
    wine: 1.4, glassware: 1.3, iron: 1.3, wheat: 1.3, cotton: 1.2, porcelain: 1.4,
  },
  东非: {
    ivory: 0.6, gold: 0.75, cloves: 0.8,
    cotton: 1.3, iron: 1.3, porcelain: 1.4, wine: 1.4, silk: 1.3, glassware: 1.3,
  },
  中东: {
    coffee: 0.6, pearls: 0.7, cinnamon: 0.85,
    wine: 1.5, wool: 1.3, iron: 1.2, porcelain: 1.3, silk: 1.2, timber: 1.3, wheat: 1.2,
  },
  印度: {
    pepper: 0.5, cinnamon: 0.6, cotton: 0.6, tea: 0.8,
    wine: 1.5, oliveOil: 1.4, wool: 1.4, glassware: 1.3, silver: 1.2, porcelain: 1.2, gold: 1.1,
  },
  东南亚: {
    cloves: 0.5, nutmeg: 0.5, cinnamon: 0.65, pepper: 0.6,
    porcelain: 1.3, wine: 1.5, wool: 1.4, iron: 1.3, silver: 1.2, glassware: 1.3, cotton: 1.2,
  },
  东亚: {
    silk: 0.5, porcelain: 0.5, tea: 0.6,
    pepper: 1.2, wine: 1.5, wool: 1.4, glassware: 1.3, ivory: 1.3, cotton: 1.2, silver: 1.1, coffee: 1.3,
  },
  加勒比: {
    sugar: 0.5, tobacco: 0.6, cocoa: 0.7,
    wine: 1.4, oliveOil: 1.4, wool: 1.4, iron: 1.4, glassware: 1.4, silk: 1.5, porcelain: 1.5, wheat: 1.2,
  },
  中美洲: {
    cocoa: 0.6, silver: 0.7, gold: 0.8, sugar: 0.7,
    wine: 1.4, iron: 1.4, wool: 1.4, silk: 1.5, porcelain: 1.5, cotton: 1.2, glassware: 1.4,
  },
  南美: {
    silver: 0.6, gold: 0.7, sugar: 0.6, coffee: 0.7, cotton: 0.8,
    wine: 1.4, wool: 1.4, iron: 1.4, glassware: 1.4, silk: 1.5, porcelain: 1.5, wheat: 1.2,
  },
};

export function regionMod(region: string, goodId: string): number {
  return REGION_MODS[region]?.[goodId] ?? 1;
}

/** 确定性伪随机（同一港口+商品+种子恒定） */
function hashRand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** 首次访问某港时初始化其价格指数（0.9~1.1 随机） */
export function ensurePortIndices(state: GameState, portId: string): void {
  if (state.indices[portId]) return;
  const goods: Record<string, number> = {};
  for (const g of GOODS) {
    goods[g.id] = 0.9 + hashRand(`${portId}:${g.id}`) * 0.2;
  }
  state.indices[portId] = goods;
}

export function getIndex(state: GameState, portId: string, goodId: string): number {
  return state.indices[portId]?.[goodId] ?? 1;
}

export function buyPrice(region: string, goodId: string, index: number): number {
  const g = GOOD_MAP.get(goodId)!;
  return Math.max(1, Math.round(g.basePrice * regionMod(region, goodId) * index));
}

export function sellPrice(region: string, goodId: string, index: number): number {
  return Math.max(1, Math.floor(buyPrice(region, goodId, index) * 0.85));
}

/** 指数随时间漂移：回归 1 + 小幅随机游走 */
export function driftIndices(state: GameState, gameDays: number): void {
  const day = Math.floor(state.day);
  for (const [portId, goods] of Object.entries(state.indices)) {
    for (const g of GOODS) {
      let idx = goods[g.id] ?? 1;
      idx += (1 - idx) * 0.03 * gameDays;
      idx += (hashRand(`${portId}:${g.id}:${day}`) - 0.5) * 0.06 * gameDays;
      goods[g.id] = Math.min(1.8, Math.max(0.5, idx));
    }
  }
}

/** 交易对指数的冲击：买入推高、卖出压低 */
export function applyTradeImpact(state: GameState, portId: string, goodId: string, qty: number): void {
  ensurePortIndices(state, portId);
  const cur = state.indices[portId][goodId];
  state.indices[portId][goodId] = Math.min(1.8, Math.max(0.5, cur + qty * 0.003));
}

/* ---------- 货舱（舰队共享容量，旗舰优先装货） ---------- */

export function cargoCapacity(state: GameState): number {
  return state.fleet.reduce((sum, sh) => {
    const t = shipsData.find((s) => s.id === sh.typeId);
    return sum + (t?.cargoCap ?? 0);
  }, 0);
}

export function cargoTotal(state: GameState): number {
  return state.fleet.reduce(
    (sum, sh) => sum + Object.values(sh.cargo).reduce((a, b) => a + b, 0),
    0,
  );
}

export function cargoOf(state: GameState, goodId: string): number {
  return state.fleet.reduce((sum, sh) => sum + (sh.cargo[goodId] ?? 0), 0);
}

export function addCargo(state: GameState, goodId: string, qty: number): void {
  let left = qty;
  for (const sh of state.fleet) {
    const t = shipsData.find((s) => s.id === sh.typeId)!;
    const used = Object.values(sh.cargo).reduce((a, b) => a + b, 0);
    const space = Math.max(0, t.cargoCap - used);
    const put = Math.min(space, left);
    if (put > 0) {
      sh.cargo[goodId] = (sh.cargo[goodId] ?? 0) + put;
      left -= put;
    }
    if (left <= 0) break;
  }
}

export function removeCargo(state: GameState, goodId: string, qty: number): boolean {
  if (cargoOf(state, goodId) < qty) return false;
  let left = qty;
  for (const sh of state.fleet) {
    const has = sh.cargo[goodId] ?? 0;
    const take = Math.min(has, left);
    if (take > 0) {
      sh.cargo[goodId] = has - take;
      if (sh.cargo[goodId] <= 0) delete sh.cargo[goodId];
      left -= take;
    }
    if (left <= 0) break;
  }
  return true;
}
