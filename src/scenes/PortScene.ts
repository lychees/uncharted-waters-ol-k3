import * as THREE from 'three';
import type { GameScene } from '../core/SceneManager';
import type { Game } from '../core/Game';
import type { Port } from './WorldScene';
import { Sky } from '../world/Sky';
import { Ocean } from '../world/Ocean';
import { createCharacter } from '../entities/Character';
import { driftIndices } from '../systems/Economy';

export interface BuildingDef {
  id: string;
  name: string;
  x: number;
  z: number;
  r: number; // 碰撞半径
  door: { x: number; z: number };
}

interface Npc {
  mesh: THREE.Group;
  target: THREE.Vector3 | null;
  idle: number;
}

const BUILDINGS: Array<Omit<BuildingDef, 'door'>> = [
  { id: 'market', name: '市场', x: -14, z: -8, r: 4.2 },
  { id: 'shipyard', name: '造船厂', x: 16, z: -2, r: 4.6 },
  { id: 'tavern', name: '酒馆', x: -16, z: 6, r: 3.6 },
  { id: 'governor', name: '总督府', x: 2, z: -19, r: 4.4 },
];

/** 港口场景：低多边形小镇，下船行走、进建筑、回船出港 */
export class PortScene implements GameScene {
  object = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

  private sky: Sky;
  private ocean: Ocean;
  private player: THREE.Group;
  private npcs: Npc[] = [];
  private buildings: BuildingDef[] = [];
  private time = 0;
  private nearBuilding: BuildingDef | null = null;
  private nearDockExit = false;

  constructor(
    private game: Game,
    private port: Port,
  ) {
    this.sky = new Sky(this.object);

    // 海面（南岸）
    this.ocean = new Ocean();
    this.ocean.mesh.position.set(0, 0, 150);
    this.object.add(this.ocean.mesh);

    this.buildTown();

    // 玩家
    this.player = createCharacter(0x2e5a8a, 0xd9b23a);
    this.player.position.set(0, 0, 2);
    this.object.add(this.player);

    // NPC
    for (let i = 0; i < 7; i++) {
      const mesh = createCharacter(
        [0x6a4a8a, 0x4a7a3a, 0x8a6a3a, 0x7a3a4a][i % 4],
        [0x3a3a3a, 0x6a2a2a, 0x2a4a6a][i % 3],
      );
      mesh.position.set(Math.random() * 36 - 18, 0, Math.random() * 22 - 16);
      this.object.add(mesh);
      this.npcs.push({ mesh, target: null, idle: Math.random() * 3 });
    }

    this.game.hud.setLabelsVisible(false);
    this.updateCamera(1);
  }

  private buildTown(): void {
    // 草地
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 130),
      new THREE.MeshLambertMaterial({ color: 0x4a7a3a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -30);
    this.object.add(ground);

    // 沙滩
    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9c48a }),
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, -0.01, 7);
    this.object.add(beach);

    // 石板广场
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshLambertMaterial({ color: 0x9a9a92 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0, -4);
    this.object.add(plaza);

    // 码头（木栈道伸入海中）
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 16), woodMat);
    dock.position.set(0, 0.2, 16);
    this.object.add(dock);
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 5), woodMat);
        post.position.set(side * 2, 0.2, 10 + i * 3);
        this.object.add(post);
      }
    }

    // 功能建筑
    const styles: Record<string, { w: number; h: number; d: number; wall: number; roof: number }> = {
      market: { w: 7, h: 3.4, d: 5.5, wall: 0xc9b68a, roof: 0x8a3a2e },
      shipyard: { w: 8, h: 3.8, d: 6, wall: 0xa89a7a, roof: 0x5a4a3a },
      tavern: { w: 6, h: 3, d: 5, wall: 0xb89a6a, roof: 0x6a4a8a },
      governor: { w: 8, h: 4.5, d: 6.5, wall: 0xe0d8c8, roof: 0x2e5a8a },
    };
    for (const b of BUILDINGS) {
      const s = styles[b.id];
      const mesh = createBuilding(s.w, s.h, s.d, s.wall, s.roof);
      mesh.position.set(b.x, 0, b.z);
      this.object.add(mesh);
      // 门朝广场方向
      const dir = new THREE.Vector2(-b.x, -4 - b.z).normalize();
      const door = { x: b.x + dir.x * (b.r * 0.75), z: b.z + dir.y * (b.r * 0.75) };
      this.buildings.push({ ...b, door });
      this.game.hud.ensureLabel(`b-${b.id}`, b.name, true);
    }

    // 造船厂旁放个船体
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 0.7, 6, 6, 1),
      new THREE.MeshLambertMaterial({ color: 0x7a4f26 }),
    );
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.position.set(22, 0.8, 3);
    this.object.add(hull);

    // 民居（装饰）
    const rng = mulberry32(hashCode(this.port.id));
    for (let i = 0; i < 8; i++) {
      const w = 3 + rng() * 2;
      const h = 2.2 + rng() * 1.2;
      const d = 3 + rng() * 2;
      const house = createBuilding(w, h, d, 0xc0a880, [0x8a3a2e, 0x5a6a3a, 0x6a5a3a][i % 3]);
      const x = -28 + rng() * 56;
      const z = -24 + rng() * 26;
      // 避开广场与功能建筑
      if (Math.hypot(x, z + 4) < 11) continue;
      if (BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 3)) continue;
      house.position.set(x, 0, z);
      house.rotation.y = rng() * Math.PI * 2;
      this.object.add(house);
      this.buildings.push({ id: `house${i}`, name: '民居', x, z, r: Math.max(w, d) / 2 + 0.4, door: { x, z } });
    }

    // 树
    for (let i = 0; i < 12; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5),
        new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
      );
      trunk.position.y = 0.45;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 1.8, 6),
        new THREE.MeshLambertMaterial({ color: 0x2d5a27 }),
      );
      crown.position.y = 1.8;
      tree.add(trunk, crown);
      const x = -34 + rng() * 68;
      const z = -28 + rng() * 34;
      if (Math.hypot(x, z + 4) < 11) continue;
      if (BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 2)) continue;
      tree.position.set(x, 0, z);
      this.object.add(tree);
    }
  }

  update(dt: number): void {
    this.time += dt;
    const input = this.game.input;
    const st = this.game.state;

    // 时间流逝（港口内同样流逝）
    const gameDays = dt / 20;
    st.day += gameDays;
    driftIndices(st, gameDays);

    if (!this.game.uiOpen) {
      // 移动（相机固定朝向，屏幕方向即世界方向）
      const mx = input.axis('ArrowLeft', 'ArrowRight') + input.axis('KeyA', 'KeyD');
      const mz = input.axis('ArrowUp', 'ArrowDown') + input.axis('KeyW', 'KeyS');
      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz) || 1;
        const speed = 7;
        const p = this.player.position;
        p.x += (mx / len) * speed * dt;
        p.z += (mz / len) * speed * dt;
        this.player.rotation.y = Math.atan2(mx, mz);
        this.collide(p);
      }
      // 交互
      if (this.nearBuilding && input.pressed('KeyE')) {
        this.game.openBuilding(this.port, this.nearBuilding);
      }
      if (this.nearDockExit && input.pressed('KeyE')) {
        this.game.exitPort();
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

    // 交互检测
    const p = this.player.position;
    this.nearBuilding = null;
    for (const b of this.buildings) {
      if (b.id.startsWith('house')) continue;
      if (Math.hypot(p.x - b.door.x, p.z - b.door.z) < 3.4) {
        this.nearBuilding = b;
        break;
      }
    }
    this.nearDockExit = p.z > 17 && Math.abs(p.x) < 3;
    this.game.hud.setHint(
      this.nearBuilding
        ? `按 E 进入 ${this.nearBuilding.name}`
        : this.nearDockExit
          ? '按 E 扬帆出港'
          : null,
    );

    // NPC 漫步
    for (const npc of this.npcs) {
      if (npc.idle > 0) {
        npc.idle -= dt;
        continue;
      }
      if (!npc.target) {
        npc.target = new THREE.Vector3(Math.random() * 40 - 20, 0, Math.random() * 24 - 18);
      }
      const dir = npc.target.clone().sub(npc.mesh.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist < 0.5) {
        npc.target = null;
        npc.idle = 1 + Math.random() * 4;
      } else {
        dir.normalize();
        npc.mesh.position.addScaledVector(dir, 2.2 * dt);
        npc.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }

    this.updateCamera(dt);

    const dayFrac = st.day % 1;
    this.sky.update(dayFrac, this.player.position);
    this.ocean.update(this.time, this.sky.sunDir, this.sky.sunColor, this.sky.ambient);

    this.game.hud.update(st, dt, {
      speed: 0,
      windDirName: '-',
      windSpeed: 0,
      location: `${this.port.name}（${this.port.region}）`,
    });
    this.updateBuildingLabels();
  }

  /** 边界与建筑碰撞 */
  private collide(p: THREE.Vector3): void {
    // 水面：只允许在码头上走远
    const onDock = Math.abs(p.x) < 2.1 && p.z > 8;
    if (p.z > 9.2 && !onDock) p.z = 9.2;
    if (onDock) p.z = Math.min(p.z, 22.5);
    p.x = Math.max(-38, Math.min(38, p.x));
    p.z = Math.max(-30, p.z);
    // 建筑圆形碰撞
    for (const b of this.buildings) {
      const dx = p.x - b.x;
      const dz = p.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r && d > 0.001) {
        p.x = b.x + (dx / d) * b.r;
        p.z = b.z + (dz / d) * b.r;
      }
    }
  }

  private updateCamera(dt: number): void {
    const target = this.player.position.clone();
    const desired = target.clone().add(new THREE.Vector3(0, 18, 12));
    const t = dt >= 1 ? 1 : 1 - Math.pow(0.001, dt);
    this.camera.position.lerp(desired, t);
    this.camera.lookAt(target);
  }

  private updateBuildingLabels(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const b of this.buildings) {
      if (b.id.startsWith('house')) continue;
      const el = this.game.hud.ensureLabel(`b-${b.id}`, b.name, true);
      v.set(b.x, 5.2, b.z).project(this.camera);
      if (v.z > 1) {
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

  dispose(): void {
    this.game.hud.setHint(null);
    this.game.hud.setLabelsVisible(true);
    for (const b of this.buildings) {
      this.game.hud.hideLabel(`b-${b.id}`);
    }
  }
}

/** 低多边形建筑：墙体 + 四棱锥屋顶 + 门 */
function createBuilding(
  w: number,
  h: number,
  d: number,
  wallColor: number,
  roofColor: number,
): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: wallColor }),
  );
  wall.position.y = h / 2;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, h * 0.7, 4),
    new THREE.MeshLambertMaterial({ color: roofColor }),
  );
  roof.position.y = h + h * 0.35;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.6, 0.15),
    new THREE.MeshLambertMaterial({ color: 0x4a2e18 }),
  );
  door.position.set(0, 0.8, d / 2 + 0.06);
  g.add(wall, roof, door);
  return g;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
