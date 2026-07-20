import { wrapAngle } from '../world/projection';
import { SHIP_TYPE_MAP } from './Shipyard';

export const CANNON_RANGE = 20;
export const FIRE_COOLDOWN = 3;
export const ARENA_RADIUS = 55; // 逃出此半径视为脱离战斗

/** 舷侧是否对敌（舷侧 ±60°~120° 夹角内才能开火） */
export function broadsideReady(heading: number, angleToTarget: number): boolean {
  const a = Math.abs(wrapAngle(angleToTarget - heading));
  return a > Math.PI / 3 && a < (2 * Math.PI) / 3;
}

/** 一次舷侧齐射的伤害：每侧半数炮开火，每门 1~3 点 */
export function volleyDamage(cannons: number): number {
  const guns = Math.floor(cannons / 2);
  let dmg = 0;
  for (let i = 0; i < guns; i++) dmg += 1 + Math.floor(Math.random() * 3);
  return dmg;
}

export function maxDurability(typeId: string): number {
  return SHIP_TYPE_MAP.get(typeId)?.durability ?? 50;
}

export function cannonsOf(typeId: string): number {
  return SHIP_TYPE_MAP.get(typeId)?.cannons ?? 4;
}
