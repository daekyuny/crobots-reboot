import * as THREE from 'three';
import type { RobotFrame } from './types';

const ROBOT_COLORS = [0x00ffff, 0xff6600, 0x00ff88, 0xff00ff];
const TEAM_COLORS = [0x4488ff, 0xff4444];

export class RobotMesh {
  readonly slot: number;
  readonly group: THREE.Group;
  private body: THREE.Mesh;
  private indicator: THREE.Mesh;
  private healthRing: THREE.Line;
  private scanArc: THREE.LineSegments;
  private teamRing: THREE.Mesh;
  private scanArcLife = 0;
  private prevScanHeading = -1;
  private activeScanWorldRad = 0;   // world-space scan direction, kept current
  private static readonly SCAN_LIFE = 20;

  constructor(slot: number, scene: THREE.Scene) {
    this.slot = slot;
    const color = ROBOT_COLORS[slot];
    this.group = new THREE.Group();

    // Hexagonal body (6-sided cylinder)
    this.body = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 10, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: color,
        emissiveIntensity: 0.8,
        roughness: 0.3,
        metalness: 0.7,
      })
    );
    this.group.add(this.body);

    // Direction indicator cone on top
    this.indicator = new THREE.Mesh(
      new THREE.ConeGeometry(3, 8, 4),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5,
      })
    );
    this.indicator.position.y = 7;
    // Cone default points up (+Y). We want it to point along +Z (forward)
    // so rotate -90 degrees around X
    this.indicator.rotation.x = -Math.PI / 2;
    this.group.add(this.indicator);

    // Health ring: arc line around base
    const ringGeo = new THREE.BufferGeometry();
    this.healthRing = new THREE.Line(
      ringGeo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    this.healthRing.position.y = 0.5;
    this.group.add(this.healthRing);

    // Scan arc: fan lines that fade over 5 frames
    const scanGeo = new THREE.BufferGeometry();
    scanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    this.scanArc = new THREE.LineSegments(
      scanGeo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 })
    );
    this.scanArc.visible = false;
    this.group.add(this.scanArc);

    // Team indicator ring: flat disc beneath the robot, hidden by default (FFA mode)
    this.teamRing = new THREE.Mesh(
      new THREE.RingGeometry(12, 14, 32),
      new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: TEAM_COLORS[0],
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      })
    );
    this.teamRing.rotation.x = -Math.PI / 2;
    this.teamRing.position.y = -2.5;
    this.teamRing.visible = false;
    this.group.add(this.teamRing);

    // Initial position off-screen
    this.group.position.set(-100, 3, -100);
    scene.add(this.group);
  }

  /** Update robot state from frame data. */
  update(robot: RobotFrame): void {
    if (robot.status === 0) {
      // DEAD
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    // crobots (x, y) -> Three.js (x, 3, y)
    this.group.position.set(robot.x, 3, robot.y);

    // Heading conversion:
    // crobots: 0=East(+X), 90=North(-Z), CCW from East
    // Three.js Y-rotation: 0=+Z direction, positive = CCW when viewed from above
    // Formula: rotationY = -(heading * PI/180) + PI/2
    this.group.rotation.y = -(robot.heading * Math.PI / 180) + Math.PI / 2;

    this.updateHealth(robot.damage);
    this.updateScanArc(robot.scanHeading);
    this.updateTeamRing(robot.team);
  }

  private _teamMode = false;

  /** Show or hide the team indicator. Called by BattleScene when team mode is detected. */
  setTeamMode(enabled: boolean): void {
    this._teamMode = enabled;
    if (!enabled) {
      this.teamRing.visible = false;
    }
  }

  private updateTeamRing(team: number): void {
    if (!this._teamMode) return;
    this.teamRing.visible = true;
    const teamColor = TEAM_COLORS[team] ?? TEAM_COLORS[0];
    const mat = this.teamRing.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(teamColor);
  }

  private updateHealth(damage: number): void {
    const health = 1 - damage / 100;
    const color =
      damage < 50
        ? ROBOT_COLORS[this.slot]
        : damage < 75
          ? 0xffaa00
          : 0xff2200;

    // Rebuild arc geometry
    const points: THREE.Vector3[] = [];
    const segments = Math.floor(health * 32);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * 14,
          0,
          Math.sin(angle) * 14
        )
      );
    }

    if (points.length >= 2) {
      this.healthRing.geometry.dispose();
      this.healthRing.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }
    (this.healthRing.material as THREE.LineBasicMaterial).color.setHex(color);
  }

  private updateScanArc(scanHeading: number): void {
    // Trigger on heading change (= a scan() call happened this frame)
    if (scanHeading !== this.prevScanHeading) {
      this.prevScanHeading = scanHeading;
      // CROBOTS: 0=East(+X), 90=North(-Z), CCW.
      // Convert to standard math radians for world-space XZ plane.
      this.activeScanWorldRad = -(scanHeading * Math.PI) / 180;
      this.scanArcLife = RobotMesh.SCAN_LIFE;
      this.scanArc.visible = true;
    }

    if (!this.scanArc.visible) return;

    // Fade
    this.scanArcLife--;
    const t = Math.max(0, this.scanArcLife / RobotMesh.SCAN_LIFE);
    ;(this.scanArc.material as THREE.LineBasicMaterial).opacity = 0.7 * t;
    if (this.scanArcLife <= 0) {
      this.scanArc.visible = false;
      return;
    }

    // Rebuild geometry every frame so the arc stays fixed in world space even
    // as the robot group rotates underneath it.
    // scanArc is a child of group (rotation.y changes each frame), so we must
    // subtract the current group rotation to get the correct local direction.
    const localRad = this.activeScanWorldRad - this.group.rotation.y;

    const fanSpread = Math.PI / 8; // ±22.5°
    const reach = 120;
    const lines: number[] = [];

    for (let d = -1; d <= 1; d++) {
      const a = localRad + d * fanSpread;
      lines.push(0, 0, 0);
      lines.push(Math.sin(a) * reach, 0, Math.cos(a) * reach);
    }
    const ARC_SEGS = 8;
    for (let s = 0; s < ARC_SEGS; s++) {
      const a0 = (localRad - fanSpread) + (s / ARC_SEGS) * (2 * fanSpread);
      const a1 = (localRad - fanSpread) + ((s + 1) / ARC_SEGS) * (2 * fanSpread);
      lines.push(Math.sin(a0) * reach, 0, Math.cos(a0) * reach);
      lines.push(Math.sin(a1) * reach, 0, Math.cos(a1) * reach);
    }

    const buf = this.scanArc.geometry.attributes['position'] as THREE.BufferAttribute | undefined
    const needed = lines.length / 3
    if (buf && buf.count === needed) {
      // Reuse existing buffer — avoids geometry disposal every frame
      buf.array.set(lines)
      buf.needsUpdate = true
    } else {
      this.scanArc.geometry.dispose()
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
      this.scanArc.geometry = geo
    }
  }
}
