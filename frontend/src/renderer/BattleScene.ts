import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import type { Frame } from './types';
import { RobotMesh } from './RobotMesh';
import { MissileMesh } from './MissileMesh';
import { ExplosionFX } from './ExplosionFX';

const ROBOT_COLORS = [0x00ffff, 0xff6600, 0x00ff88, 0xff00ff];

export class BattleScene {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;

  private robots: RobotMesh[] = [];
  private missiles: MissileMesh[] = [];
  private explosions: ExplosionFX[] = [];
  private teamModeActive = false;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080818);

    // Ambient light (minimal, lets emissive materials bloom)
    this.scene.add(new THREE.AmbientLight(0x111111, 2));

    // Camera: orthographic top-down, always square frustum.
    // Canvas is guaranteed square by main.ts, so halfW === halfH always.
    // up=(0,0,-1) avoids the degenerate case of looking straight down with
    // the default up=(0,1,0) which would be antiparallel to the view direction.
    // PAD gives breathing room so the border is never right at the clip edge.
    const PAD = 25;
    const half = 500 + PAD;
    this.camera = new THREE.OrthographicCamera(
      -half, half, half, -half, 0.1, 2000
    );
    this.camera.up.set(0, 0, -1);
    this.camera.position.set(500, 1000, 500);
    this.camera.lookAt(500, 0, 500);

    // Renderer — canvas pixel dimensions are already set by main.ts applySize()
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(1);  // DPR already baked into canvas.width/height
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    // Post-processing: bloom
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(canvas.width, canvas.height),
      1.5,  // strength
      0.4,  // radius
      0.2   // threshold
    );
    this.composer.addPass(this.bloom);

    // Build arena
    this.buildArena();

    // Create robot meshes (4 slots)
    for (let i = 0; i < 4; i++) {
      this.robots.push(new RobotMesh(i, this.scene));
    }

    // Create missile meshes (8 total: 2 per robot)
    for (let i = 0; i < 8; i++) {
      const ownerSlot = Math.floor(i / 2);
      this.missiles.push(new MissileMesh(ownerSlot, this.scene));
    }
  }

  private buildArena(): void {
    // Floor plane at y=0, centered at (500, 0, 500)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({
        color: 0x0a1220,
        roughness: 1,
        metalness: 0,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(500, 0, 500);
    this.scene.add(floor);

    // Grid helper: 20 divisions, subtle cyan
    const grid = new THREE.GridHelper(1000, 20, 0x0a3a5a, 0x0a3a5a);
    grid.position.set(500, 0.1, 500);
    const gridMat = grid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.4;
    this.scene.add(grid);

    // Border glow (LineLoop around arena edges)
    const borderPoints = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1000, 1, 0),
      new THREE.Vector3(1000, 1, 1000),
      new THREE.Vector3(0, 1, 1000),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const border = new THREE.LineLoop(
      borderGeo,
      new THREE.LineBasicMaterial({ color: 0x00ffff })
    );
    this.scene.add(border);
  }

  /** Enable or disable team mode visuals. Auto-detected from frame data on first frame. */
  setTeamMode(enabled: boolean): void {
    this.teamModeActive = enabled;
    for (const robot of this.robots) {
      robot.setTeamMode(enabled);
    }
  }

  /** Apply a single frame of battle data to update all entities. */
  applyFrame(frame: Frame): void {
    // Auto-detect team mode on the first frame: if any robot has team !== 0, it's a team battle
    if (frame.cycle <= 1 && !this.teamModeActive) {
      const hasTeams = frame.robots.some(r => r.team !== 0);
      if (hasTeams) {
        this.setTeamMode(true);
      }
    }

    // Update robots
    for (let i = 0; i < frame.robots.length && i < this.robots.length; i++) {
      this.robots[i].update(frame.robots[i]);
    }

    // Update missiles + detect explosions
    for (let i = 0; i < frame.missiles.length && i < this.missiles.length; i++) {
      const missile = frame.missiles[i];
      const justExploded = this.missiles[i].update(missile);

      if (justExploded) {
        const ownerColor = ROBOT_COLORS[missile.owner] ?? 0xffffff;
        // Engine y → world Z = 1000 - y (match RobotMesh / MissileMesh mapping).
        this.explosions.push(
          new ExplosionFX(missile.x, 1000 - missile.y, ownerColor, this.scene)
        );
      }
    }

    // Tick explosions, remove finished ones
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const done = this.explosions[i].update();
      if (done) {
        this.explosions[i].dispose();
        this.explosions.splice(i, 1);
      }
    }
  }

  /** Render one frame via the bloom composer. */
  render(): void {
    this.composer.render();
  }

  /** Handle canvas / window resize. */
  onResize(): void {
    const canvas = this.renderer.domElement;
    // Canvas is always square; camera frustum is fixed — just sync renderer size.
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.composer.setSize(canvas.width, canvas.height);
    this.bloom.resolution.set(canvas.width, canvas.height);
  }
}
