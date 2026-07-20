import * as THREE from 'three';

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 昼夜循环：太阳/半球光/背景色/星空 */
export class Sky {
  sun = new THREE.DirectionalLight(0xffffff, 1);
  hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.6);
  sunDir = new THREE.Vector3(0, 1, 0);
  sunColor = new THREE.Color(1, 1, 1);
  bg = new THREE.Color(0x87b5e0);
  ambient = 0.6;
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;

  constructor(private scene: THREE.Scene) {
    scene.add(this.sun, this.sun.target, this.hemi);

    // 星空穹顶
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.55 + 0.05;
      const r = 700;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xcdd8ff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);
  }

  /** dayFraction: 一天中的小数部分（0 = 午夜）；focus: 相机注视点（船位） */
  update(dayFraction: number, focus: THREE.Vector3): void {
    const ang = dayFraction * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(ang);
    this.sunDir.set(Math.cos(ang) * 0.85, Math.max(elev, -0.2), 0.4).normalize();
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
    this.sun.target.position.copy(focus);

    const day = smoothstep(-0.06, 0.22, elev);
    this.sun.intensity = 1.15 * day;
    this.hemi.intensity = 0.18 + 0.5 * day;
    this.ambient = 0.42 + 0.3 * day;

    // 背景色：夜晚深蓝 → 黄昏橙 → 白天蓝
    const night = new THREE.Color(0x070d1d);
    const dayC = new THREE.Color(0x87b5e0);
    const duskC = new THREE.Color(0xd97a4a);
    this.bg.copy(night).lerp(dayC, day);
    const dusk = smoothstep(-0.18, 0.0, elev) * (1 - smoothstep(0.0, 0.25, elev));
    this.bg.lerp(duskC, dusk * 0.55);
    this.scene.background = this.bg;

    // 阳光颜色：低角度偏橙
    this.sunColor.setRGB(1, 1, 1).lerp(new THREE.Color(1, 0.55, 0.3), dusk * 0.8);

    this.starMat.opacity = 1 - day;
    this.stars.position.copy(focus);
  }
}
