import * as THREE from 'three';

/** 低多边形海面：顶点正弦波动 + 屏幕空间导数求平直法线 */
export class Ocean {
  mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(1200, 280, 360, 84);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x0d3a5c) },
        uShallow: { value: new THREE.Color(0x2a7a9e) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uAmbient: { value: 0.6 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        varying float vWave;
        void main() {
          vec3 p = position;
          float w = sin(p.x * 0.35 + uTime * 1.2) * 0.14
                  + sin(p.z * 0.50 + uTime * 0.9) * 0.12
                  + sin((p.x + p.z) * 0.18 + uTime * 0.6) * 0.10;
          p.y += w;
          vWave = w;
          vPos = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uAmbient;
        varying vec3 vPos;
        varying float vWave;
        void main() {
          vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
          if (n.y < 0.0) n = -n;
          vec3 sunDir = normalize(uSunDir);
          float diff = max(dot(n, sunDir), 0.0);
          float h = smoothstep(-0.30, 0.32, vWave);
          vec3 col = mix(uDeep, uShallow, h);
          col *= uAmbient + (1.0 - uAmbient) * diff * 1.6;
          vec3 viewDir = normalize(cameraPosition - vPos);
          vec3 halfV = normalize(viewDir + sunDir);
          float spec = pow(max(dot(n, halfV), 0.0), 60.0);
          col += uSunColor * spec * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
  }

  update(time: number, sunDir: THREE.Vector3, sunColor: THREE.Color, ambient: number): void {
    this.material.uniforms.uTime.value = time;
    (this.material.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
    (this.material.uniforms.uSunColor.value as THREE.Color).copy(sunColor);
    this.material.uniforms.uAmbient.value = ambient;
  }
}
