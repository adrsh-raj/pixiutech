export class AudioEngine {
  private ctx: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private muted: boolean = false

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
   * Plays a square wave tone. Volume is PWM-mapped from 0-255 to a safe 0.0-0.3 gain.
   */
  playTone(frequency: number, volume: number = 255): void {
    this.initContext()
    if (!this.ctx) return
    
    // Resume context if suspended due to autoplay policies
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.error)
    }

    this.stopTone()

    // Map PWM 0-255 to 0.0 - 0.3 gain, ensure max 0.3
    const maxGain = 0.3
    const targetGain = this.muted ? 0 : (Math.max(0, Math.min(255, volume)) / 255) * maxGain

    this.oscillator = this.ctx.createOscillator()
    this.oscillator.type = 'square'
    this.oscillator.frequency.value = frequency

    this.gainNode = this.ctx.createGain()
    this.gainNode.gain.value = targetGain

    this.oscillator.connect(this.gainNode)
    this.gainNode.connect(this.ctx.destination)

    this.oscillator.start()
  }

  /**
   * Stops the currently playing tone.
   */
  stopTone(): void {
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
   * Sets the mute state of the engine.
   */
  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.3
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
