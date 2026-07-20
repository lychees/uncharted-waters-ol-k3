import { describe, expect, it } from 'vitest';
import { sailingFactor, shipSpeed } from '../src/systems/Navigation';
import { windAt } from '../src/world/Wind';
import { dateOf } from '../src/core/State';

describe('sailingFactor', () => {
  it('横风最快', () => {
    const beam = sailingFactor(Math.PI / 2, 0);
    const run = sailingFactor(0, 0);
    const irons = sailingFactor(Math.PI, 0);
    expect(beam).toBeGreaterThan(run);
    expect(run).toBeGreaterThan(irons);
    expect(irons).toBeLessThanOrEqual(0.15);
  });

  it('左右对称', () => {
    expect(sailingFactor(1, 0)).toBeCloseTo(sailingFactor(-1, 0), 10);
  });
});

describe('shipSpeed', () => {
  it('船员不足与耐久低会减速', () => {
    const base = {
      baseSpeed: 2,
      heading: Math.PI / 2,
      windDir: 0,
      windSpeed: 1,
      crewRatio: 1,
      durabilityRatio: 1,
    };
    const full = shipSpeed(base);
    const weak = shipSpeed({ ...base, crewRatio: 0.3, durabilityRatio: 0.2 });
    expect(full).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThan(0);
  });
});

describe('windAt', () => {
  it('风力在合理范围内', () => {
    for (const lat of [-50, -25, -5, 0, 15, 35, 60]) {
      const w = windAt(lat, 100);
      expect(w.speed).toBeGreaterThanOrEqual(0.1);
      expect(w.speed).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('dateOf', () => {
  it('从 1522-01-01 起算', () => {
    expect(dateOf(0)).toEqual({ year: 1522, month: 1, day: 1 });
    expect(dateOf(31)).toEqual({ year: 1522, month: 2, day: 1 });
    expect(dateOf(365)).toEqual({ year: 1523, month: 1, day: 1 });
  });
});
