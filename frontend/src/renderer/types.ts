export interface RobotFrame {
  x: number;
  y: number;
  heading: number;
  speed: number;
  damage: number;
  scanHeading: number;
  status: number;
  team: number;
}

export interface MissileFrame {
  x: number;
  y: number;
  heading: number;
  status: number;
  owner: number;
}

export interface Frame {
  cycle: number;
  robots: RobotFrame[];
  missiles: MissileFrame[];
}
