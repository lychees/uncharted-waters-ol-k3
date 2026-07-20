import * as THREE from 'three';
import { Input } from './Input';
import { SceneManager } from './SceneManager';
import { createNewGame, type GameState } from './State';
import { clearSave, hasSave, loadGame, saveGame } from './SaveSystem';
import { HUD } from '../ui/HUD';
import { Modal } from '../ui/Modal';
import { WorldScene, type Port } from '../scenes/WorldScene';
import { PortScene, type BuildingDef } from '../scenes/PortScene';
import { BattleScene, type BattleResult } from '../scenes/BattleScene';
import type { NPCFleet } from '../entities/NPCFleet';
import { GOODS, addCargo, cargoCapacity, cargoTotal } from '../systems/Economy';
import { Cheat } from '../systems/Cheat';
import { createMarketUI } from '../ui/MarketUI';
import { createShipyardUI } from '../ui/ShipyardUI';
import { createTavernUI } from '../ui/TavernUI';
import { createFleetUI } from '../ui/FleetUI';

/** 游戏主控：渲染器、主循环、场景切换 */
export class Game {
  renderer: THREE.WebGLRenderer;
  input = new Input();
  state: GameState;
  scenes: SceneManager;
  hud: HUD;
  modal: Modal;
  uiOpen = false; // 有 UI 面板打开时暂停世界输入

  private clock = new THREE.Clock();
  private worldScene: WorldScene;

  constructor(canvas: HTMLCanvasElement, topo: unknown) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.state = createNewGame();
    this.hud = new HUD(document.getElementById('ui-root')!);
    this.modal = new Modal(document.getElementById('ui-root')!, (v) => (this.uiOpen = v));
    this.scenes = new SceneManager(this.renderer, () => ({
      w: window.innerWidth,
      h: window.innerHeight,
    }));

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.scenes.current?.resize(window.innerWidth, window.innerHeight);
    });

    this.worldScene = new WorldScene(this, topo);
    this.scenes.change(this.worldScene);

    // 秘籍：show me the money
    new Cheat(() => {
      this.state.money += 999999;
      this.hud.toast('💰 秘籍生效：获得 999999 金币！', 4);
    });
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(0.1, this.clock.getDelta());
      this.scenes.update(dt);
      this.input.endFrame();
      this.scenes.render();
    });
    // 每 15 秒自动存档
    setInterval(() => saveGame(this.state), 15000);
  }

  /** 主菜单：继续游戏 / 新游戏 / 操作说明 */
  showMainMenu(): void {
    const content = document.createElement('div');
    content.className = 'menu-list';
    if (hasSave()) {
      const cont = document.createElement('div');
      cont.className = 'menu-item';
      cont.textContent = '⚓ 继续游戏';
      cont.onclick = () => {
        const saved = loadGame();
        if (saved) {
          this.state = saved;
          this.worldScene.syncToState();
          this.hud.toast('已读取存档');
        }
        this.modal.close();
      };
      content.append(cont);
    }
    const fresh = document.createElement('div');
    fresh.className = 'menu-item';
    fresh.textContent = '🌊 新的航程';
    fresh.onclick = () => {
      this.state = createNewGame();
      this.worldScene.syncToState();
      clearSave();
      this.modal.close();
    };
    const help = document.createElement('div');
    help.className = 'menu-item';
    help.textContent = '📖 操作说明';
    help.onclick = () => this.showHelp();
    content.append(fresh, help);
    this.modal.open('大航海时代 II · Three.js 复刻', content);
  }

  /** 操作说明（H 键） */
  showHelp(): void {
    const content = document.createElement('div');
    content.innerHTML = `
      <table class="goods">
        <tbody>
          <tr><td>W / ↑</td><td>扬帆 / 收帆（港口内为移动）</td></tr>
          <tr><td>A、D / ←、→</td><td>转向（港口内为移动）</td></tr>
          <tr><td>E</td><td>进入港口 / 建筑，出港</td></tr>
          <tr><td>B</td><td>袭击附近的 NPC 商队</td></tr>
          <tr><td>F</td><td>舰队总览</td></tr>
          <tr><td>H</td><td>本帮助</td></tr>
          <tr><td>滚轮</td><td>缩放地图</td></tr>
          <tr><td>ESC</td><td>关闭面板</td></tr>
        </tbody>
      </table>
      <p style="margin-top:12px;font-size:13px;color:#9aa4b8">
        目标：低买高卖积累财富，组建舰队。横风航行最快，正逆风几乎无法前进；
        注意粮食与淡水消耗，及时靠港补给。每 15 秒自动存档。
      </p>
    `;
    this.modal.open('操作说明', content);
  }

  /** 进入港口 */
  enterPort(port: Port): void {
    this.state.x = port.x;
    this.state.z = port.z;
    this.state.sailing = false;
    saveGame(this.state);
    this.hud.toast(`⚓ 抵达 ${port.name}`);
    this.scenes.change(new PortScene(this, port));
  }

  /** 出港，回到世界地图 */
  exitPort(): void {
    saveGame(this.state);
    this.hud.toast('扬帆起航！');
    this.scenes.change(this.worldScene);
  }

  /** 打开建筑界面 */
  openBuilding(port: Port, building: BuildingDef): void {
    if (building.id === 'market') {
      this.modal.open(`${port.name} · 市场`, createMarketUI(this, port));
      return;
    }
    if (building.id === 'shipyard') {
      this.modal.open(`${port.name} · 造船厂`, createShipyardUI(this, port));
      return;
    }
    if (building.id === 'tavern') {
      this.modal.open(`${port.name} · 酒馆`, createTavernUI(this, port));
      return;
    }
    const content = document.createElement('div');
    content.innerHTML = `<p>${port.name} · ${building.name}</p><p style="margin-top:10px;color:#9aa4b8">总督正在处理公务，暂无要事。</p>`;
    this.modal.open(building.name, content);
  }

  /** 舰队总览（F 键） */
  openFleet(): void {
    this.modal.open('我的舰队', createFleetUI(this));
  }

  /** 遭遇 NPC 商队，进入海战 */
  startBattle(npc: NPCFleet): void {
    this.state.sailing = false;
    this.scenes.change(new BattleScene(this, npc));
  }

  /** 海战结束结算 */
  endBattle(result: BattleResult, npc: NPCFleet): void {
    const st = this.state;
    if (result === 'victory') {
      // 缴获：金币 + 随机货物
      const loot: string[] = [`${npc.data.gold} 金币`];
      st.money += npc.data.gold;
      const g1 = GOODS[Math.floor(Math.random() * GOODS.length)];
      const qty = 5 + Math.floor(Math.random() * 10);
      const space = cargoCapacity(st) - cargoTotal(st);
      const n = Math.min(qty, space);
      if (n > 0) {
        addCargo(st, g1.id, n);
        loot.push(`${g1.name}×${n}`);
      }
      this.worldScene.removeNPC(npc.data.id);
      this.hud.toast(`🏴‍☠️ 缴获战利品：${loot.join('、')}`, 5);
    } else if (result === 'defeat') {
      const sunk = st.fleet.shift();
      st.x += 2; // 残骸漂离战场
      if (st.fleet.length === 0) {
        const content = document.createElement('div');
        content.innerHTML = `<p>「${sunk?.name}」沉没了，舰队全军覆没……</p>
          <div class="menu-list" style="margin-top:16px"><div class="menu-item" id="restart">重新开始</div></div>`;
        this.modal.open('游戏结束', content);
        content.querySelector('#restart')!.addEventListener('click', () => location.reload());
        return; // 不返回世界地图
      }
      this.hud.toast(`「${sunk?.name}」沉没了！残部转移到「${st.fleet[0].name}」`, 5);
    } else {
      this.hud.toast('脱离了战斗');
    }
    this.scenes.change(this.worldScene);
  }

  closeBuilding(): void {
    this.modal.close();
  }
}
