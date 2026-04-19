import type { BattleResult, Frame } from '../engine/types'
import { END_STALL, END_CYCLE_LIMIT } from '../engine/types'

const ROBOT_COLORS = ['#00ffff', '#ff6600', '#00ff88', '#ff00ff']
const SPEEDS = [0.5, 1, 2, 4, 8]

export class ControlsPanel {
  private frames: Frame[] = []
  private robotNames: string[] = []
  private frameIndex = 0
  private playing = false
  private speed = 0.5  // frames to advance per tick
  private accumulator = 0

  private battleResult: BattleResult | null = null
  private rematchCallback: (() => void) | null = null
  private newRobotsCallback: (() => void) | null = null

  private container!: HTMLElement
  private resultBanner!: HTMLElement
  private scrubber!: HTMLInputElement
  private cycleDisplay!: HTMLElement
  private frameDisplay!: HTMLElement
  private playBtn!: HTMLButtonElement
  private rematchBtn!: HTMLButtonElement
  private newRobotsBtn!: HTMLButtonElement
  private endGameBtn!: HTMLButtonElement
  private speedBtns: HTMLButtonElement[] = []
  private hudContainer!: HTMLElement
  private hudPanels: {
    nameEl: HTMLElement
    damageBar: HTMLElement
    damageText: HTMLElement
    statusEl: HTMLElement
    panel: HTMLElement
  }[] = []
  private isTeamMode = false

  /** Returns the HUD overlay element to be mounted inside the canvas wrapper */
  getHudOverlay(): HTMLElement {
    return this.hudContainer
  }

  onRematch(cb: () => void): void {
    this.rematchCallback = cb
  }

  onNewRobots(cb: () => void): void {
    this.newRobotsCallback = cb
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
    this.endGameBtn.disabled = false

    // Detect team mode from result
    this.isTeamMode = !!(result && result.isTeam)

    // Hide result banner until playback reaches the end
    this.resultBanner.style.display = 'none'

    // Update HUD panel names and visibility
    for (let i = 0; i < 4; i++) {
      if (i < robotNames.length) {
        const teamSuffix = this.isTeamMode
          ? ` (${frames.length > 0 && frames[0].robots[i] ? (frames[0].robots[i].team === 0 ? 'A' : 'B') : 'A'})`
          : ''
        this.hudPanels[i].nameEl.textContent = robotNames[i] + teamSuffix
        this.hudPanels[i].panel.style.display = 'flex'
      } else {
        this.hudPanels[i].panel.style.display = 'none'
      }
    }

    // Show HUD overlay
    this.hudContainer.style.display = 'flex'

    // Stall / cycle-limit: jump to last frame so the scene stops immediately
    if (result && result.endReason !== 0 && frames.length > 0) {
      this.frameIndex = frames.length - 1
      this.scrubber.value = String(this.frameIndex)
      this.updateHUD(frames[this.frameIndex])
      this.updateResultBanner()
    } else if (frames.length > 0) {
      this.updateHUD(frames[0])
    }
  }

  private updateResultBanner(): void {
    if (!this.resultBanner) return
    const r = this.battleResult
    if (!r) {
      this.resultBanner.style.display = 'none'
      return
    }
    // For normal (endReason=0) FFA wins, no banner needed (last-standing is obvious)
    // For normal team wins, show the winning team
    if (r.endReason === 0 && !r.isTeam) {
      this.resultBanner.style.display = 'none'
      return
    }
    if (r.endReason === 0 && r.isTeam) {
      const teamName = r.winner === 0 ? 'Team A' : r.winner === 1 ? 'Team B' : 'Nobody'
      this.resultBanner.textContent = r.winner >= 0 ? `${teamName} wins!` : 'Draw!'
      this.resultBanner.style.display = 'block'
      return
    }

    const teamLabel = (winner: number): string => {
      if (!r.isTeam) return this.robotNames[winner] ?? `Robot ${winner + 1}`
      // In team mode, winner is team index (0=A, 1=B)
      return winner === 0 ? 'Team A' : 'Team B'
    }
    const suffix = r.isTeam ? '' : ' (least damage)'

    let label: string
    if (r.endReason === END_STALL) {
      label = r.winner >= 0
        ? `STALL — ${teamLabel(r.winner)} wins${suffix}`
        : 'STALL — Draw (equal damage)'
    } else if (r.endReason === END_CYCLE_LIMIT) {
      label = r.winner >= 0
        ? `TIME LIMIT — ${teamLabel(r.winner)} wins${suffix}`
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
    this.resultBanner.style.display = 'none'
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
      this.updateResultBanner()
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

  /** Manually declare a stall at the current replay position. Recomputes the
   *  winner from the current frame's damage, truncates playback, shows banner. */
  private endGameAtCurrentFrame(): void {
    if (this.frames.length === 0) return
    const idx = this.frameIndex
    const frame = this.frames[idx]

    // Truncate effective playback to [0..idx]
    this.frames = this.frames.slice(0, idx + 1)
    this.scrubber.max = String(this.frames.length - 1)

    // Recompute winner at this moment using the same rule as an engine stall:
    // least damage wins; team mode totals per team.
    const live = frame.robots
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => i < this.robotNames.length && r.status !== 0)

    let winner = -1
    if (this.isTeamMode) {
      const totals: Record<number, number> = { 0: 0, 1: 0 }
      const alive: Record<number, number> = { 0: 0, 1: 0 }
      for (const { r } of live) {
        totals[r.team] = (totals[r.team] ?? 0) + r.damage
        alive[r.team] = (alive[r.team] ?? 0) + 1
      }
      if (alive[0] && !alive[1]) winner = 0
      else if (alive[1] && !alive[0]) winner = 1
      else if (totals[0] < totals[1]) winner = 0
      else if (totals[1] < totals[0]) winner = 1
      else winner = -1
    } else if (live.length > 0) {
      let min = Infinity
      let ties = 0
      for (const { r, i } of live) {
        if (r.damage < min) { min = r.damage; winner = i; ties = 1 }
        else if (r.damage === min) { ties++ }
      }
      if (ties > 1) winner = -1
    }

    this.battleResult = {
      endReason: END_STALL,
      winner,
      isTeam: this.isTeamMode,
    }

    this.pause()
    this.endGameBtn.disabled = true
    this.rematchBtn.disabled = false
    this.rematchBtn.textContent = 'Rematch'
    this.updateResultBanner()
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
      .frame-display {
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
      .hud-overlay {
        display: none;
        flex-direction: column;
        gap: 14px;
        position: fixed;
        top: 12px;
        right: 28px;
        width: 150px;
        z-index: 20;
        pointer-events: none;
      }
      .hud-cycle {
        margin-top: 4px;
        padding: 6px 10px;
        background: rgba(10, 10, 20, 0.8);
        border: 1px solid rgba(60, 60, 80, 0.4);
        border-radius: 4px;
        font-size: 11px;
        color: #aaa;
        letter-spacing: 1px;
      }
      .hud-cycle .label {
        color: #666;
        margin-right: 6px;
      }
      .hud-cycle .value {
        color: #eee;
        font-weight: bold;
      }
      .hud-end-btn {
        margin-top: 6px;
        padding: 6px 10px;
        background: rgba(140, 40, 40, 0.18);
        color: #ff8080;
        border: 1px solid rgba(255, 80, 80, 0.4);
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        font-weight: bold;
        letter-spacing: 1px;
        cursor: pointer;
        pointer-events: auto;
        transition: background 0.15s;
      }
      .hud-end-btn:hover:not(:disabled) {
        background: rgba(200, 60, 60, 0.35);
      }
      .hud-end-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .robot-hud {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        padding: 6px 10px;
        background: rgba(10, 10, 20, 0.8);
        border: 1px solid rgba(60, 60, 80, 0.4);
        border-radius: 4px;
      }
      .hud-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }
      .hud-color {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .hud-name {
        font-size: 12px;
        font-weight: bold;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hud-status-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }
      .hud-damage-bar-bg {
        flex: 1;
        height: 5px;
        background: rgba(60, 60, 80, 0.6);
        border-radius: 3px;
        overflow: hidden;
      }
      .hud-damage-bar {
        height: 100%;
        background: #00ff88;
        transition: width 0.1s;
        border-radius: 3px;
      }
      .hud-stat {
        font-size: 10px;
        color: #aaa;
        white-space: nowrap;
        min-width: 32px;
        text-align: right;
      }
      .hud-status {
        font-size: 10px;
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
      .new-robots-btn {
        font-size: 11px !important;
        padding: 4px 12px !important;
        background: rgba(200, 120, 0, 0.15) !important;
        border-color: #c87800 !important;
        color: #ffa040 !important;
        letter-spacing: 1px;
        font-weight: bold;
      }
      .new-robots-btn:hover:not(:disabled) {
        background: rgba(200, 120, 0, 0.3) !important;
      }
      .new-robots-btn:disabled {
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

    // HUD overlay (positioned on the canvas by main.ts)
    this.hudContainer = document.createElement('div')
    this.hudContainer.className = 'hud-overlay'

    for (let i = 0; i < 4; i++) {
      const panel = document.createElement('div')
      panel.className = 'robot-hud'
      panel.style.display = 'none'

      // Top row: color dot + name
      const nameRow = document.createElement('div')
      nameRow.className = 'hud-name-row'

      const colorDot = document.createElement('div')
      colorDot.className = 'hud-color'
      colorDot.style.backgroundColor = ROBOT_COLORS[i]
      colorDot.style.boxShadow = `0 0 6px ${ROBOT_COLORS[i]}`
      nameRow.appendChild(colorDot)

      const nameEl = document.createElement('div')
      nameEl.className = 'hud-name'
      nameEl.style.color = ROBOT_COLORS[i]
      nameRow.appendChild(nameEl)

      panel.appendChild(nameRow)

      // Bottom row: damage bar + %, then status
      const statusRow = document.createElement('div')
      statusRow.className = 'hud-status-row'

      const damageBarBg = document.createElement('div')
      damageBarBg.className = 'hud-damage-bar-bg'
      const damageBar = document.createElement('div')
      damageBar.className = 'hud-damage-bar'
      damageBar.style.width = '100%'
      damageBar.style.background = ROBOT_COLORS[i]
      damageBarBg.appendChild(damageBar)
      statusRow.appendChild(damageBarBg)

      const damageText = document.createElement('div')
      damageText.className = 'hud-stat'
      damageText.textContent = '0%'
      statusRow.appendChild(damageText)

      const statusEl = document.createElement('div')
      statusEl.className = 'hud-status active'
      statusEl.textContent = 'ACTIVE'
      statusRow.appendChild(statusEl)

      panel.appendChild(statusRow)

      this.hudContainer.appendChild(panel)

      this.hudPanels.push({
        nameEl, damageBar, damageText, statusEl, panel
      })
    }

    // Cycle readout below the robot cards
    this.cycleDisplay = document.createElement('div')
    this.cycleDisplay.className = 'hud-cycle'
    this.cycleDisplay.innerHTML = '<span class="label">CYCLE</span><span class="value">0</span>'
    this.hudContainer.appendChild(this.cycleDisplay)

    // End-game button — manually declare a stall at the current replay position
    this.endGameBtn = document.createElement('button')
    this.endGameBtn.className = 'hud-end-btn'
    this.endGameBtn.textContent = 'End Game'
    this.endGameBtn.title = 'Declare a stall at the current frame'
    this.endGameBtn.onclick = () => this.endGameAtCurrentFrame()
    this.hudContainer.appendChild(this.endGameBtn)

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
        // Show/hide result banner based on scrubber position
        if (this.frameIndex >= this.frames.length - 1) {
          this.updateResultBanner()
        } else {
          this.resultBanner.style.display = 'none'
        }
      }
    })
    bar.appendChild(this.scrubber)

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
      btn.className = 'speed-btn' + (spd === 0.5 ? ' active' : '')
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

    // New Robots button — reopens the upload panel to pick different robots
    this.newRobotsBtn = document.createElement('button')
    this.newRobotsBtn.className = 'new-robots-btn'
    this.newRobotsBtn.textContent = 'New Game'
    this.newRobotsBtn.title = 'Configure a new match with different robots'
    this.newRobotsBtn.onclick = () => {
      this.newRobotsCallback?.()
    }
    bar.appendChild(this.newRobotsBtn)

    this.container.appendChild(bar)
    return this.container
  }

  private updateHUD(frame: Frame): void {
    const cycleValue = this.cycleDisplay.querySelector('.value')
    if (cycleValue) cycleValue.textContent = frame.cycle.toLocaleString()
    this.frameDisplay.textContent = `${this.frameIndex + 1} / ${this.frames.length}`

    for (let i = 0; i < this.robotNames.length; i++) {
      const r = frame.robots[i]
      if (!r) continue

      const hud = this.hudPanels[i]
      const health = Math.max(0, 100 - r.damage)
      hud.damageBar.style.width = health + '%'
      hud.damageText.textContent = `${r.damage}%`

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
      version: 2,
      robots: this.robotNames.map((name, i) => ({
        slot: i,
        name,
        color: ROBOT_COLORS[i],
      })),
      result: this.battleResult,
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
      this.setFrames(data.frames, names, data.result ?? undefined)
      this.pause()
    } catch (e) {
      console.error('Failed to load replay:', e)
    }
  }
}
