import * as THREE from 'three';

/** 低多边形小人（港口玩家/NPC） */
export function createCharacter(bodyColor = 0x3a5c8a, hatColor = 0x8a3a2e): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.28, 0.72, 6),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.56;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0xe8c39a }),
  );
  head.position.y = 1.12;
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.24, 6),
    new THREE.MeshLambertMaterial({ color: hatColor }),
  );
  hat.position.y = 1.32;
  g.add(body, head, hat);
  return g;
}
