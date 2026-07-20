/** 键盘/鼠标输入采集。每帧结束后调用 endFrame() 清除瞬时状态。 */
export class Input {
  private keys = new Set<string>();
  private pressedSet = new Set<string>();
  wheelDelta = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      // 避免在输入框中触发游戏按键
      if (e.target instanceof HTMLInputElement) return;
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressedSet.add(e.code);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('wheel', (e) => (this.wheelDelta += e.deltaY), { passive: true });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** 本帧是否刚按下 */
  pressed(code: string): boolean {
    return this.pressedSet.has(code);
  }

  /** 轴向输入：负方向键 / 正方向键 */
  axis(neg: string, pos: string): number {
    return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0);
  }

  endFrame(): void {
    this.pressedSet.clear();
    this.wheelDelta = 0;
  }
}
