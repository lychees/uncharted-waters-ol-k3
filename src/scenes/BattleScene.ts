import * as THREE from 'three';
import type { GameScene } from '../core/SceneManager';
import type { Game } from '../core/Game';
import type { NPCFleet } from '../entities/NPCFleet';
import { Ocean } from '../world/Ocean';
import { Sky } from '../world/Sky';
import { createShipMesh } from '../entities/Ship';
import {
  ARENA_RADIUS,
  CANNON_RANGE,
  FIRE_COOLDOWN,
  broadsideReady,
  volleyDamage,
} from '../systems/Combat';
import { SHIP_TYPE_MAP } from '../systems/Shipyard';
import { wrapAngle } from '../world/projection';

interface Combatant {
  mesh: THREE.Group;
  name: string;
  x: number;
  z: number;
  heading: number;
  sailing: boolean;
  durability: number;
  maxDurability: number;
  cannons: number;
  cooldown: number;
  speed: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  life: number;
}

interface Splash {
  mesh: THREE.Mesh;
  life: number;
}

export type BattleResult = 'victory' | 'defeat' | 'flee';

/** 海战场景：俯视实时炮战（舷侧齐射自动开火） */
export class BattleScene implements GameScene {
  object = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);

  private sky: Sky;
  private ocean: Ocean;
  private player: Combatant;
  private enemy: Combatant;
  private projectiles: Projectile[] = [];
  private splashes: Splash[] = [];
  private bars: HTMLDivElement;
  private time = 0;
  private over = false;
  private endTimer = 0;
  private result: BattleResult | null = null;

  constructor(
    private game: Game,
    private npc: NPCFleet,
  ) {
    this.sky = new Sky(this.object);
    this.ocean = new Ocean();
    this.object.add(this.ocean.mesh);

    const flag = game.state.fleet[0];
    const flagType = SHIP_TYPE_MAP.get(flag.typeId)!;
    this.player = {
      mesh: createShipMesh(),
      name: flag.name,
      x: -25,
      z: 0,
      heading: 0,
      sailing: true,
      durability: flag.durability,
      maxDurability: flagType.durability,
      cannons: flagType.cannons,
      cooldown: 1.5,
      speed: flagType.baseSpeed * 1.8,
    };
    const enemyType = SHIP_TYPE_MAP.get(npc.data.shipType)!;
    const enemyMesh = createShipMesh(1.1);
    enemyMesh.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
        if (o.material.color.getHex() === 0xf2e8d0) o.material.color.setHex(0xb8a898);
      }
    });
    this.enemy = {
      mesh: enemyMesh,
      name: npc.data.name,
      x: 25,
      z: 0,
      heading: Math.PI,
      sailing: true,
      durability: enemyType.durability,
      maxDurability: enemyType.durability,
      cannons: enemyType.cannons,
      cooldown: 2.5,
      speed: enemyType.baseSpeed * 1.8,
    };
    this.object.add(this.player.mesh, this.enemy.mesh);

    // 耐久条
    this.bars = document.createElement('div');
    this.bars.style.cssText =
      'position:absolute;top:44px;left:50%;transform:translateX(-50%);width:520px;pointer-events:none;font-size:13px';
    document.getElementById('ui-root')!.append(this.bars);

    this.game.hud.toast(`⚔️ 遭遇 ${this.npc.data.name}！舷侧对敌自动开炮，驶离战场边缘可逃脱`, 5);
    this.updateCamera(1);
  }

  update(dt: number): void {
    this.time += dt;
    const input = this.game.input;

    if (!this.over) {
      // 玩家操控
      const turn = input.axis('ArrowLeft', 'ArrowRight') + input.axis('KeyA', 'KeyD');
      this.player.heading = wrapAngle(this.player.heading + turn * 1.3 * dt);
      if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
        this.player.sailing = !this.player.sailing;
      }
      this.moveShip(this.player, dt);
      this.enemyAI(dt);
      this.moveShip(this.enemy, dt);

      // 开火
      this.tryFire(this.player, this.enemy, dt);
      this.tryFire(this.enemy, this.player, dt);

      // 逃脱判定
      if (Math.hypot(this.player.x, this.player.z) > ARENA_RADIUS) {
        this.finish('flee');
      }
      // 击沉判定
      if (this.enemy.durability <= 0) this.finish('victory');
      else if (this.player.durability <= 0) this.finish('defeat');
    } else {
      // 沉没动画
      this.endTimer -= dt;
      const sinking = this.result === 'victory' ? this.enemy : this.result === 'defeat' ? this.player : null;
      if (sinking) {
        sinking.mesh.position.y -= dt * 0.8;
        sinking.mesh.rotation.z += dt * 0.4;
      }
      if (this.endTimer <= 0) {
        this.game.endBattle(this.result!, this.npc);
        return;
      }
    }

    // 炮弹与水花
    for (const p of this.projectiles) {
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.life -= dt;
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.life <= 0) {
        this.object.remove(p.mesh);
        return false;
      }
      return true;
    });
    for (const s of this.splashes) {
      s.life -= dt;
      const t = 1 - s.life / 0.6;
      s.mesh.scale.setScalar(1 + t * 3);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    }
    this.splashes = this.splashes.filter((s) => {
      if (s.life <= 0) {
        this.object.remove(s.mesh);
        return false;
      }
      return true;
    });

    // 姿态
    for (const c of [this.player, this.enemy]) {
      if (c.durability > 0) {
        c.mesh.position.set(c.x, Math.sin(this.time * 1.3 + c.x) * 0.08, c.z);
        c.mesh.rotation.y = Math.atan2(Math.cos(c.heading), Math.sin(c.heading));
      }
    }

    this.updateCamera(dt);
    const dayFrac = this.game.state.day % 1;
    this.sky.update(dayFrac, this.player.mesh.position);
    this.ocean.update(this.time, this.sky.sunDir, this.sky.sunColor, this.sky.ambient);
    this.updateBars();

    this.game.hud.update(this.game.state, dt, {
      speed: this.player.sailing ? this.player.speed * 5 : 0,
      windDirName: '-',
      windSpeed: 0,
      location: '⚔️ 海战中',
    });
  }

  private moveShip(c: Combatant, dt: number): void {
    if (!c.sailing || c.durability <= 0) return;
    c.x += Math.cos(c.heading) * c.speed * dt;
    c.z += Math.sin(c.heading) * c.speed * dt;
    // 敌船不出界
    if (c === this.enemy) {
      const d = Math.hypot(c.x, c.z);
      if (d > ARENA_RADIUS * 0.9) {
        c.x *= (ARENA_RADIUS * 0.9) / d;
        c.z *= (ARENA_RADIUS * 0.9) / d;
        c.heading = wrapAngle(c.heading + Math.PI / 2);
      }
    }
  }

  private enemyAI(dt: number): void {
    const e = this.enemy;
    const p = this.player;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const dist = Math.hypot(dx, dz);
    const angleTo = Math.atan2(dz, dx);
    let desired: number;
    if (dist > 17) desired = angleTo;
    else if (dist < 9) desired = angleTo + Math.PI;
    else desired = angleTo + Math.PI / 2;
    const diff = wrapAngle(desired - e.heading);
    e.heading = wrapAngle(e.heading + Math.max(-1, Math.min(1, diff)) * 1.1 * dt);
  }

  private tryFire(shooter: Combatant, target: Combatant, dt: number): void {
    shooter.cooldown -= dt;
    if (shooter.cooldown > 0 || shooter.durability <= 0 || target.durability <= 0) return;
    const dx = target.x - shooter.x;
    const dz = target.z - shooter.z;
    const dist = Math.hypot(dx, dz);
    if (dist > CANNON_RANGE) return;
    const angleTo = Math.atan2(dz, dx);
    if (!broadsideReady(shooter.heading, angleTo)) return;

    shooter.cooldown = FIRE_COOLDOWN;
    const dmg = volleyDamage(shooter.cannons);
    target.durability = Math.max(0, target.durability - dmg);

    // 视觉：炮弹 + 命中小水花
    const guns = Math.min(5, Math.floor(shooter.cannons / 2));
    for (let i = 0; i < guns; i++) {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0x222222 }),
      );
      const spread = (i / guns - 0.5) * 0.2;
      const a = angleTo + spread;
      ball.position.set(shooter.x, 1, shooter.z);
      this.object.add(ball);
      const speed = 30;
      this.projectiles.push({
        mesh: ball,
        vx: Math.cos(a) * speed,
        vz: Math.sin(a) * speed,
        life: dist / speed,
      });
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.9, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(target.x, 0.15, target.z);
    this.object.add(ring);
    this.splashes.push({ mesh: ring, life: 0.6 });
  }

  private finish(result: BattleResult): void {
    if (this.over) return;
    this.over = true;
    this.result = result;
    this.endTimer = result === 'flee' ? 0.5 : 2.2;
    if (result === 'victory') this.game.hud.toast('🎉 敌船正在沉没！', 2);
    if (result === 'defeat') this.game.hud.toast('💥 旗舰被击沉……', 2);
  }

  private updateBars(): void {
    const bar = (c: Combatant, color: string) => {
      const pct = (c.durability / c.maxDurability) * 100;
      return `<div style="margin:2px 0">${c.name}
        <div style="height:10px;background:#222;border-radius:5px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color}"></div>
        </div></div>`;
    };
    this.bars.innerHTML =
      bar(this.player, '#4a9e4a') + bar(this.enemy, '#c23a2e') +
      `<div style="color:#9aa4b8;margin-top:2px">W 扬帆/停船 ｜ A/D 转向 ｜ 舷侧对敌自动开炮 ｜ 驶离战场逃脱</div>`;
  }

  private updateCamera(dt: number): void {
    const target = new THREE.Vector3(this.player.x, 0, this.player.z);
    const desired = target.clone().add(new THREE.Vector3(0, 34, 22));
    const t = dt >= 1 ? 1 : 1 - Math.pow(0.001, dt);
    this.camera.position.lerp(desired, t);
    this.camera.lookAt(target);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.bars.remove();
    this.game.hud.setHint(null);
    this.game.hud.setLabelsVisible(false);
  }
}
