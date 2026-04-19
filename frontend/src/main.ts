import { BattleScene } from './renderer/BattleScene'
import { UploadPanel, type StallConfig } from './ui/UploadPanel'
import { ControlsPanel } from './ui/ControlsPanel'
import { compileRobot, runBattle, setTeam, setTeamMode, setStallConfig } from './engine/wasm-bridge'
import { END_NORMAL } from './engine/types'

const MIN_CANVAS = 600  // minimum square side in CSS pixels
const APP_GAP = 2       // matches gap + padding in #app CSS (px)

// Setup canvas — always a square
const canvas = document.getElementById('battle-canvas') as HTMLCanvasElement
const wrapper = document.getElementById('canvas-wrapper') as HTMLDivElement
const controlsContainer = document.getElementById('controls-container') as HTMLDivElement

function squareSize(): number {
  // Deduct the controls panel's current rendered height (0 when hidden) so
  // canvas + gap + controls all fit within the viewport together.
  const controlsH = controlsContainer.offsetHeight
  const usedH = controlsH > 0 ? controlsH + APP_GAP * 2 : APP_GAP * 2
  const availH = window.innerHeight - usedH
  return Math.max(Math.min(window.innerWidth, availH), MIN_CANVAS)
}

function applySize(): void {
  const size = squareSize()
  const dpr = Math.min(window.devicePixelRatio, 2)
  canvas.width = Math.round(size * dpr)
  canvas.height = Math.round(size * dpr)
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  wrapper.style.width = size + 'px'
  wrapper.style.height = size + 'px'
  controlsContainer.style.width = size + 'px'
}

applySize()

const scene = new BattleScene(canvas)
const upload = new UploadPanel()
const controls = new ControlsPanel()

// Mount UI
document.getElementById('upload-container')!.appendChild(upload.render())
document.getElementById('controls-container')!.appendChild(controls.render())
// HUD overlay lives inside the canvas wrapper so it's positioned over the battlefield
wrapper.appendChild(controls.getHudOverlay())

// Handle window resize
window.addEventListener('resize', () => {
  applySize()
  scene.onResize()
})

// Wire compile-on-upload
upload.onCompile((source, slot) => compileRobot(source, slot))

// Battle flow — robots are already compiled, just run
let lastNumRobots = 0
let lastNames: string[] = []
let lastTeamMode = 0
let lastTeams: number[] = []
let lastStall: StallConfig = { enabled: false, windowCycles: 10000 }

async function startBattle(
  numRobots: number,
  names: string[],
  teamMode = 0,
  teams: number[] = [],
  stall: StallConfig = { enabled: false, windowCycles: 10000 },
): Promise<void> {
  lastNumRobots = numRobots
  lastNames = names
  lastTeamMode = teamMode
  lastTeams = teams
  lastStall = stall

  // Set team mode and assignments before running
  await setTeamMode(teamMode)
  if (teamMode > 0) {
    for (let i = 0; i < numRobots; i++) {
      await setTeam(i, teams[i] ?? 0)
    }
  }
  await setStallConfig(stall.enabled, stall.windowCycles)

  const { frames, result } = await runBattle(numRobots)
  controls.setFrames(frames, names, result)
  // Controls panel just became visible — re-measure and shrink canvas to fit.
  applySize()
  scene.onResize()
  if (result.endReason === END_NORMAL) {
    controls.play()
  }
}

upload.onBattle(async (numRobots, names, teamMode, teams, stall) => {
  try {
    upload.setStatus('running')
    await startBattle(numRobots, names, teamMode, teams, stall)
    upload.setStatus('done')
  } catch (e) {
    upload.setStatus('error', String(e))
  }
})

controls.onRematch(async () => {
  try {
    await startBattle(lastNumRobots, lastNames, lastTeamMode, lastTeams, lastStall)
  } catch (e) {
    console.error('Rematch failed:', e)
  }
})

controls.onNewRobots(() => {
  upload.show()
})

// Render loop
function animate(): void {
  requestAnimationFrame(animate)
  const frame = controls.tick()
  if (frame) scene.applyFrame(frame)
  scene.render()
}
animate()
