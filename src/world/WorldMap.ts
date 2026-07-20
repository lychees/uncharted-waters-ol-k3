import * as THREE from 'three';
import earcut from 'earcut';
import { feature } from 'topojson-client';
import { wrapX } from './projection';

const LAND_H = 0.5;
const MASK_W = 1440;
const MASK_H = 720;

type Ring = Array<[number, number]>;
type Polygon = Ring[];

/** 世界地图：TopoJSON → 低多边形陆地网格 + 陆地碰撞掩码 + 树木 */
export class WorldMap {
  group = new THREE.Group();
  private maskData!: Uint8ClampedArray;

  constructor(topo: unknown) {
    const polygons = extractPolygons(topo);
    this.buildLandMesh(polygons);
    this.buildMask(polygons);
    this.buildTrees();
  }

  /** 世界坐标 (x, z) 是否为陆地 */
  isLand(x: number, z: number): boolean {
    const lon = wrapX(x);
    const lat = -z;
    const px = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
    const py = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
    return this.maskData[(py * MASK_W + px) * 4] > 127;
  }

  /** 把可能落在陆地上的锚点螺旋搜索吸附到最近水面 */
  snapToWater(x: number, z: number): { x: number; z: number } {
    if (!this.isLand(x, z)) return { x, z };
    for (let r = 0.4; r < 6; r += 0.4) {
      const steps = Math.ceil(r * 12);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const nx = x + Math.cos(a) * r;
        const nz = z + Math.sin(a) * r;
        if (!this.isLand(nx, nz)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  }

  private buildLandMesh(polygons: Polygon[]): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    for (const poly of polygons) {
      // 过滤南极洲（质心纬度 < -62）
      const centroidLat =
        poly[0].reduce((s, p) => s + p[1], 0) / Math.max(1, poly[0].length);
      if (centroidLat < -62) continue;

      const rings = unwrapPolygon(poly);
      const flat: number[] = [];
      for (const ring of rings) {
        for (const [lon, lat] of ring) flat.push(lon, lat);
      }
      const holeIndices: number[] = [];
      let count = 0;
      for (let i = 1; i < rings.length; i++) {
        count += rings[i - 1].length;
        holeIndices.push(count);
      }
      const tris = earcut(flat, holeIndices.length ? holeIndices : undefined, 2);

      for (let i = 0; i < tris.length; i += 3) {
        const i0 = tris[i] * 2;
        const i1 = tris[i + 1] * 2;
        const i2 = tris[i + 2] * 2;
        const latC = (flat[i0 + 1] + flat[i1 + 1] + flat[i2 + 1]) / 3;
        landColor(color, latC);
        const j = (Math.random() - 0.5) * 0.07;
        positions.push(
          flat[i0], LAND_H, -flat[i0 + 1],
          flat[i1], LAND_H, -flat[i1 + 1],
          flat[i2], LAND_H, -flat[i2 + 1],
        );
        for (let k = 0; k < 3; k++) {
          colors.push(color.r + j, color.g + j, color.b + j);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals(); // 非索引几何 → 平直法线（low-poly 观感）

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const offset of [-360, 0, 360]) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = offset;
      this.group.add(mesh);
    }
  }

  private buildMask(polygons: Polygon[]): void {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_W;
    canvas.height = MASK_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, MASK_W, MASK_H);
    ctx.fillStyle = '#fff';

    for (const offset of [-360, 0, 360]) {
      ctx.save();
      ctx.scale(MASK_W / 360, MASK_H / 180);
      ctx.translate(180 + offset, 90);
      for (const poly of polygons) {
        const path = new Path2D();
        for (const ring of unwrapPolygon(poly)) {
          path.moveTo(ring[0][0], -ring[0][1]);
          for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], -ring[i][1]);
          path.closePath();
        }
        ctx.fill(path, 'evenodd');
      }
      ctx.restore();
    }

    this.maskData = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  }

  private buildTrees(): void {
    const spots: Array<{ x: number; z: number; s: number; r: number }> = [];
    let attempts = 0;
    while (spots.length < 1400 && attempts < 30000) {
      attempts++;
      const lon = Math.random() * 360 - 180;
      const lat = Math.random() * 130 - 62; // -62 ~ 68
      if (Math.abs(lat) > 55 && Math.random() < 0.8) continue; // 寒带稀疏
      if (!this.isLand(lon, -lat)) continue;
      spots.push({ x: lon, z: -lat, s: 0.7 + Math.random() * 0.8, r: Math.random() * Math.PI * 2 });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 0.5, 5);
    const canopyGeo = new THREE.ConeGeometry(0.42, 1.1, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });

    const n = spots.length * 3;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    let idx = 0;
    for (const offset of [-360, 0, 360]) {
      for (const t of spots) {
        q.setFromAxisAngle(up, t.r);
        scl.setScalar(t.s);
        pos.set(t.x + offset, LAND_H + 0.25 * t.s, t.z);
        m.compose(pos, q, scl);
        trunks.setMatrixAt(idx, m);
        pos.y = LAND_H + (0.5 + 0.55) * t.s;
        m.compose(pos, q, scl);
        canopies.setMatrixAt(idx, m);
        idx++;
      }
    }
    this.group.add(trunks, canopies);
  }
}

/** 从 TopoJSON 提取所有多边形（每个多边形 = 环数组，首环为外环） */
function extractPolygons(topo: unknown): Polygon[] {
  const t = topo as { objects: { land: never } };
  const geo = feature(t as never, t.objects.land) as unknown as {
    type: string;
    features: Array<{ geometry: { type: string; coordinates: never } }>;
  };
  const polygons: Polygon[] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') {
      polygons.push(g.coordinates as unknown as Polygon);
    } else if (g.type === 'MultiPolygon') {
      for (const p of g.coordinates as unknown as Polygon[]) polygons.push(p);
    }
  }
  return polygons;
}

/** 展开跨越 ±180° 经线的环，使经度连续（便于三角化；渲染靠 3 份拷贝包裹） */
function unwrapRing(ring: Ring): Ring {
  const out: Ring = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

/**
 * 展开整个多边形（外环 + 孔洞环）。
 * 孔洞环必须按外环的经度范围做 360° 整数倍平移，
 * 否则跨 ±180° 的外环（如欧亚大陆）与未展开的孔洞（如里海）会让 earcut 产生垃圾三角形。
 */
function unwrapPolygon(poly: Polygon): Polygon {
  const outer = unwrapRing(poly[0]);
  if (poly.length === 1) return [outer];
  let min = Infinity;
  let max = -Infinity;
  for (const [lon] of outer) {
    if (lon < min) min = lon;
    if (lon > max) max = lon;
  }
  const center = (min + max) / 2;
  const rings: Polygon = [outer];
  for (let i = 1; i < poly.length; i++) {
    const hole = unwrapRing(poly[i]);
    const hMean = hole.reduce((s, p) => s + p[0], 0) / hole.length;
    const shift = Math.round((center - hMean) / 360) * 360;
    rings.push(hole.map(([lon, lat]) => [lon + shift, lat] as [number, number]));
  }
  return rings;
}

function landColor(color: THREE.Color, lat: number): void {
  const abs = Math.abs(lat);
  if (abs > 58) {
    color.setRGB(0.82, 0.85, 0.88); // 寒带雪原
  } else if (abs > 40) {
    color.setRGB(0.32, 0.48, 0.24); // 温带
  } else if (abs > 23) {
    color.setRGB(0.42, 0.52, 0.24); // 亚热带
  } else {
    color.setRGB(0.3, 0.52, 0.26); // 热带
  }
}
