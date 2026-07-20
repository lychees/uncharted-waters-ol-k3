import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/core/State';
import {
  addCargo,
  applyTradeImpact,
  buyPrice,
  cargoCapacity,
  cargoOf,
  cargoTotal,
  driftIndices,
  ensurePortIndices,
  getIndex,
  regionMod,
  removeCargo,
  sellPrice,
} from '../src/systems/Economy';

describe('Economy 价格', () => {
  it('产地便宜、销地昂贵（香料路线有利可图）', () => {
    const buyInIndia = buyPrice('印度', 'pepper', 1);
    const sellInEurope = sellPrice('西欧', 'pepper', 1);
    expect(sellInEurope).toBeGreaterThan(buyInIndia);
  });

  it('卖出价低于同地买入价', () => {
    expect(sellPrice('西欧', 'wine', 1)).toBeLessThan(buyPrice('西欧', 'wine', 1));
  });

  it('未定义修正的地区默认为 1', () => {
    expect(regionMod('未知地区', 'wine')).toBe(1);
  });
});

describe('Economy 指数', () => {
  it('买入推高指数、卖出压低指数', () => {
    const st = createNewGame();
    ensurePortIndices(st, 'lisbon');
    const before = getIndex(st, 'lisbon', 'wine');
    applyTradeImpact(st, 'lisbon', 'wine', 20);
    expect(getIndex(st, 'lisbon', 'wine')).toBeGreaterThan(before);
    applyTradeImpact(st, 'lisbon', 'wine', -40);
    expect(getIndex(st, 'lisbon', 'wine')).toBeLessThan(before);
  });

  it('漂移后指数仍在 [0.5, 1.8] 区间', () => {
    const st = createNewGame();
    ensurePortIndices(st, 'goa');
    for (let i = 0; i < 500; i++) {
      st.day += 1;
      driftIndices(st, 1);
    }
    for (const idx of Object.values(st.indices.goa)) {
      expect(idx).toBeGreaterThanOrEqual(0.5);
      expect(idx).toBeLessThanOrEqual(1.8);
    }
  });
});

describe('货舱', () => {
  it('容量受船型限制，装卸正确', () => {
    const st = createNewGame();
    expect(cargoCapacity(st)).toBe(80); // 卡拉维尔
    addCargo(st, 'wine', 50);
    expect(cargoOf(st, 'wine')).toBe(50);
    expect(cargoTotal(st)).toBe(50);
    addCargo(st, 'wine', 50); // 超出容量，只装 30
    expect(cargoOf(st, 'wine')).toBe(80);
    expect(removeCargo(st, 'wine', 30)).toBe(true);
    expect(cargoOf(st, 'wine')).toBe(50);
    expect(removeCargo(st, 'wine', 999)).toBe(false);
  });
});
