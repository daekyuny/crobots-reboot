import type { Frame } from './types'

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
        resolve?.(e.data.frames)
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

/** Run a battle with already-compiled robots. Returns replay frames. */
export function runBattle(numRobots: number): Promise<Frame[]> {
  return send<Frame[]>({ type: 'run', numRobots })
}
