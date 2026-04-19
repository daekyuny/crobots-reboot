import type { BattleResult, Frame } from './types'

export interface BattleOutcome {
  frames: Frame[]
  result: BattleResult
}

let worker: Worker | null = null
type Resolve = (value: unknown) => void
type Reject = (reason: unknown) => void
let pendingResolve: Resolve | null = null
let pendingReject: Reject | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./battle-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data
      const resolve = pendingResolve
      const reject = pendingReject
      pendingResolve = null
      pendingReject = null

      if (type === 'compile_result') {
        if (e.data.error) reject?.(new Error(e.data.error))
        else resolve?.(undefined)
      } else if (type === 'complete') {
        resolve?.({ frames: e.data.frames, result: e.data.result })
      } else if (
        type === 'set_team_result' ||
        type === 'set_team_mode_result' ||
        type === 'set_stall_config_result'
      ) {
        resolve?.(undefined)
      } else if (type === 'error') {
        reject?.(new Error(e.data.error))
      }
    }
    worker.onerror = (e) => {
      const reject = pendingReject
      pendingResolve = null
      pendingReject = null
      reject?.(e)
    }
  }
  return worker
}

function send<T>(msg: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pendingResolve = resolve as Resolve
    pendingReject = reject
    getWorker().postMessage(msg)
  })
}

/** Compile a single robot source into the given slot. Throws on compile error. */
export function compileRobot(source: string, slot: number): Promise<void> {
  return send<void>({ type: 'compile', source, slot })
}

/** Assign a robot slot to a team (0 or 1). */
export function setTeam(slot: number, team: number): Promise<void> {
  return send<void>({ type: 'set_team', slot, team })
}

/** Set team mode: 0=FFA, 1=team-safe (no friendly fire), 2=team-competitive. */
export function setTeamMode(mode: number): Promise<void> {
  return send<void>({ type: 'set_team_mode', mode })
}

/** Configure stall detection. Disabled by default; when enabled, the battle ends after
 *  `windowCycles` motion cycles with no damage. */
export function setStallConfig(enabled: boolean, windowCycles: number): Promise<void> {
  return send<void>({ type: 'set_stall_config', enabled, windowCycles })
}

/** Run a battle with already-compiled robots. Returns frames and battle result. */
export function runBattle(numRobots: number): Promise<BattleOutcome> {
  return send<BattleOutcome>({ type: 'run', numRobots })
}
