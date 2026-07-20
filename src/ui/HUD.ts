import { formatDate } from '../core/State';
import type { GameState } from '../core/State';

const COMPASS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];

/** 顶部状态栏 + 左下航行面板 + 中央提示 + 港口标签 + toast */
export class HUD {
  private topLeft: HTMLDivElement;
  private topRight: HTMLDivElement;
  private panel: HTMLDivElement;
  private hint: HTMLDivElement;
  private labelContainer: HTMLDivElement;
  private localLabelContainer: HTMLDivElement;
  private labels = new Map<string, HTMLDivElement>();
  private toastEl: HTMLDivElement | null = null;
  private toastTimer = 0;

  constructor(private root: HTMLElement) {
    const top = document.createElement('div');
    top.className = 'hud-top';
    this.topLeft = document.createElement('div');
    this.topLeft.className = 'hud-group';
    this.topRight = document.createElement('div');
    this.topRight.className = 'hud-group';
    top.append(this.topLeft, this.topRight);

    this.panel = document.createElement('div');
    this.panel.className = 'hud-panel';

    this.hint = document.createElement('div');
    this.hint.className = 'hud-hint';
    this.hint.style.display = 'none';

    this.labelContainer = document.createElement('div');
    this.labelContainer.style.pointerEvents = 'none';

    this.localLabelContainer = document.createElement('div');
    this.localLabelContainer.style.pointerEvents = 'none';

    root.append(top, this.panel, this.hint, this.labelContainer, this.localLabelContainer);
  }

  setHint(text: string | null): void {
    if (text) {
      this.hint.textContent = text;
      this.hint.style.display = '';
    } else {
      this.hint.style.display = 'none';
    }
  }

  toast(text: string, durationSec = 2.5): void {
    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.className = 'toast';
      this.root.append(this.toastEl);
    }
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastTimer = durationSec;
  }

  /** 确保每个 id 有一个标签元素；local=true 放入场景局部容器（不受港口标签显隐控制） */
  ensureLabel(id: string, text: string, local = false): HTMLDivElement {
    let el = this.labels.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hud-label';
      el.textContent = text;
      (local ? this.localLabelContainer : this.labelContainer).append(el);
      this.labels.set(id, el);
    }
    return el;
  }

  hideLabel(id: string): void {
    const el = this.labels.get(id);
    if (el) el.style.display = 'none';
  }

  setLabelsVisible(visible: boolean): void {
    this.labelContainer.style.display = visible ? '' : 'none';
  }

  update(
    state: GameState,
    dt: number,
    info: { speed: number; windDirName: string; windSpeed: number; location: string },
  ): void {
    const crew = state.fleet.reduce((s, sh) => s + sh.crew, 0);
    this.topLeft.innerHTML = `<span>📅 ${formatDate(state.day)}</span><span>💰 ${Math.floor(state.money)} 金币</span><span>👨‍✈️ 船员 ${crew}</span>`;
    this.topRight.innerHTML = `<span>${info.location}</span>`;

    const deg = ((state.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const compass = COMPASS[Math.round(deg / (Math.PI / 4)) % 8];
    this.panel.innerHTML =
      `航速：<b>${info.speed.toFixed(1)}</b> 节<br>` +
      `航向：<b>${compass}</b><br>` +
      `风：${info.windDirName} ${(info.windSpeed * 10).toFixed(0)} 级<br>` +
      `粮食 ${Math.max(0, Math.floor(state.food))} ｜ 淡水 ${Math.max(0, Math.floor(state.water))}`;

    if (this.toastEl && this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
  }
}
