/** 通用模态面板（DOM）。打开时暂停世界输入。 */
export class Modal {
  private el: HTMLDivElement | null = null;
  private onClose: (() => void) | null = null;

  constructor(
    private root: HTMLElement,
    private setUiOpen: (open: boolean) => void,
  ) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  open(title: string, content: HTMLElement, onClose?: () => void): void {
    this.close();
    this.el = document.createElement('div');
    this.el.className = 'panel';
    const h = document.createElement('h2');
    h.textContent = title;
    const tip = document.createElement('div');
    tip.className = 'close-tip';
    tip.textContent = '按 ESC 关闭';
    this.el.append(h, content, tip);
    this.root.append(this.el);
    this.onClose = onClose ?? null;
    this.setUiOpen(true);
  }

  close(): void {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    this.setUiOpen(false);
    this.onClose?.();
    this.onClose = null;
  }
}
