import * as THREE from 'three';
import type { MissileFrame } from './types';

const ROBOT_COLORS = [0x00ffff, 0xff6600, 0x00ff88, 0xff00ff];

export class MissileMesh {
  readonly group: THREE.Group;
  private sphere: THREE.Mesh;
  private trailLine: THREE.Line;
  private trail: THREE.Vector3[] = [];
  private readonly TRAIL_LENGTH = 8;
  private ownerSlot: number;
  private prevStatus = 0;

  constructor(ownerSlot: number, scene: THREE.Scene) {
    this.ownerSlot = ownerSlot;
    this.group = new THREE.Group();

    const ownerColor = ROBOT_COLORS[ownerSlot] ?? 0xffffff;

    // Projectile sphere: white-hot core with faint owner tint
    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(2, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: 0xffffff,
        emissiveIntensity: 2.0,
        roughness: 0.1,
        metalness: 0.5,
      })
    );
    // Tint toward owner color slightly
    const emissiveColor = new THREE.Color(0xffffff).lerp(
      new THREE.Color(ownerColor),
      0.25
    );
    (this.sphere.material as THREE.MeshStandardMaterial).emissive = emissiveColor;
    this.group.add(this.sphere);

    // Trail line
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.TRAIL_LENGTH * 3), 3)
    );
    this.trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({
        color: ownerColor,
        transparent: true,
        opacity: 0.5,
      })
    );
    this.group.add(this.trailLine);

    this.group.visible = false;
    scene.add(this.group);
  }

  /** Update missile state from frame data. Returns true if missile just started exploding. */
  update(missile: MissileFrame): boolean {
    const justExploded =
      missile.status === 2 && this.prevStatus !== 2;
    this.prevStatus = missile.status;

    if (missile.status === 0) {
      // AVAIL: hide and clear trail
      this.group.visible = false;
      this.trail.length = 0;
      return false;
    }

    this.group.visible = true;

    // Position: crobots (x, y) -> Three.js (x, 2, y)
    this.sphere.position.set(missile.x, 2, missile.y);

    if (missile.status === 1) {
      // FLYING: update trail
      this.trail.push(new THREE.Vector3(missile.x, 2, missile.y));
      if (this.trail.length > this.TRAIL_LENGTH) {
        this.trail.shift();
      }
      this.updateTrailGeometry();
    }

    // When exploding, hide the projectile but keep trail visible briefly
    if (missile.status === 2) {
      this.sphere.visible = false;
    } else {
      this.sphere.visible = true;
    }

    return justExploded;
  }

  private updateTrailGeometry(): void {
    const posAttr = this.trailLine.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Zero out the buffer
    arr.fill(0);

    // Fill with current trail positions
    for (let i = 0; i < this.trail.length; i++) {
      arr[i * 3] = this.trail[i].x;
      arr[i * 3 + 1] = this.trail[i].y;
      arr[i * 3 + 2] = this.trail[i].z;
    }

    posAttr.needsUpdate = true;
    this.trailLine.geometry.setDrawRange(0, this.trail.length);
  }
}
