import * as THREE from 'three';

/** 程序化低多边形帆船（船头朝 +z） */
export function createShipMesh(scale = 1): THREE.Group {
  const g = new THREE.Group();

  // 船体：俯视轮廓挤出
  const outline = new THREE.Shape();
  outline.moveTo(0, 1.75);
  outline.lineTo(0.42, 1.0);
  outline.lineTo(0.55, -0.5);
  outline.lineTo(0.42, -1.5);
  outline.lineTo(-0.42, -1.5);
  outline.lineTo(-0.55, -0.5);
  outline.lineTo(-0.42, 1.0);
  outline.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.55, bevelEnabled: false });
  hullGeo.rotateX(Math.PI / 2); // shape 的 y 轴 → 世界 +z（船头），挤出方向 → 向下
  hullGeo.translate(0, 0.65, 0);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0x7a4f26 });
  g.add(new THREE.Mesh(hullGeo, hullMat));

  // 甲板
  const deckGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.08, bevelEnabled: false });
  deckGeo.rotateX(Math.PI / 2);
  deckGeo.scale(0.88, 1, 0.94);
  deckGeo.translate(0, 0.73, -0.03);
  const deckMat = new THREE.MeshLambertMaterial({ color: 0xc9a86a });
  g.add(new THREE.Mesh(deckGeo, deckMat));

  // 船尾楼
  const sternGeo = new THREE.BoxGeometry(0.7, 0.4, 0.6);
  const stern = new THREE.Mesh(sternGeo, hullMat);
  stern.position.set(0, 0.93, -1.1);
  g.add(stern);

  const woodMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1c });
  const sailMat = new THREE.MeshLambertMaterial({
    color: 0xf2e8d0,
    side: THREE.DoubleSide,
  });

  // 主桅 + 主帆
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.5, 6), woodMat);
  mast.position.set(0, 1.9, 0.15);
  g.add(mast);
  g.add(createSail(1.7, 1.4, sailMat, 0, 2.1, 0.18));

  // 前桅 + 小帆
  const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.8, 6), woodMat);
  foreMast.position.set(0, 1.6, 1.0);
  g.add(foreMast);
  g.add(createSail(1.1, 0.95, sailMat, 0, 1.75, 1.02));

  // 斜桅
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 5), woodMat);
  bowsprit.rotation.x = Math.PI / 3.2;
  bowsprit.position.set(0, 0.85, 1.95);
  g.add(bowsprit);

  // 旗帜
  const flagGeo = new THREE.PlaneGeometry(0.4, 0.22);
  flagGeo.translate(0.2, 0, 0);
  const flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshLambertMaterial({ color: 0xc23a2e, side: THREE.DoubleSide }),
  );
  flag.position.set(0, 3.1, 0.15);
  g.add(flag);

  g.scale.setScalar(scale);
  return g;
}

function createSail(
  w: number,
  h: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 6, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w + 0.5;
    pos.setZ(i, Math.sin(u * Math.PI) * 0.28);
  }
  geo.computeVertexNormals();
  const sail = new THREE.Mesh(geo, mat);
  sail.position.set(x, y, z);
  return sail;
}
