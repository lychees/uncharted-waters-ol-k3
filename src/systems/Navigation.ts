import { wrapAngle } from '../world/projection';

/**
 * 航速计算。
 * heading: 航向（弧度）；windDir: 风吹向（弧度）。
 * 帆船特性：横风（beam reach）最快，顺风次之，正逆风（in irons）几乎无法前进。
 */
const FACTOR_TABLE: Array<[number, number]> = [
  [0, 0.8], // 正顺风
  [Math.PI / 4, 0.95],
  [Math.PI / 2, 1.0], // 横风，最快
  [(Math.PI * 3) / 4, 0.5],
  [2.65, 0.15],
  [Math.PI, 0.1], // 正逆风
];

export function sailingFactor(heading: number, windDir: number): number {
  const a = Math.abs(wrapAngle(heading - windDir));
  for (let i = 1; i < FACTOR_TABLE.length; i++) {
    const [x1, y1] = FACTOR_TABLE[i - 1];
    const [x2, y2] = FACTOR_TABLE[i];
    if (a <= x2) {
      const t = (a - x1) / (x2 - x1);
      return y1 + (y2 - y1) * t;
    }
  }
  return FACTOR_TABLE[FACTOR_TABLE.length - 1][1];
}

export interface SpeedInput {
  baseSpeed: number; // 船型基础航速
  heading: number;
  windDir: number;
  windSpeed: number; // 0~1.2
  crewRatio: number; // 当前船员 / 最低船员
  durabilityRatio: number; // 当前耐久 / 最大耐久
}

/** 实际航速（世界单位/秒） */
export function shipSpeed(input: SpeedInput): number {
  const wind = sailingFactor(input.heading, input.windDir) * Math.min(1, input.windSpeed);
  const crew = Math.min(1, 0.4 + 0.6 * input.crewRatio);
  const hull = 0.5 + 0.5 * Math.max(0, Math.min(1, input.durabilityRatio));
  return input.baseSpeed * wind * crew * hull;
}
