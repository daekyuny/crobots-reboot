import type { BattleResult, Frame } from '../engine/types'
import { END_STALL, END_CYCLE_LIMIT } from '../engine/types'

const ROBOT_COLORS = ['#00ffff', '#ff6600', '#00ff88', '#ff00ff']
const SPEEDS = [0.5, 1, 2, 4, 8]

export class ControlsPanel {
  private frames: Frame[] = []
  private robotNames: string[] = []
  private frameIndex = 0
  private playing = false
  private speed = 1  // frames to advance per tick
  private accumulator = 0

  private battleResult: BattleResult | null = null
  private rematchCallback: (() => void) | null = null

  private container!: HTMLElement
  private resultBanner!: HTMLElement
  private scrubber!: HTMLInputElement
  private cycleDisplay!: HTMLElement
  private frameDisplay!: HTMLElement
  private playBtn!: HTMLButtonElement
  private rematchBtn!: HTMLButtonElement
  private speedBtns: HTMLButtonElement[] = []
  private hudPanels: {
    nameEl: HTMLElement
    damageBar: HTMLElement
    damageText: HTMLElement
    speedEl: HTMLElement
    headingEl: HTMLElement
    statusEl: HTMLElement
    panel: HTMLElement
  }[] = []

  onRematch(cb: () => void): void {
    this.rematchCallback = cb
  }

  setFrames(frames: Frame[], robotNames: string[], result?: BattleResult): void {
    this.frames = frames
    this.robotNames = robotNames
    this.battleResult = result ?? null
    this.frameIndex = 0
    this.accumulator = 0
    this.scrubber.max = String(Math.max(0, frames.length - 1))
    this.scrubber.value = '0'
    this.container.style.display = 'flex'
    this.rematchBtn.disabled = false
    this.rematchBtn.textContent = 'Rematch'

    // Show result banner for non-normal endings
    this.updateResultBanner()

    // Update HUD panel names and visibility
    for (let i = 0; i < 4; i++) {
      if (i < robotNames.length) {
        this.hudPanels[i].nameEl.textContent = robotNames[i]
        this.hudPanels[i].panel.style.display = 'flex'
      } else {
        this.hudPanels[i].panel.style.display = 'none'
      }
    }

    // Stall / cycle-limit: jump to last frame so the scene stops immediately
    if (result && result.endReason !== 0 && frames.length > 0) {
      this.frameIndex = frames.length - 1
      this.scrubber.value = String(this.frameIndex)
      this.updateHUD(frames[this.frameIndex])
    } else if (frames.length > 0) {
      this.updateHUD(frames[0])
    }
  }

  private updateResultBanner(): void {
    if (!this.resultBanner) return
    const r = this.battleResult
    if (!r || r.endReason === 0) {
      this.resultBanner.style.display = 'none'
      return
    }

    let label: string
    if (r.endReason === END_STALL) {
      label = r.winner >= 0
        ? `STALL — ${this.robotNames[r.winner] ?? `Robot ${r.winner + 1}`} wins (least damage)`
        : 'STALL — Draw (equal damage)'
    } else if (r.endReason === END_CYCLE_LIMIT) {
      label = r.winner >= 0
        ? `TIME LIMIT — ${this.robotNames[r.winner] ?? `Robot ${r.winner + 1}`} wins (least damage)`
        : 'TIME LIMIT — Draw (equal damage)'
    } else {
      this.resultBanner.style.display = 'none'
      return
    }

    this.resultBanner.textContent = label
    this.resultBanner.style.display = 'block'
  }

  play(): void {
    this.playing = true
    this.playBtn.textContent = '\u23F8'  // pause icon
  }

  pause(): void {
    this.playing = false
    this.playBtn.textContent = '\u25B6'  // play icon
  }

  restart(): void {
    this.frameIndex = 0
    this.accumulator = 0
    this.scrubber.value = '0'
    if (this.frames.length > 0) {
      this.updateHUD(this.frames[0])
    }
  }

  tick(): Frame | null {
    if (!this.playing || this.frames.length === 0) {
      // Still return current frame if we have frames (for scrubber seeking)
      if (this.frames.length > 0) {
        return this.frames[this.frameIndex]
      }
      return null
    }

    // At end of battle
    if (this.frameIndex >= this.frames.length - 1) {
      this.pause()
      return this.frames[this.frames.length - 1]
    }

    // Advance by speed factor
    this.accumulator += this.speed
    const step = Math.floor(this.accumulator)
    this.accumulator -= step

    if (step > 0) {
      this.frameIndex = Math.min(this.frameIndex + step, this.frames.length - 1)
      this.scrubber.value = String(this.frameIndex)
    }

    const frame = this.frames[this.frameIndex]
    this.updateHUD(frame)
    return frame
  }

  render(): HTMLElement {
    const style = document.createElement('style')
    style.textContent = `
      .controls-panel {
        display: none;
        flex-direction: column;
        gap: 0;
        font-family: 'Courier New', monospace;
        color: #ccc;
        pointer-events: auto;
      }
      .controls-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: rgba(10, 10, 20, 0.88);
        border-top: 1px solid rgba(100, 100, 140, 0.3);
      }
      .controls-bar button {
        background: rgba(40, 40, 60, 0.8);
        color: #eee;
        border: 1px solid rgba(100, 100, 140, 0.3);
        border-radius: 4px;
        padding: 4px 10px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .controls-bar button:hover {
        background: rgba(60, 60, 90, 0.8);
      }
      .controls-bar button.active {
        background: rgba(0, 255, 136, 0.2);
        border-color: #00ff88;
        color: #00ff88;
      }
      .play-btn {
        font-size: 16px !important;
        width: 36px;
        text-align: center;
      }
      .scrubber {
        flex: 1;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(60, 60, 90, 0.6);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .scrubber::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #00ff88;
        cursor: pointer;
      }
      .scrubber::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #00ff88;
        border: none;
        cursor: pointer;
      }
      .cycle-display, .frame-display {
        font-size: 13px;
        color: #888;
        white-space: nowrap;
        min-width: 80px;
      }
      .speed-group {
        display: flex;
        gap: 4px;
      }
      .speed-btn {
        font-size: 12px !important;
        padding: 2px 8px !important;
      }
      .hud-row {
        display: flex;
        gap: 0;
        background: rgba(10, 10, 20, 0.75);
      }
      .robot-hud {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        border-right: 1px solid rgba(60, 60, 80, 0.4);
      }
      .robot-hud:last-child {
        border-right: none;
      }
      .hud-color {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .hud-name {
        font-size: 13px;
        font-weight: bold;
        min-width: 60px;
      }
      .hud-damage-bar-bg {
        width: 60px;
        height: 7px;
        background: rgba(60, 60, 80, 0.6);
        border-radius: 3px;
        overflow: hidden;
        flex-shrink: 0;
      }
      .hud-damage-bar {
        height: 100%;
        background: #00ff88;
        transition: width 0.1s;
        border-radius: 3px;
      }
      .hud-stat {
        font-size: 12px;
        color: #888;
        white-space: nowrap;
      }
      .hud-status {
        font-size: 11px;
        letter-spacing: 1px;
        font-weight: bold;
      }
      .hud-status.active { color: #00ff88; }
      .hud-status.dead { color: #ff4444; }
      .replay-group {
        display: flex;
        gap: 4px;
      }
      .replay-group button {
        font-size: 10px !important;
        padding: 2px 8px !important;
      }
      .replay-group input[type="file"] {
        display: none;
      }
      .rematch-btn {
        font-size: 11px !important;
        padding: 4px 12px !important;
        background: rgba(0, 150, 255, 0.15) !important;
        border-color: #0096ff !important;
        color: #0096ff !important;
        letter-spacing: 1px;
        font-weight: bold;
      }
      .rematch-btn:hover:not(:disabled) {
        background: rgba(0, 150, 255, 0.3) !important;
      }
      .rematch-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .result-banner {
        display: none;
        padding: 5px 16px;
        background: rgba(255, 160, 0, 0.15);
        border-top: 1px solid rgba(255, 160, 0, 0.4);
        color: #ffa000;
        font-size: 12px;
        letter-spacing: 1px;
        text-align: center;
      }
    `
    document.head.appendChild(style)

    this.container = document.createElement('div')
    this.container.className = 'controls-panel'

    // Result banner (stall / time limit notice)
    this.resultBanner = document.createElement('div')
    this.resultBanner.className = 'result-banner'
    this.container.appendChild(this.resultBanner)

    // HUD row (robot status panels)
    const hudRow = document.createElement('div')
    hudRow.className = 'hud-row'

    for (let i = 0; i < 4; i++) {
      const panel = document.createElement('div')
      panel.className = 'robot-hud'
      panel.style.display = 'none'

      const colorDot = document.createElement('div')
      colorDot.className = 'hud-color'
      colorDot.style.backgroundColor = ROBOT_COLORS[i]
      colorDot.style.boxShadow = `0 0 6px ${ROBOT_COLORS[i]}`
      panel.appendChild(colorDot)

      const nameEl = document.createElement('div')
      nameEl.className = 'hud-name'
      nameEl.style.color = ROBOT_COLORS[i]
      panel.appendChild(nameEl)

      const damageBarBg = document.createElement('div')
      damageBarBg.className = 'hud-damage-bar-bg'
      const damageBar = document.createElement('div')
      damageBar.className = 'hud-damage-bar'
      damageBar.style.width = '100%'
      damageBar.style.background = ROBOT_COLORS[i]
      damageBarBg.appendChild(damageBar)
      panel.appendChild(damageBarBg)

      const damageText = document.createElement('div')
      damageText.className = 'hud-stat'
      damageText.textContent = '0%'
      panel.appendChild(damageText)

      const speedEl = document.createElement('div')
      speedEl.className = 'hud-stat'
      panel.appendChild(speedEl)

      const headingEl = document.createElement('div')
      headingEl.className = 'hud-stat'
      panel.appendChild(headingEl)

      const statusEl = document.createElement('div')
      statusEl.className = 'hud-status active'
      statusEl.textContent = 'ACTIVE'
      panel.appendChild(statusEl)

      hudRow.appendChild(panel)

      this.hudPanels.push({
        nameEl, damageBar, damageText, speedEl, headingEl, statusEl, panel
      })
    }
    this.container.appendChild(hudRow)

    // Controls bar
    const bar = document.createElement('div')
    bar.className = 'controls-bar'

    // Restart button
    const restartBtn = document.createElement('button')
    restartBtn.textContent = '\u23EE'
    restartBtn.title = 'Restart'
    restartBtn.onclick = () => this.restart()
    bar.appendChild(restartBtn)

    // Play/Pause button
    this.playBtn = document.createElement('button')
    this.playBtn.className = 'play-btn'
    this.playBtn.textContent = '\u25B6'
    this.playBtn.onclick = () => {
      if (this.playing) this.pause()
      else this.play()
    }
    bar.appendChild(this.playBtn)

    // Scrubber
    this.scrubber = document.createElement('input')
    this.scrubber.type = 'range'
    this.scrubber.className = 'scrubber'
    this.scrubber.min = '0'
    this.scrubber.max = '0'
    this.scrubber.value = '0'
    this.scrubber.addEventListener('input', () => {
      this.frameIndex = parseInt(this.scrubber.value)
      if (this.frames.length > 0) {
        this.updateHUD(this.frames[this.frameIndex])
      }
    })
    bar.appendChild(this.scrubber)

    // Cycle display
    this.cycleDisplay = document.createElement('div')
    this.cycleDisplay.className = 'cycle-display'
    this.cycleDisplay.textContent = 'Cycle: 0'
    bar.appendChild(this.cycleDisplay)

    // Frame display
    this.frameDisplay = document.createElement('div')
    this.frameDisplay.className = 'frame-display'
    this.frameDisplay.textContent = '0 / 0'
    bar.appendChild(this.frameDisplay)

    // Speed buttons
    const speedGroup = document.createElement('div')
    speedGroup.className = 'speed-group'
    for (const spd of SPEEDS) {
      const btn = document.createElement('button')
      btn.className = 'speed-btn' + (spd === 1 ? ' active' : '')
      btn.textContent = spd + 'x'
      btn.onclick = () => {
        this.speed = spd
        this.speedBtns.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      }
      speedGroup.appendChild(btn)
      this.speedBtns.push(btn)
    }
    bar.appendChild(speedGroup)

    // Replay buttons
    const replayGroup = document.createElement('div')
    replayGroup.className = 'replay-group'

    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save'
    saveBtn.title = 'Save replay (.crbt)'
    saveBtn.onclick = () => this.saveReplay()
    replayGroup.appendChild(saveBtn)

    const loadBtn = document.createElement('button')
    loadBtn.textContent = 'Load'
    loadBtn.title = 'Load replay (.crbt)'
    const loadInput = document.createElement('input')
    loadInput.type = 'file'
    loadInput.accept = '.crbt'
    loadInput.addEventListener('change', () => {
      if (loadInput.files && loadInput.files.length > 0) {
        this.loadReplay(loadInput.files[0])
      }
    })
    loadBtn.onclick = () => loadInput.click()
    replayGroup.appendChild(loadBtn)
    replayGroup.appendChild(loadInput)

    bar.appendChild(replayGroup)

    // Rematch button
    this.rematchBtn = document.createElement('button')
    this.rematchBtn.className = 'rematch-btn'
    this.rematchBtn.textContent = 'Rematch'
    this.rematchBtn.disabled = true
    this.rematchBtn.title = 'Run the same robots again'
    this.rematchBtn.onclick = () => {
      if (this.rematchCallback) {
        this.rematchBtn.disabled = true
        this.rematchBtn.textContent = 'Running...'
        this.rematchCallback()
      }
    }
    bar.appendChild(this.rematchBtn)

    this.container.appendChild(bar)
    return this.container
  }

  private updateHUD(frame: Frame): void {
    this.cycleDisplay.textContent = `Cycle: ${frame.cycle.toLocaleString()}`
    this.frameDisplay.textContent = `${this.frameIndex + 1} / ${this.frames.length}`

    for (let i = 0; i < this.robotNames.length; i++) {
      const r = frame.robots[i]
      if (!r) continue

      const hud = this.hudPanels[i]
      const health = Math.max(0, 100 - r.damage)
      hud.damageBar.style.width = health + '%'
      hud.damageText.textContent = `DMG:${r.damage}%`
      hud.speedEl.textContent = `SPD:${r.speed}`
      hud.headingEl.textContent = `HDG:${r.heading}\u00B0`

      if (r.status === 0) {
        hud.statusEl.textContent = 'DEAD'
        hud.statusEl.className = 'hud-status dead'
      } else {
        hud.statusEl.textContent = 'ACTIVE'
        hud.statusEl.className = 'hud-status active'
      }
    }
  }

  private saveReplay(): void {
    if (this.frames.length === 0) return

    const data = {
      version: 1,
      robots: this.robotNames.map((name, i) => ({
        slot: i,
        name,
        color: ROBOT_COLORS[i],
      })),
      frameCount: this.frames.length,
      frames: this.frames,
    }

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `battle_${Date.now()}.crbt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  private async loadReplay(file: File): Promise<void> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.version || !data.frames || !data.robots) {
        throw new Error('Invalid replay file format')
      }
      const names = data.robots.map((r: { name: string }) => r.name)
      this.setFrames(data.frames, names)
      this.pause()
    } catch (e) {
      console.error('Failed to load replay:', e)
    }
  }
}
