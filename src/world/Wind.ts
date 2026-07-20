import { wrapAngle } from '../world/projection';

/**
 * 风场：按纬度带模拟大航海时代的风系。
 * 返回风向（风"吹向"的方向，弧度：0=东，π/2=南）与风力（0~1.2）。
 */
export interface Wind {
  dir: number;
  speed: number;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function windAt(lat: number, day: number): Wind {
  const abs = Math.abs(lat);
  const south = lat < 0;

  // 各风带的基础风向（北半球取值，南半球镜像）
  // 赤道无风带(0~8°)：风向不定、风力弱
  // 信风带(8~30°)：吹向偏西（北半球略偏南，南半球略偏北）
  // 西风带(30~55°)：吹向偏东（北半球略偏北，南半球略偏南）
  // 极地(>55°)：东风
  const tradeDir = Math.PI + (south ? 0.35 : -0.35);
  const westDir = south ? 0.3 : -0.3;
  const polarDir = Math.PI;

  let dir: number;
  let speed: number;

  if (abs < 8) {
    dir = Math.PI + Math.sin(day * 0.5 + lat) * 1.2;
    speed = 0.25;
  } else if (abs < 30) {
    const t = smoothstep(8, 14, abs);
    dir = lerpAngle(Math.PI, tradeDir, t);
    speed = 0.25 + 0.55 * t;
  } else if (abs < 55) {
    const t = smoothstep(30, 38, abs);
    dir = lerpAngle(tradeDir, westDir, t);
    speed = 0.8 + 0.25 * t;
  } else {
    const t = smoothstep(55, 62, abs);
    dir = lerpAngle(westDir, polarDir, t);
    speed = 1.05 - 0.35 * t;
  }

  // 随时间缓慢变化
  dir += Math.sin(day * 0.23 + lat * 0.11) * 0.25;
  speed *= 0.85 + 0.3 * Math.sin(day * 0.41 + lat * 0.07);
  speed = Math.min(1.2, Math.max(0.1, speed));

  return { dir: wrapAngle(dir), speed };
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}
