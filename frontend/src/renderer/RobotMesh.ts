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
  private scanLines: THREE.LineSegments;  // cone beams (center + edges)
  private scanPulse: THREE.Mesh;          // bead traveling outward
  private scanHit: THREE.Mesh;            // flashing ring at detected target
  private teamRing: THREE.Mesh;
  private scanLife = 0;
  private prevScanHeading = -1;
  private prevScanDist = -1;
  private activeScanWorldRad = 0;   // world-space scan direction, kept current
  private activeScanResRad = 0;     // cone half-width in radians
  private activeScanDist = 0;       // detected distance in meters (0 = no hit)
  private static readonly SCAN_LIFE = 6;
  private static readonly BEAM_MAX_DIST = 1500; // larger than arena diagonal

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

    // Scan beam + cone edges (thin lines that fade fast)
    const scanGeo = new THREE.BufferGeometry();
    scanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    this.scanLines = new THREE.LineSegments(
      scanGeo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 })
    );
    this.scanLines.visible = false;
    this.group.add(this.scanLines);

    // Scan pulse: a bead traveling outward along the beam
    this.scanPulse = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: color,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0,
      })
    );
    this.scanPulse.visible = false;
    this.group.add(this.scanPulse);

    // Scan hit marker: flashing ring where a target was detected
    this.scanHit = new THREE.Mesh(
      new THREE.RingGeometry(6, 10, 24),
      new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xff3322,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      })
    );
    this.scanHit.rotation.x = -Math.PI / 2;
    this.scanHit.visible = false;
    this.group.add(this.scanHit);

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
    // Engine (x, y) — y+ is North — maps to Three.js (x, 3, 1000 - y) so
    // engine North appears at the top of the screen under the top-down camera
    // (camera up = -Z, so higher engine y → lower world Z → upper screen).
    this.group.position.set(robot.x, 3, 1000 - robot.y);

    // Heading: 0=East(+X world), 90=North(-Z world) — CCW in engine must also
    // appear CCW on screen. Indicator points local +Z, so rotation.y = heading + 90°.
    this.group.rotation.y = (robot.heading * Math.PI / 180) + Math.PI / 2;

    this.updateHealth(robot.damage);
    this.updateScan(robot.scanHeading, robot.scanRes, robot.scanDist);
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

  private updateScan(scanHeading: number, scanRes: number, scanDist: number): void {
    // A new scan event is detected when the recorded heading or returned
    // distance differs from the previous frame. Same-direction, same-result
    // scans share the visual (not a functional issue — scan is idempotent).
    const isNewScan =
      scanHeading !== this.prevScanHeading ||
      scanDist !== this.prevScanDist;

    if (isNewScan) {
      this.prevScanHeading = scanHeading;
      this.prevScanDist = scanDist;
      // Convert to the same world-space rotation convention as the group
      // (heading+90°), so localRad below cancels to (scanHeading - heading).
      this.activeScanWorldRad = (scanHeading * Math.PI) / 180 + Math.PI / 2;
      this.activeScanResRad = Math.max(0, Math.min(10, scanRes)) * Math.PI / 180;
      this.activeScanDist = scanDist;
      this.scanLife = RobotMesh.SCAN_LIFE;
      this.scanLines.visible = true;
      this.scanPulse.visible = true;
      this.scanHit.visible = scanDist > 0;
    }

    if (this.scanLife <= 0) {
      this.scanLines.visible = false;
      this.scanPulse.visible = false;
      this.scanHit.visible = false;
      return;
    }

    this.scanLife--;
    const life = RobotMesh.SCAN_LIFE;
    const t = Math.max(0, this.scanLife / life);   // 1 at spawn → 0 at expiry
    const age = 1 - t;                              // 0 → 1

    // Compute local direction (compensate for the robot group rotation so the
    // beam stays fixed in world space even if the robot turns mid-decay).
    const localRad = this.activeScanWorldRad - this.group.rotation.y;
    const beamDist =
      this.activeScanDist > 0 ? this.activeScanDist : RobotMesh.BEAM_MAX_DIST;
    const dir = (a: number, d: number): [number, number, number] =>
      [Math.sin(a) * d, 0, Math.cos(a) * d];

    // Beam lines: center ray + two cone edges (only when resolution > 0).
    const lines: number[] = [];
    const [cx, , cz] = dir(localRad, beamDist);
    lines.push(0, 0, 0, cx, 0, cz);
    if (this.activeScanResRad > 0) {
      const [lx, , lz] = dir(localRad - this.activeScanResRad, beamDist);
      const [rx, , rz] = dir(localRad + this.activeScanResRad, beamDist);
      lines.push(0, 0, 0, lx, 0, lz);
      lines.push(0, 0, 0, rx, 0, rz);
    }

    const buf = this.scanLines.geometry.attributes['position'] as
      | THREE.BufferAttribute
      | undefined;
    const needed = lines.length / 3;
    if (buf && buf.count === needed) {
      buf.array.set(lines);
      buf.needsUpdate = true;
    } else {
      this.scanLines.geometry.dispose();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(lines), 3)
      );
      this.scanLines.geometry = geo;
    }
    (this.scanLines.material as THREE.LineBasicMaterial).opacity = 0.75 * t;

    // Pulse bead: travels outward along the beam over the decay window.
    const pulseDist = age * beamDist;
    const [px, , pz] = dir(localRad, pulseDist);
    this.scanPulse.position.set(px, 2, pz);
    (this.scanPulse.material as THREE.MeshStandardMaterial).opacity = t;

    // Hit marker: flash-and-grow at the detected target location.
    if (this.activeScanDist > 0) {
      const [hx, , hz] = dir(localRad, this.activeScanDist);
      this.scanHit.position.set(hx, 0.5, hz);
      const scl = 1 + age * 0.8;
      this.scanHit.scale.set(scl, scl, scl);
      (this.scanHit.material as THREE.MeshStandardMaterial).opacity = t;
    }
  }
}
