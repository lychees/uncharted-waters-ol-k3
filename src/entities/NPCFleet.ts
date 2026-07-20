import * as THREE from 'three';
import { createShipMesh } from './Ship';
import type { WorldMap } from '../world/WorldMap';
import type { Port } from '../scenes/WorldScene';
import { deltaX, wrapAngle, wrapX } from '../world/projection';

export interface NPCFleetData {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
  route: string[]; // 港口 id 列表，往返巡航
  routeIndex: number;
  wait: number; // 在港停留剩余秒
  shipType: string;
  gold: number;
}

const NPC_NAMES = ['西班牙商队', '葡萄牙商队', '荷兰商队', '英格兰商队', '威尼斯商队', '阿拉伯商队', '大明商队', '奥斯曼商队'];

/** NPC 商队：在港口间巡航，遇陆地转向避让 */
export class NPCFleet {
  mesh: THREE.Group;
  private sailMat: THREE.MeshLambertMaterial | null = null;

  constructor(
    public data: NPCFleetData,
    private world: WorldMap,
  ) {
    this.mesh = createShipMesh(0.9);
    // 灰色帆以区别于玩家
    this.mesh.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
        if (o.material.color.getHex() === 0xf2e8d0) {
          this.sailMat = o.material;
        }
      }
    });
    this.sailMat?.color.setHex(0xc9c2b2);
    this.mesh.position.set(data.x, 0, data.z);
  }

  update(dt: number, ports: Map<string, Port>): void {
    const d = this.data;
    if (d.wait > 0) {
      d.wait -= dt;
      return;
    }
    const target = ports.get(d.route[d.routeIndex]);
    if (!target) {
      d.routeIndex = 0;
      return;
    }
    const dx = deltaX(d.x, target.x);
    const dz = target.z - d.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.5) {
      d.routeIndex = (d.routeIndex + 1) % d.route.length;
      d.wait = 4 + Math.random() * 8;
      return;
    }
    const desired = Math.atan2(dz, dx);
    // 陆地避让：船头前方 3 单位有陆地则右转
    const probe = 3;
    const px = d.x + Math.cos(d.heading) * probe;
    const pz = d.z + Math.sin(d.heading) * probe;
    if (this.world.isLand(px, pz)) {
      d.heading = wrapAngle(d.heading + 1.4 * dt);
    } else {
      const diff = wrapAngle(desired - d.heading);
      d.heading = wrapAngle(d.heading + Math.max(-1, Math.min(1, diff)) * 0.9 * dt);
    }
    const speed = 1.5;
    const nx = wrapX(d.x + Math.cos(d.heading) * speed * dt);
    const nz = d.z + Math.sin(d.heading) * speed * dt;
    // 船身不下水不上岸：新位置是陆地则只转向不移动
    if (!this.world.isLand(nx, nz)) {
      d.x = nx;
      d.z = nz;
    } else {
      d.heading = wrapAngle(d.heading + 2.0 * dt);
    }

    this.mesh.position.set(d.x, Math.sin(performance.now() * 0.0013 + d.x) * 0.07, d.z);
    this.mesh.rotation.y = Math.atan2(Math.cos(d.heading), Math.sin(d.heading));
  }
}

/** 生成初始 NPC 商队 */
export function spawnNPCFleets(world: WorldMap, ports: Map<string, Port>): NPCFleet[] {
  const routes: string[][] = [
    ['lisbon', 'seville', 'london'],
    ['genoa', 'venice', 'athens'],
    ['calicut', 'goa', 'colombo'],
    ['havana', 'veracruz', 'santoDomingo'],
    ['macau', 'nagasaki', 'manila'],
    ['amsterdam', 'london', 'bordeaux'],
    ['aden', 'hormuz', 'goa'],
    ['rio', 'bahia', 'capeTown'],
  ];
  const types = ['nao', 'carrack', 'caravela', 'nao', 'carrack', 'nao', 'xebec', 'carrack'];
  const fleets: NPCFleet[] = [];
  routes.forEach((route, i) => {
    const start = ports.get(route[0]);
    if (!start) return;
    const data: NPCFleetData = {
      id: `npc${i}`,
      name: NPC_NAMES[i % NPC_NAMES.length],
      x: start.x + 2,
      z: start.z + 2,
      heading: 0,
      route,
      routeIndex: 1,
      wait: Math.random() * 5,
      shipType: types[i % types.length],
      gold: 200 + Math.floor(Math.random() * 600),
    };
    fleets.push(new NPCFleet(data, world));
  });
  return fleets;
}
