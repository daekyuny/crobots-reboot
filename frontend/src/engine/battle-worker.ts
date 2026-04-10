/// <reference lib="WebWorker" />
/// <reference types="vite/client" />

declare const self: DedicatedWorkerGlobalScope

interface RobotFrame {
  x: number; y: number; heading: number; speed: number;
  damage: number; scanHeading: number; status: number;
}

interface MissileFrame {
  x: number; y: number; heading: number; status: number; owner: number;
}

interface Frame {
  cycle: number;
  robots: RobotFrame[];
  missiles: MissileFrame[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let Module: any = null

async function loadEngine(): Promise<void> {
  const base = import.meta.env.BASE_URL
  const src = await fetch(base + 'engine.js').then(r => r.text())
  ;(0, eval)(src)
  Module = await (self as any)['CrobotsEngine']({
    locateFile: (path: string) => base + path,
  })
}

function readCString(mod: any, ptr: number): string {
  let end = ptr
  while (mod.HEAPU8[end] !== 0) end++
  return new TextDecoder().decode(mod.HEAPU8.subarray(ptr, end))
}

function compileSlot(source: string, slot: number): string | null {
  const encoded = new TextEncoder().encode(source + '\0')
  const ptr = Module._malloc(encoded.length)
  Module.HEAPU8.set(encoded, ptr)
  const result = Module._compile_robot(ptr, slot)
  Module._free(ptr)
  if (result !== 0) {
    const errPtr = Module._get_compile_error()
    return readCString(Module, errPtr) || `Compilation failed (slot ${slot})`
  }
  return null
}

function parseFrames(mod: any, count: number, ptr: number, frameSize: number): Frame[] {
  const frames: Frame[] = []
  const heap = mod.HEAP32

  for (let i = 0; i < count; i++) {
    const base = (ptr + i * frameSize) >> 2

    const cycle = heap[base + 0]

    const robots: RobotFrame[] = []
    for (let r = 0; r < 4; r++) {
      const rb = base + 1 + r * 7
      robots.push({
        x:           heap[rb + 0],
        y:           heap[rb + 1],
        heading:     heap[rb + 2],
        speed:       heap[rb + 3],
        damage:      heap[rb + 4],
        scanHeading: heap[rb + 5],
        status:      heap[rb + 6],
      })
    }

    const missiles: MissileFrame[] = []
    for (let m = 0; m < 8; m++) {
      const mb = base + 29 + m * 5
      missiles.push({
        x:       heap[mb + 0],
        y:       heap[mb + 1],
        heading: heap[mb + 2],
        status:  heap[mb + 3],
        owner:   heap[mb + 4],
      })
    }

    frames.push({ cycle, robots, missiles })
  }

  return frames
}

self.onmessage = async (e: MessageEvent) => {
  const { type } = e.data

  try {
    if (!Module) await loadEngine()

    if (type === 'compile') {
      const { source, slot } = e.data
      const error = compileSlot(source, slot)
      if (error) {
        self.postMessage({ type: 'compile_result', slot, error })
      } else {
        self.postMessage({ type: 'compile_result', slot, error: null })
      }

    } else if (type === 'run') {
      const { numRobots } = e.data
      Module._run_battle(numRobots)

      const count: number = Module._get_frame_count()
      const ptr: number = Module._get_frame_buffer()
      const size: number = Module._get_frame_size()
      const frames = parseFrames(Module, count, ptr, size)

      const result = {
        endReason: Module._get_end_reason(),
        winner:    Module._get_winner(),
      }

      self.postMessage({ type: 'complete', frames, result })
    }

  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) })
  }
}

export {}
