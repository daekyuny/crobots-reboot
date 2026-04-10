export const END_NORMAL      = 0
export const END_STALL       = 1
export const END_CYCLE_LIMIT = 2

export interface BattleResult {
  endReason: number   /* END_NORMAL | END_STALL | END_CYCLE_LIMIT */
  winner: number      /* robot index (0-3), or -1 for draw */
  isTeam: boolean     /* true if battle used team mode */
}

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
