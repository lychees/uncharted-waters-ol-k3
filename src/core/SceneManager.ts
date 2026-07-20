import * as THREE from 'three';

/** 场景接口：每个场景持有独立的 THREE.Scene 与相机 */
export interface GameScene {
  object: THREE.Scene;
  camera: THREE.Camera;
  update(dt: number): void;
  resize(w: number, h: number): void;
  dispose(): void;
  /** 切换为该场景时调用（构造或复用都会触发） */
  onEnter?(): void;
}

export class SceneManager {
  current: GameScene | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private getSize: () => { w: number; h: number },
  ) {}

  change(scene: GameScene): void {
    this.current?.dispose();
    this.current = scene;
    const { w, h } = this.getSize();
    scene.resize(w, h);
    scene.onEnter?.();
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  render(): void {
    if (this.current) {
      this.renderer.render(this.current.object, this.current.camera);
    }
  }
}
