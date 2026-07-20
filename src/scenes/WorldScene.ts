import * as THREE from 'three';
import type { GameScene } from '../core/SceneManager';
import type { Game } from '../core/Game';
import { WorldMap } from '../world/WorldMap';
import { Ocean } from '../world/Ocean';
import { Sky } from '../world/Sky';
import { windAt } from '../world/Wind';
import { createShipMesh } from '../entities/Ship';
import { NPCFleet, spawnNPCFleets } from '../entities/NPCFleet';
import { shipSpeed } from '../systems/Navigation';
import { driftIndices } from '../systems/Economy';
import { deltaX, worldDist, wrapAngle, wrapX, zToLat } from '../world/projection';
import portsData from '../data/ports.json';
import shipsData from '../data/ships.json';

export interface Port {
  id: string;
  name: string;
  region: string;
  x: number;
  z: number;
}

const COMPASS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];

/** 时间流速：1 现实秒 = 0.05 游戏日（1 游戏日 = 20 秒） */
const DAYS_PER_SECOND = 1 / 20;

/** 世界地图航行场景 */
export class WorldScene implements GameScene {
  object = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);

  private world: WorldMap;
  private ocean: Ocean;
  private sky: Sky;
  private ship: THREE.Group;
  private ports: Port[] = [];
  private portMarkers = new Map<string, THREE.Group>();
  private nearPort: Port | null = null;
  private npcs: NPCFleet[] = [];
  private portMap = new Map<string, Port>();
  private nearNPC: NPCFleet | null = null;
  private npcRespawnTimer = 0;
  private zoom = 1;
  private ux: number; // 未包裹的船 x（相机平滑跟随用）
  private time = 0;
  private currentSpeed = 0;
  private starveWarned = false;

  constructor(private game: Game, topo: unknown) {
    this.world = new WorldMap(topo);
    this.object.add(this.world.group);

    this.ocean = new Ocean();
    this.object.add(this.ocean.mesh);

    this.sky = new Sky(this.object);

    this.ship = createShipMesh();
    this.object.add(this.ship);

    // 港口：锚点吸附到水面 + 标记塔
    for (const p of portsData) {
      const snapped = this.world.snapToWater(p.lon, -p.lat);
      const port: Port = { id: p.id, name: p.name, region: p.region, x: wrapX(snapped.x), z: snapped.z };
      this.ports.push(port);
      const marker = createPortMarker();
      marker.position.set(port.x, 0, port.z);
      this.object.add(marker);
      this.portMarkers.set(port.id, marker);
      this.game.hud.ensureLabel(port.id, `⚓ ${port.name}`);
      this.portMap.set(port.id, port);
    }

    // NPC 商队
    this.npcs = spawnNPCFleets(this.world, this.portMap);
    for (const npc of this.npcs) this.object.add(npc.mesh);

    const st = this.game.state;
    this.ux = st.x;
    this.updateCamera(1);
  }

  update(dt: number): void {
    this.time += dt;
    const st = this.game.state;
    const input = this.game.input;

    if (!this.game.uiOpen) {
      // 转向
      const turn = input.axis('ArrowLeft', 'ArrowRight') + input.axis('KeyA', 'KeyD');
      if (turn !== 0) {
        st.heading = wrapAngle(st.heading + turn * 1.5 * dt);
      }
      // 扬帆/收帆
      if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
        st.sailing = !st.sailing;
      }
      // 缩放
      if (input.wheelDelta !== 0) {
        this.zoom = Math.min(2.4, Math.max(0.55, this.zoom * (1 + input.wheelDelta * 0.001)));
      }
      // 舰队总览
      if (input.pressed('KeyF')) {
        this.game.openFleet();
      }
      // 帮助
      if (input.pressed('KeyH')) {
        this.game.showHelp();
      }
    }
    if (this.game.uiOpen && input.pressed('Escape')) {
      this.game.closeBuilding();
    }

    // 航行
    const shipType = shipsData.find((s) => s.id === st.fleet[0].typeId)!;
    const lat = zToLat(st.z);
    const wind = windAt(lat, st.day);
    if (st.sailing && !this.game.uiOpen) {
      const speed = shipSpeed({
        baseSpeed: shipType.baseSpeed,
        heading: st.heading,
        windDir: wind.dir,
        windSpeed: wind.speed,
        crewRatio: st.fleet[0].crew / shipType.crewMin,
        durabilityRatio: st.fleet[0].durability / shipType.durability,
      });
      this.currentSpeed = speed;
      this.moveWithCollision(st, speed * dt);
    } else {
      this.currentSpeed = 0;
    }

    // 时间流逝与补给消耗（1 游戏日 = 20 现实秒，昼夜循环肉眼可辨）
    const gameDays = dt * DAYS_PER_SECOND;
    st.day += gameDays;
    driftIndices(st, gameDays);
    const totalCrew = st.fleet.reduce((s, sh) => s + sh.crew, 0);
    st.food = Math.max(0, st.food - totalCrew * 0.6 * gameDays);
    st.water = Math.max(0, st.water - totalCrew * 0.8 * gameDays);
    if ((st.food <= 0 || st.water <= 0) && !this.starveWarned) {
      this.starveWarned = true;
      this.game.hud.toast('⚠️ 补给耗尽！船员正在挨饿，尽快靠港补给！', 4);
    } else if (st.food > 0 && st.water > 0) {
      this.starveWarned = false;
    }

    // 港口接近检测
    this.nearPort = null;
    for (const p of this.ports) {
      if (worldDist(st.x, st.z, p.x, p.z) < 3) {
        this.nearPort = p;
        break;
      }
    }
    // NPC 商队更新与遭遇检测
    this.nearNPC = null;
    for (const npc of this.npcs) {
      npc.update(dt, this.portMap);
      // 与相机同一未包裹经度，避免环绕时跳变
      npc.mesh.position.x = this.ux + deltaX(this.ux, npc.data.x);
      if (worldDist(st.x, st.z, npc.data.x, npc.data.z) < 4) {
        this.nearNPC = npc;
      }
    }
    // 被消灭的商队过一段时间补充
    if (this.npcs.length < 8) {
      this.npcRespawnTimer -= dt;
      if (this.npcRespawnTimer <= 0) {
        const fresh = spawnNPCFleets(this.world, this.portMap);
        if (fresh.length > 0) {
          this.npcs.push(fresh[0]);
          this.object.add(fresh[0].mesh);
        }
        this.npcRespawnTimer = 90;
      }
    }

    this.game.hud.setHint(
      this.nearPort
        ? `按 E 进入 ${this.nearPort.name}`
        : this.nearNPC
          ? `按 B 袭击 ${this.nearNPC.data.name}`
          : null,
    );
    if (!this.game.uiOpen) {
      if (this.nearPort && input.pressed('KeyE')) {
        this.game.enterPort(this.nearPort);
      } else if (this.nearNPC && input.pressed('KeyB')) {
        this.game.startBattle(this.nearNPC);
      }
    }

    // 船位/姿态（ux 未包裹，避免环绕时相机甩动）
    this.ux += deltaX(this.ux, st.x);
    const bob = Math.sin(this.time * 1.3) * 0.07;
    this.ship.position.set(this.ux, bob, st.z);
    this.ship.rotation.y = Math.atan2(Math.cos(st.heading), Math.sin(st.heading));
    this.ship.rotation.z = Math.sin(this.time * 0.9) * 0.03;

    this.updateCamera(dt);

    // 环境
    const dayFrac = st.day % 1;
    this.sky.update(dayFrac, this.ship.position);
    this.ocean.update(this.time, this.sky.sunDir, this.sky.sunColor, this.sky.ambient);

    // HUD
    const windDeg = ((wind.dir % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const windName = COMPASS[Math.round(windDeg / (Math.PI / 4)) % 8];
    this.game.hud.update(st, dt, {
      speed: this.currentSpeed * 5,
      windDirName: windName,
      windSpeed: wind.speed,
      location: this.nearPort ? `${this.nearPort.name} 近海` : `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(wrapX(st.x)).toFixed(1)}°${wrapX(st.x) >= 0 ? 'E' : 'W'}`,
    });
    this.updatePortLabels();
  }

  /** 船体采样：新中心 + 船头都在水面才可通行（不查船尾，避免贴岸时死锁） */
  private canSail(x: number, z: number, heading: number): boolean {
    if (Math.abs(z) >= 88) return false;
    const bow = 1.2;
    return (
      !this.world.isLand(x, z) &&
      !this.world.isLand(x + Math.cos(heading) * bow, z + Math.sin(heading) * bow)
    );
  }

  private moveWithCollision(st: { x: number; z: number; heading: number }, dist: number): void {
    const dx = Math.cos(st.heading) * dist;
    const dz = Math.sin(st.heading) * dist;
    // 已在陆地中（异常情况）→ 允许任何移动以脱困
    if (this.world.isLand(st.x, st.z)) {
      st.x = wrapX(st.x + dx);
      st.z += dz;
      return;
    }
    if (this.canSail(st.x + dx, st.z + dz, st.heading)) {
      st.x = wrapX(st.x + dx);
      st.z += dz;
    } else if (this.canSail(st.x + dx, st.z, st.heading)) {
      st.x = wrapX(st.x + dx); // 沿 x 滑动
    } else if (this.canSail(st.x, st.z + dz, st.heading)) {
      st.z += dz; // 沿 z 滑动
    }
  }

  private updateCamera(dt: number): void {
    const target = new THREE.Vector3(this.ux, 0, this.game.state.z);
    const offset = new THREE.Vector3(0, 24 * this.zoom, 15 * this.zoom);
    const desired = target.clone().add(offset);
    const t = dt >= 1 ? 1 : 1 - Math.pow(0.001, dt);
    this.camera.position.lerp(desired, t);
    this.camera.lookAt(target);
  }

  private updatePortLabels(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const p of this.ports) {
      const el = this.game.hud.ensureLabel(p.id, `⚓ ${p.name}`);
      const dist = worldDist(this.game.state.x, this.game.state.z, p.x, p.z);
      if (dist > 45) {
        el.style.display = 'none';
        continue;
      }
      // 用与船相同的未包裹 x，保证环绕时标签位置正确
      const px = this.ux + deltaX(this.ux, p.x);
      v.set(px, 1.2, p.z).project(this.camera);
      if (v.z > 1 || v.z < -1) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 海战胜利后移除商队 */
  removeNPC(id: string): void {
    const i = this.npcs.findIndex((n) => n.data.id === id);
    if (i >= 0) {
      this.object.remove(this.npcs[i].mesh);
      this.npcs.splice(i, 1);
      this.npcRespawnTimer = 90;
    }
  }

  /** 读档/新游戏后同步相机与船位 */
  syncToState(): void {
    this.ux = this.game.state.x;
    this.updateCamera(1);
  }

  dispose(): void {
    this.game.hud.setHint(null);
    this.game.hud.setLabelsVisible(false);
  }

  onEnter(): void {
    this.game.hud.setLabelsVisible(true);
  }
}

/** 港口标记：白色灯塔 + 红色顶灯 */
function createPortMarker(): THREE.Group {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }),
  );
  tower.position.y = 0.8;
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.5, 6),
    new THREE.MeshLambertMaterial({ color: 0xc23a2e, emissive: 0x661510 }),
  );
  top.position.y = 1.85;
  g.add(tower, top);
  return g;
}
