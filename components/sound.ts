// =============================================================
// iBzA FlyBuds — Sound Engine (Web Audio API, zero files)
// Synth-generated Tech-Noir SFX + a short cinematic boot tune.
// Works on static deploys; no external assets required.
// =============================================================

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  return ctx
}

// Browsers require a user gesture before audio can play.
export function unlockAudio() {
  const c = ac()
  if (c && c.state === 'suspended') c.resume()
}

export function setMuted(value: boolean) {
  muted = value
  if (master && ctx) {
    master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.02)
  }
}

export function isMuted() {
  return muted
}

// Core tone helper
function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'sine',
  peak = 0.25,
  glideTo?: number
) {
  const c = ac()
  if (!c || !master) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + start)
  if (glideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, glideTo),
      c.currentTime + start + dur
    )
  }
  g.gain.setValueAtTime(0.0001, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(peak, c.currentTime + start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.02)
}

// ---- Public SFX -------------------------------------------------------------

// short upward blip on each flap
export function sfxFlap() {
  if (muted) return
  tone(420, 0, 0.12, 'triangle', 0.2, 620)
}

// crisp ding when passing an obstacle
export function sfxScore() {
  if (muted) return
  tone(880, 0, 0.1, 'square', 0.12)
  tone(1320, 0.04, 0.12, 'sine', 0.16)
}

// bright sparkle when grabbing a coin
export function sfxCoin() {
  if (muted) return
  tone(1046, 0, 0.07, 'sine', 0.16)
  tone(1568, 0.05, 0.1, 'sine', 0.18)
}

// descending "system shutdown" on crash
export function sfxGameOver() {
  if (muted) return
  tone(440, 0, 0.5, 'sawtooth', 0.22, 80)
  tone(220, 0.08, 0.55, 'triangle', 0.18, 60)
}

// cinematic boot/power-up tune (iBzA universe feel)
export function playBootTune() {
  if (muted) return
  const c = ac()
  if (!c) return
  // rising arpeggio — "INITIALIZING..." energy
  const seq = [196, 262, 330, 392, 523]
  seq.forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.18))
  // amber shimmer on top
  tone(784, 0.45, 0.5, 'sine', 0.14, 1046)
  // low confirm thump
  tone(110, 0.5, 0.4, 'sine', 0.2)
}
