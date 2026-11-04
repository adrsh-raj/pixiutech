export class AudioEngine {
  private ctx: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private muted: boolean = false
  private playRequest = 0
  private baseGain = 0

  /**
   * Lazily initializes the AudioContext.
   */
  private initContext(): void {
    if (this.ctx) return
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        console.warn('Web Audio API not supported in this browser.')
        return
      }
      this.ctx = new AudioContextClass()
    } catch (err) {
      console.warn('Failed to initialize AudioContext', err)
    }
  }

  /**
   * Unlocks and resumes the AudioContext on user interaction.
   */
  public unlockAudio(): void {
    this.initContext()
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  /**
   * Plays a square wave tone. Volume is PWM-mapped from 0-255 to a safe 0.0-0.3 gain.
   */
  playTone(frequency: number, volume: number = 255): void {
    this.initContext()
    const context = this.ctx
    if (!context) return

    const request = ++this.playRequest
    const maxGain = 0.3
    this.baseGain = (Math.max(0, Math.min(255, volume)) / 255) * maxGain

    const startTone = () => {
      if (request !== this.playRequest || context !== this.ctx || context.state === 'closed') return
      this.stopNodes()

      this.oscillator = context.createOscillator()
      this.oscillator.type = 'square'
      this.oscillator.frequency.value = Math.max(20, Math.min(20_000, frequency))

      this.gainNode = context.createGain()
      this.gainNode.gain.value = this.muted ? 0 : this.baseGain

      this.oscillator.connect(this.gainNode)
      this.gainNode.connect(context.destination)
      this.oscillator.start()
    }

    // Wait for resume to complete before creating the oscillator. A stop or
    // newer pitch request invalidates this callback so stale tones cannot return.
    if (context.state === 'suspended') {
      context.resume().then(startTone).catch(() => {})
    } else {
      startTone()
    }
  }

  private stopNodes(): void {
    if (this.oscillator) {
      try {
        this.oscillator.stop()
        this.oscillator.disconnect()
      } catch (e) {
        // Safe to ignore
      }
      this.oscillator = null
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect()
      } catch (e) {
        // Safe to ignore
      }
      this.gainNode = null
    }
  }

  /**
   * Stops the currently playing tone and invalidates any pending audio resume.
   */
  stopTone(): void {
    this.playRequest += 1
    this.stopNodes()
  }

  /**
   * Sets the mute state of the engine.
   */
  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : this.baseGain
    }
  }

  /**
   * Returns whether the engine is currently muted.
   */
  isMuted(): boolean {
    return this.muted
  }

  /**
   * Stops all sound and closes the AudioContext cleanly.
   */
  dispose(): void {
    this.stopTone()
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(console.error)
    }
    this.ctx = null
  }
}

export const audioEngine = new AudioEngine()

// Auto-unlock AudioContext on first user interaction anywhere on the screen
if (typeof window !== 'undefined') {
  const unlock = () => {
    audioEngine.unlockAudio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true, passive: true })
}
