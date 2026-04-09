const SLOT_COLORS = ['#00ffff', '#ff6600', '#00ff88', '#ff00ff']
const SLOT_LABELS = ['CYAN', 'ORANGE', 'GREEN', 'MAGENTA']

type SlotStatus = 'idle' | 'compiling' | 'ready' | 'error'

interface Slot {
  source: string | null
  name: string | null
  status: SlotStatus
  error: string | null
}

type BattleCallback = (numRobots: number, names: string[]) => void
type CompileCallback = (source: string, slot: number) => Promise<void>

export class UploadPanel {
  private slots: Slot[] = [
    { source: null, name: null, status: 'idle', error: null },
    { source: null, name: null, status: 'idle', error: null },
    { source: null, name: null, status: 'idle', error: null },
    { source: null, name: null, status: 'idle', error: null },
  ]
  private activeCount = 2
  private battleCallback: BattleCallback | null = null
  private compileCallback: CompileCallback | null = null
  private errorModal!: HTMLElement
  private errorModalTitle!: HTMLElement
  private errorModalBody!: HTMLElement
  private battleButton!: HTMLButtonElement
  private container!: HTMLElement
  private slotElements: HTMLElement[] = []
  private countBtns: HTMLButtonElement[] = []
  private statusText!: HTMLElement

  onBattle(cb: BattleCallback): void {
    this.battleCallback = cb
  }

  onCompile(cb: CompileCallback): void {
    this.compileCallback = cb
  }

  setStatus(status: 'running' | 'done' | 'error', message?: string): void {
    if (status === 'running') {
      this.battleButton.disabled = true
      this.battleButton.textContent = 'Running...'
      this.statusText.textContent = 'Battle in progress...'
      this.statusText.style.color = '#ffcc00'
    } else if (status === 'done') {
      this.battleButton.disabled = false
      this.battleButton.textContent = 'Battle!'
      this.statusText.textContent = ''
      // Hide upload panel after battle completes
      this.container.classList.add('minimized')
    } else if (status === 'error') {
      this.battleButton.disabled = false
      this.battleButton.textContent = 'Battle!'
      this.statusText.textContent = message || 'Error'
      this.statusText.style.color = '#ff4444'
    }
  }

  render(): HTMLElement {
    // Inject styles
    const style = document.createElement('style')
    style.textContent = `
      .upload-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 24px;
        background: rgba(10, 10, 20, 0.92);
        border: 1px solid rgba(100, 100, 140, 0.3);
        border-radius: 12px;
        min-width: 420px;
        font-family: 'Courier New', monospace;
        color: #ccc;
        transition: opacity 0.3s;
      }
      .upload-panel.minimized {
        opacity: 0;
        pointer-events: none;
      }
      .upload-panel h2 {
        margin: 0 0 4px 0;
        font-size: 18px;
        color: #eee;
        letter-spacing: 2px;
      }
      .upload-slots {
        display: flex;
        gap: 16px;
      }
      .upload-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 16px;
        border: 2px dashed rgba(100, 100, 140, 0.4);
        border-radius: 8px;
        width: 180px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        position: relative;
      }
      .upload-slot:hover {
        border-color: rgba(150, 150, 200, 0.6);
        background: rgba(40, 40, 60, 0.5);
      }
      .upload-slot.has-file {
        border-style: solid;
      }
      .upload-slot.dragover {
        border-color: #00ff88;
        background: rgba(0, 255, 136, 0.08);
      }
      .slot-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        box-shadow: 0 0 8px currentColor;
      }
      .slot-label {
        font-size: 11px;
        letter-spacing: 1px;
        opacity: 0.7;
      }
      .slot-filename {
        font-size: 13px;
        color: #eee;
        word-break: break-all;
        text-align: center;
        min-height: 20px;
      }
      .slot-status {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .slot-status.idle { color: #666; }
      .slot-status.compiling { color: #ffcc00; }
      .slot-status.ready { color: #00ff88; }
      .slot-status.error { color: #ff4444; }
      .slot-drop-text {
        font-size: 11px;
        opacity: 0.5;
      }
      .battle-btn {
        padding: 10px 32px;
        font-size: 14px;
        font-family: 'Courier New', monospace;
        font-weight: bold;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #111;
        background: linear-gradient(180deg, #00ff88, #00cc66);
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
      }
      .battle-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        transform: none;
      }
      .battle-btn:not(:disabled):hover {
        opacity: 0.9;
        transform: scale(1.02);
      }
      .status-text {
        font-size: 11px;
        min-height: 16px;
      }
      .robot-count-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #888;
      }
      .count-btn {
        background: rgba(40, 40, 60, 0.8);
        color: #aaa;
        border: 1px solid rgba(100, 100, 140, 0.3);
        border-radius: 4px;
        padding: 3px 12px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .count-btn:hover {
        background: rgba(60, 60, 90, 0.8);
      }
      .count-btn.active {
        background: rgba(0, 255, 136, 0.15);
        border-color: #00ff88;
        color: #00ff88;
      }
      .upload-slot.hidden {
        display: none;
      }
      .upload-slot input[type="file"] {
        display: none;
      }
      /* Error popup modal */
      .compile-error-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 1000;
        align-items: center;
        justify-content: center;
      }
      .compile-error-overlay.visible {
        display: flex;
      }
      .compile-error-modal {
        background: #0d0d1f;
        border: 1px solid #ff4444;
        border-radius: 10px;
        padding: 0;
        min-width: 480px;
        max-width: 680px;
        width: 90%;
        box-shadow: 0 0 40px rgba(255, 68, 68, 0.3);
        font-family: 'Courier New', monospace;
        overflow: hidden;
      }
      .compile-error-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px;
        background: rgba(255, 68, 68, 0.12);
        border-bottom: 1px solid rgba(255, 68, 68, 0.3);
      }
      .compile-error-title {
        font-size: 14px;
        font-weight: bold;
        color: #ff6666;
        letter-spacing: 1px;
      }
      .compile-error-close {
        background: none;
        border: 1px solid rgba(255, 68, 68, 0.4);
        border-radius: 4px;
        color: #ff6666;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 3px 10px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .compile-error-close:hover {
        background: rgba(255, 68, 68, 0.2);
      }
      .compile-error-body {
        padding: 16px 20px;
        font-size: 13px;
        color: #ffaaaa;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 400px;
        overflow-y: auto;
        line-height: 1.7;
      }
    `
    document.head.appendChild(style)

    // Build error modal (appended to document.body so it overlays everything)
    this.errorModal = document.createElement('div')
    this.errorModal.className = 'compile-error-overlay'

    const modal = document.createElement('div')
    modal.className = 'compile-error-modal'

    const header = document.createElement('div')
    header.className = 'compile-error-header'

    this.errorModalTitle = document.createElement('div')
    this.errorModalTitle.className = 'compile-error-title'
    header.appendChild(this.errorModalTitle)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'compile-error-close'
    closeBtn.textContent = '✕  CLOSE'
    closeBtn.onclick = () => this.hideErrorModal()
    header.appendChild(closeBtn)

    this.errorModalBody = document.createElement('div')
    this.errorModalBody.className = 'compile-error-body'

    modal.appendChild(header)
    modal.appendChild(this.errorModalBody)
    this.errorModal.appendChild(modal)

    // Close on backdrop click
    this.errorModal.addEventListener('click', (e) => {
      if (e.target === this.errorModal) this.hideErrorModal()
    })

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideErrorModal()
    })

    document.body.appendChild(this.errorModal)

    this.container = document.createElement('div')
    this.container.className = 'upload-panel'

    const title = document.createElement('h2')
    title.textContent = 'CROBOTS'
    this.container.appendChild(title)

    // Robot count selector
    const countRow = document.createElement('div')
    countRow.className = 'robot-count-row'
    const countLabel = document.createElement('span')
    countLabel.textContent = 'Robots:'
    countRow.appendChild(countLabel)

    for (const n of [2, 3, 4]) {
      const btn = document.createElement('button')
      btn.className = 'count-btn' + (n === 2 ? ' active' : '')
      btn.textContent = String(n)
      btn.onclick = () => this.setActiveCount(n)
      countRow.appendChild(btn)
      this.countBtns.push(btn)
    }
    this.container.appendChild(countRow)

    const slotsRow = document.createElement('div')
    slotsRow.className = 'upload-slots'

    for (let i = 0; i < 4; i++) {
      const slotEl = this.createSlot(i)
      this.slotElements.push(slotEl)
      if (i >= 2) slotEl.classList.add('hidden')
      slotsRow.appendChild(slotEl)
    }
    this.container.appendChild(slotsRow)

    this.battleButton = document.createElement('button')
    this.battleButton.className = 'battle-btn'
    this.battleButton.textContent = 'Battle!'
    this.battleButton.disabled = true
    this.battleButton.onclick = () => {
      const names = this.slots.slice(0, this.activeCount).map(s => s.name!)
      this.battleCallback?.(this.activeCount, names)
    }
    this.container.appendChild(this.battleButton)

    this.statusText = document.createElement('div')
    this.statusText.className = 'status-text'
    this.container.appendChild(this.statusText)

    return this.container
  }

  /** Show the upload panel again (e.g. for running another battle). */
  show(): void {
    this.container.classList.remove('minimized')
  }

  private createSlot(index: number): HTMLElement {
    const slot = document.createElement('div')
    slot.className = 'upload-slot'

    // Color indicator
    const colorDot = document.createElement('div')
    colorDot.className = 'slot-color'
    colorDot.style.color = SLOT_COLORS[index]
    colorDot.style.backgroundColor = SLOT_COLORS[index]
    slot.appendChild(colorDot)

    // Label
    const label = document.createElement('div')
    label.className = 'slot-label'
    label.textContent = SLOT_LABELS[index]
    slot.appendChild(label)

    // Filename
    const filename = document.createElement('div')
    filename.className = 'slot-filename'
    slot.appendChild(filename)

    // Drop text
    const dropText = document.createElement('div')
    dropText.className = 'slot-drop-text'
    dropText.textContent = 'Drop .r / .c file or click'
    slot.appendChild(dropText)

    // Status badge
    const statusBadge = document.createElement('div')
    statusBadge.className = 'slot-status idle'
    statusBadge.textContent = 'idle'
    slot.appendChild(statusBadge)

    // Hidden file input
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.r,.c,.txt'
    slot.appendChild(fileInput)

    // Click: re-show error popup if slot has an error, otherwise open file dialog
    slot.addEventListener('click', () => {
      const s = this.slots[index]
      if (s.status === 'error' && s.error && s.name) {
        this.showErrorModal(s.name, s.error)
      } else {
        fileInput.click()
      }
    })

    // File input change handler
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.handleFile(index, fileInput.files[0], filename, dropText, statusBadge)
      }
    })

    // Drag-drop handlers
    slot.addEventListener('dragover', (e) => {
      e.preventDefault()
      slot.classList.add('dragover')
    })
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('dragover')
    })
    slot.addEventListener('drop', (e) => {
      e.preventDefault()
      slot.classList.remove('dragover')
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        this.handleFile(index, e.dataTransfer.files[0], filename, dropText, statusBadge)
      }
    })

    return slot
  }

  private handleFile(
    index: number,
    file: File,
    filenameEl: HTMLElement,
    dropTextEl: HTMLElement,
    statusEl: HTMLElement
  ): void {
    const reader = new FileReader()
    reader.onload = async () => {
      const source = reader.result as string
      const name = file.name.replace(/\.[^.]+$/, '')

      filenameEl.textContent = file.name
      dropTextEl.textContent = ''
      this.slotElements[index].classList.add('has-file')

      this.slots[index] = { source, name, status: 'compiling', error: null }
      statusEl.className = 'slot-status compiling'
      statusEl.textContent = 'compiling...'
      this.updateBattleButton()

      try {
        await this.compileCallback?.(source, index)
        this.slots[index].status = 'ready'
        statusEl.className = 'slot-status ready'
        statusEl.textContent = 'ready'
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.slots[index].status = 'error'
        this.slots[index].error = msg
        statusEl.className = 'slot-status error'
        statusEl.textContent = 'error — click for details'
        // Show popup immediately on compile failure
        this.showErrorModal(name, msg)
      }

      this.updateBattleButton()
    }
    reader.onerror = () => {
      const name = file.name.replace(/\.[^.]+$/, '')
      this.slots[index] = { source: null, name: null, status: 'error', error: 'Failed to read file' }
      statusEl.className = 'slot-status error'
      statusEl.textContent = 'error'
      this.showErrorModal(name, 'Failed to read file')
      this.updateBattleButton()
    }
    reader.readAsText(file)
  }

  private showErrorModal(robotName: string, message: string): void {
    this.errorModalTitle.textContent = `COMPILE ERROR — ${robotName.toUpperCase()}`
    this.errorModalBody.textContent = message
    this.errorModal.classList.add('visible')
  }

  private hideErrorModal(): void {
    this.errorModal.classList.remove('visible')
  }

  private setActiveCount(n: number): void {
    this.activeCount = n
    this.countBtns.forEach((btn, i) => {
      btn.classList.toggle('active', i + 2 === n)
    })
    this.slotElements.forEach((el, i) => {
      el.classList.toggle('hidden', i >= n)
    })
    this.updateBattleButton()
  }

  private updateBattleButton(): void {
    const active = this.slots.slice(0, this.activeCount)
    const anyCompiling = active.some(s => s.status === 'compiling')
    const allReady = active.every(s => s.status === 'ready')
    this.battleButton.disabled = anyCompiling || !allReady
  }
}
