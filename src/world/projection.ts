/** 经纬度 ⇄ 世界平面坐标（等距圆柱投影，1 度 = 1 单位）。z 轴向北为负。 */

export const lonToX = (lon: number): number => lon;
export const latToZ = (lat: number): number => -lat;
export const xToLon = (x: number): number => x;
export const zToLat = (z: number): number => -z;

/** 把 x 包裹进 [-180, 180) */
export function wrapX(x: number): number {
  return ((((x + 180) % 360) + 360) % 360) - 180;
}

/** 从 from 到 to 的最短经度差（考虑东西向环绕），结果 ∈ [-180, 180] */
export function deltaX(from: number, to: number): number {
  const d = wrapX(to - from);
  return d === -180 ? 180 : d;
}

/** 角度包裹到 (-π, π] */
export function wrapAngle(a: number): number {
  return ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
}

/** 考虑环绕的两点距离（z 不环绕） */
export function worldDist(x1: number, z1: number, x2: number, z2: number): number {
  const dx = deltaX(x1, x2);
  const dz = z2 - z1;
  return Math.hypot(dx, dz);
}
