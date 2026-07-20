/** 全局游戏状态（可序列化，用于存档） */

export interface ShipState {
  typeId: string;
  name: string;
  durability: number; // 当前耐久
  crew: number;
  cargo: Record<string, number>; // goodId -> 数量
}

export interface GameState {
  day: number; // 从 1522-01-01 起经过的天数（小数，1 现实秒 = 1 天）
  money: number;
  fleet: ShipState[];
  x: number; // 世界坐标（经度）
  z: number; // 世界坐标（-纬度）
  heading: number; // 航向（弧度，0=东，π/2=南）
  sailing: boolean; // 是否扬帆
  food: number;
  water: number;
  indices: Record<string, Record<string, number>>; // portId -> goodId -> 价格指数
}

export function createNewGame(): GameState {
  return {
    day: 0,
    money: 1000,
    fleet: [
      {
        typeId: 'caravela',
        name: '圣玛利亚号',
        durability: 80,
        crew: 20,
        cargo: {},
      },
    ],
    x: -14,
    z: -38,
    heading: Math.PI / 2,
    sailing: false,
    food: 100,
    water: 100,
    indices: {},
  };
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 天数 → 年月日（简化历法：每年 365 天） */
export function dateOf(day: number): { year: number; month: number; day: number } {
  let d = Math.floor(day);
  const year = 1522 + Math.floor(d / 365);
  d %= 365;
  let month = 0;
  while (month < 11 && d >= MONTH_DAYS[month]) {
    d -= MONTH_DAYS[month];
    month++;
  }
  return { year, month: month + 1, day: d + 1 };
}

export function formatDate(day: number): string {
  const d = dateOf(day);
  return `${d.year}年${d.month}月${d.day}日`;
}
