/** 秘籍系统：监听键盘输入序列，命中秘籍短语时触发回调 */
export class Cheat {
  private buffer = '';

  constructor(onMoneyCheat: () => void) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key.length !== 1) return; // 只关心可打印字符
      this.buffer = (this.buffer + e.key.toLowerCase()).slice(-64);
      if (this.buffer.endsWith('show me the money')) {
        this.buffer = '';
        onMoneyCheat();
      }
    });
  }
}
