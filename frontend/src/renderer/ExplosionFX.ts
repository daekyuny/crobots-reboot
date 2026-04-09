import * as THREE from 'three';

export class ExplosionFX {
  private ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private particleVelocities: Float32Array;
  private age = 0;
  private readonly DURATION = 30;
  private scene: THREE.Scene;

  constructor(x: number, y: number, color: number, scene: THREE.Scene) {
    this.scene = scene;

    // Shock ring: expands outward
    const ringGeo = new THREE.RingGeometry(1, 3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.position.set(x, 0.5, y);
    this.ring.rotation.x = -Math.PI / 2;
    scene.add(this.ring);

    // Particle burst: 14 points flying outward
    const count = 14;
    const positions = new Float32Array(count * 3);
    this.particleVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      positions[i * 3] = x + Math.cos(angle) * 2;
      positions[i * 3 + 1] = 1;
      positions[i * 3 + 2] = y + Math.sin(angle) * 2;

      // Velocity: outward from center
      this.particleVelocities[i * 3] = Math.cos(angle) * 1.5;
      this.particleVelocities[i * 3 + 1] = 0;
      this.particleVelocities[i * 3 + 2] = Math.sin(angle) * 1.5;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color,
      size: 3,
      transparent: true,
      opacity: 1.0,
    });

    this.particles = new THREE.Points(particleGeo, particleMat);
    scene.add(this.particles);
  }

  /** Advance animation. Returns true when complete (can be removed). */
  update(): boolean {
    this.age++;
    const progress = this.age / this.DURATION;

    // Expand shock ring from radius ~2 to ~40
    const scale = 1 + progress * 13; // starts at ~3 outer radius, ends at ~40
    this.ring.scale.set(scale, scale, scale);
    this.ring.material.opacity = 1 - progress;

    // Move particles outward
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    for (let i = 0; i < positions.length; i++) {
      positions[i] += this.particleVelocities[i];
    }
    posAttr.needsUpdate = true;
    this.particles.material.opacity = 1 - progress;

    return this.age >= this.DURATION;
  }

  /** Remove from scene and dispose GPU resources. */
  dispose(): void {
    this.scene.remove(this.ring);
    this.scene.remove(this.particles);
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.particles.geometry.dispose();
    this.particles.material.dispose();
  }
}
