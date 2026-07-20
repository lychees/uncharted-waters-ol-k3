import type { GameState, ShipState } from '../core/State';
import shipsData from '../data/ships.json';

export interface ShipType {
  id: string;
  name: string;
  price: number;
  baseSpeed: number;
  cargoCap: number;
  crewMin: number;
  crewMax: number;
  durability: number;
  cannons: number;
}

export const SHIP_TYPES = shipsData as ShipType[];
export const SHIP_TYPE_MAP = new Map(SHIP_TYPES.map((s) => [s.id, s]));

export const MAX_FLEET = 5;

const SHIP_NAMES = ['圣安东尼奥号', '海神号', '金星号', '飞鱼号', '曙光号', '信天翁号', '冒险号', '幸运号'];

/** 买船。返回错误信息或 null（成功） */
export function buyShip(state: GameState, typeId: string): string | null {
  const t = SHIP_TYPE_MAP.get(typeId);
  if (!t) return '没有这种船';
  if (state.fleet.length >= MAX_FLEET) return `舰队最多 ${MAX_FLEET} 艘船`;
  if (state.money < t.price) return '金币不足';
  state.money -= t.price;
  const ship: ShipState = {
    typeId,
    name: SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)],
    durability: t.durability,
    crew: t.crewMin,
    cargo: {},
  };
  state.fleet.push(ship);
  return null;
}

/** 卖船（价格 = 原价 60% × 耐久比例）。不能卖最后一艘。 */
export function sellShip(state: GameState, index: number): string | null {
  if (state.fleet.length <= 1) return '不能卖掉最后一艘船';
  const ship = state.fleet[index];
  if (!ship) return '没有这艘船';
  const t = SHIP_TYPE_MAP.get(ship.typeId)!;
  const price = Math.floor(t.price * 0.6 * (ship.durability / t.durability));
  state.fleet.splice(index, 1);
  state.money += price;
  return null;
}

export function repairCost(ship: ShipState): number {
  const t = SHIP_TYPE_MAP.get(ship.typeId)!;
  return Math.ceil(((t.durability - ship.durability) / t.durability) * t.price * 0.4);
}

/** 修理至满耐久 */
export function repairShip(state: GameState, index: number): string | null {
  const ship = state.fleet[index];
  if (!ship) return '没有这艘船';
  const cost = repairCost(ship);
  if (cost <= 0) return '船况良好，无需修理';
  if (state.money < cost) return '金币不足';
  state.money -= cost;
  ship.durability = SHIP_TYPE_MAP.get(ship.typeId)!.durability;
  return null;
}

/** 交换旗舰（fleet[0] 为旗舰） */
export function setFlagship(state: GameState, index: number): void {
  if (index <= 0 || index >= state.fleet.length) return;
  const [flag] = state.fleet.splice(index, 1);
  state.fleet.unshift(flag);
}
