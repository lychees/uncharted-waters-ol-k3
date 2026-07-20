import { describe, expect, it } from 'vitest';
import { broadsideReady, volleyDamage } from '../src/systems/Combat';

describe('Combat', () => {
  it('舷侧对敌才能开火', () => {
    // 目标在正横（90°）→ 可以
    expect(broadsideReady(0, Math.PI / 2)).toBe(true);
    // 目标在正前方 → 不行
    expect(broadsideReady(0, 0)).toBe(false);
    // 目标在正后方 → 不行
    expect(broadsideReady(0, Math.PI)).toBe(false);
    // 另一侧舷 → 可以
    expect(broadsideReady(0, -Math.PI / 2)).toBe(true);
  });

  it('齐射伤害在合理区间', () => {
    for (let i = 0; i < 50; i++) {
      const dmg = volleyDamage(20); // 20 门炮 → 10 门开火，每门 1~3
      expect(dmg).toBeGreaterThanOrEqual(10);
      expect(dmg).toBeLessThanOrEqual(30);
    }
    expect(volleyDamage(0)).toBe(0);
  });
});
