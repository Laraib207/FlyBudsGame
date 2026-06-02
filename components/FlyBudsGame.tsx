'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  unlockAudio,
  setMuted as setEngineMuted,
  sfxFlap,
  sfxScore,
  sfxGameOver,
  sfxCoin,
  playBootTune,
} from './sound'
import { lsGet, lsSet } from './storage'

// ---- Tunable base constants (difficulty ramps up from here) -----------------
const GRAVITY = 0.26
const FLAP = -6.0
const MAX_FALL = 7.5
const BASE_GAP = 210 // starting vertical gap (easy)
const MIN_GAP = 150 // hardest gap
const PIPE_WIDTH = 74
const BASE_SPACING = 340
const MIN_SPACING = 250
const BASE_SPEED = 1.7 // starting obstacle speed
const MAX_SPEED = 3.6 // capped top speed
const BIRD_X = 96
const BIRD_R = 15
const COIN_R = 11

type GameState = 'ready' | 'playing' | 'over'

type Pipe = {
  x: number
  gapY: number
  gap: number
  passed: boolean
  coin: { y: number; taken: boolean } | null
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
}

// Difficulty curve based on current score
function diffForScore(score: number) {
  const t = Math.min(score / 30, 1) // ramps over first 30 points
  return {
    gap: BASE_GAP - (BASE_GAP - MIN_GAP) * t,
    spacing: BASE_SPACING - (BASE_SPACING - MIN_SPACING) * t,
    speed: BASE_SPEED + (MAX_SPEED - BASE_SPEED) * t,
  }
}

type Medal = { name: string; color: string } | null
function medalForScore(s: number): Medal {
  if (s >= 40) return { name: 'PLATINUM', color: '#7fd9ff' }
  if (s >= 25) return { name: 'GOLD', color: '#f6b53c' }
  if (s >= 12) return { name: 'SILVER', color: '#cdd3da' }
  if (s >= 5) return { name: 'BRONZE', color: '#cd7f4d' }
  return null
}

export default function FlyBudsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<GameState>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [coins, setCoins] = useState(0)
  const [totalCoins, setTotalCoins] = useState(0)
  const [timeMs, setTimeMs] = useState(0)
  const [bestTimeMs, setBestTimeMs] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [muted, setMuted] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  // mutable game data kept in refs so the loop stays stable
  const sizeRef = useRef({ w: 420, h: 640 })
  const birdY = useRef(0)
  const birdV = useRef(0)
  const birdRot = useRef(0)
  const pipes = useRef<Pipe[]>([])
  const particlesRef = useRef<Particle[]>([])
  const shakeRef = useRef(0)
  const scoreRef = useRef(0)
  const coinRef = useRef(0)
  const stateRef = useRef<GameState>('ready')
  const rafRef = useRef(0)
  const frame = useRef(0)
  const startTimeRef = useRef(0)
  const elapsedRef = useRef(0)
  const themeRef = useRef<'dark' | 'light'>('dark')

  useEffect(() => {
    setBest(Number(lsGet('ibza-flybuds-best') || 0))
    setBestTimeMs(Number(lsGet('ibza-flybuds-best-time') || 0))
    setTotalCoins(Number(lsGet('ibza-flybuds-coins') || 0))
    const savedTheme = (lsGet('ibza-flybuds-theme') as 'dark' | 'light') || 'dark'
    setTheme(savedTheme)
    themeRef.current = savedTheme
    const savedMute = lsGet('ibza-flybuds-muted') === '1'
    setMuted(savedMute)
    setEngineMuted(savedMute)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      setEngineMuted(next)
      lsSet('ibza-flybuds-muted', next ? '1' : '0')
      return next
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      themeRef.current = next
      lsSet('ibza-flybuds-theme', next)
      return next
    })
  }, [])

  const makePipe = useCallback((x: number, gap: number): Pipe => {
    const h = sizeRef.current.h
    const margin = 70
    const gapY = margin + gap / 2 + Math.random() * (h - gap - margin * 2)
    // ~55% chance a coin floats in the gap
    const coin = Math.random() < 0.55 ? { y: gapY, taken: false } : null
    return { x, gapY, gap, passed: false, coin }
  }, [])

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number, power = 4) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = Math.random() * power + 1
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 24 + Math.random() * 18,
          color,
          size: Math.random() * 3 + 1.5,
        })
      }
    },
    []
  )

  const resetGame = useCallback(() => {
    const { w, h } = sizeRef.current
    birdY.current = h / 2
    birdV.current = 0
    birdRot.current = 0
    scoreRef.current = 0
    coinRef.current = 0
    frame.current = 0
    elapsedRef.current = 0
    particlesRef.current = []
    shakeRef.current = 0
    setScore(0)
    setCoins(0)
    setTimeMs(0)
    const d = diffForScore(0)
    pipes.current = [
      makePipe(w + 80, d.gap),
      makePipe(w + 80 + d.spacing, d.gap),
      makePipe(w + 80 + d.spacing * 2, d.gap),
    ]
  }, [makePipe])

  const startGame = useCallback(() => {
    resetGame()
    startTimeRef.current = performance.now()
    stateRef.current = 'playing'
    setState('playing')
    setShareMsg('')
    playBootTune()
  }, [resetGame])

  const endGame = useCallback(() => {
    if (stateRef.current === 'over') return
    elapsedRef.current = performance.now() - startTimeRef.current
    stateRef.current = 'over'
    setState('over')
    setTimeMs(elapsedRef.current)
    shakeRef.current = 16
    spawnParticles(BIRD_X, birdY.current, '#ff4d4d', 26, 6)
    sfxGameOver()
    setBest((prev) => {
      const next = Math.max(prev, scoreRef.current)
      lsSet('ibza-flybuds-best', String(next))
      return next
    })
    setBestTimeMs((prev) => {
      const next = Math.max(prev, elapsedRef.current)
      lsSet('ibza-flybuds-best-time', String(Math.round(next)))
      return next
    })
    setTotalCoins((prev) => {
      const next = prev + coinRef.current
      lsSet('ibza-flybuds-coins', String(next))
      return next
    })
  }, [spawnParticles])

  const flap = useCallback(() => {
    unlockAudio()
    if (stateRef.current === 'ready' || stateRef.current === 'over') {
      startGame()
      birdV.current = FLAP
      sfxFlap()
      return
    }
    birdV.current = FLAP
    sfxFlap()
  }, [startGame])

  // sizing
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current
      const canvas = canvasRef.current
      if (!wrap || !canvas) return
      const w = Math.min(wrap.clientWidth, 460)
      const h = Math.min(window.innerHeight * 0.82, w * 1.5)
      sizeRef.current = { w, h }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (stateRef.current === 'ready') {
        birdY.current = h / 2
        if (pipes.current.length === 0) resetGame()
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resetGame])

  // input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { w, h } = sizeRef.current
      frame.current++
      const light = themeRef.current === 'light'

      // ----- UPDATE -----
      if (stateRef.current === 'playing') {
        const d = diffForScore(scoreRef.current)
        birdV.current = Math.min(birdV.current + GRAVITY, MAX_FALL)
        birdY.current += birdV.current
        birdRot.current = Math.max(-0.5, Math.min(1.2, birdV.current / 12))

        if (frame.current % 4 === 0) setTimeMs(performance.now() - startTimeRef.current)

        for (const p of pipes.current) p.x -= d.speed

        if (pipes.current.length && pipes.current[0].x + PIPE_WIDTH < 0) {
          pipes.current.shift()
          const lastX = pipes.current[pipes.current.length - 1].x
          pipes.current.push(makePipe(lastX + d.spacing, d.gap))
        }

        for (const p of pipes.current) {
          // coin pickup
          if (p.coin && !p.coin.taken) {
            const dx = BIRD_X - (p.x + PIPE_WIDTH / 2)
            const dy = birdY.current - p.coin.y
            if (Math.hypot(dx, dy) < BIRD_R + COIN_R) {
              p.coin.taken = true
              coinRef.current++
              setCoins(coinRef.current)
              spawnParticles(p.x + PIPE_WIDTH / 2, p.coin.y, '#f6b53c', 12, 4)
              sfxCoin()
            }
          }

          if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
            p.passed = true
            scoreRef.current++
            setScore(scoreRef.current)
            spawnParticles(BIRD_X, birdY.current, '#1aa589', 8, 3)
            sfxScore()
          }

          const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_WIDTH
          if (inX) {
            const topGap = p.gapY - p.gap / 2
            const botGap = p.gapY + p.gap / 2
            if (birdY.current - BIRD_R < topGap || birdY.current + BIRD_R > botGap) endGame()
          }
        }

        if (birdY.current + BIRD_R > h || birdY.current - BIRD_R < 0) {
          birdY.current = Math.max(BIRD_R, Math.min(h - BIRD_R, birdY.current))
          endGame()
        }
      } else if (stateRef.current === 'ready') {
        birdY.current = h / 2 + Math.sin(frame.current / 18) * 10
      }

      // update particles
      const parts = particlesRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const pt = parts[i]
        pt.x += pt.vx
        pt.y += pt.vy
        pt.vy += 0.12
        pt.life++
        if (pt.life >= pt.max) parts.splice(i, 1)
      }

      // ----- DRAW (with screen shake) -----
      ctx.clearRect(0, 0, w, h)
      ctx.save()
      if (shakeRef.current > 0) {
        const s = shakeRef.current
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
        shakeRef.current *= 0.85
        if (shakeRef.current < 0.4) shakeRef.current = 0
      }

      // background
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      if (light) {
        grad.addColorStop(0, '#f3eee3')
        grad.addColorStop(1, '#e7dfd0')
      } else {
        grad.addColorStop(0, '#070a10')
        grad.addColorStop(1, '#04060a')
      }
      ctx.fillStyle = grad
      ctx.fillRect(-20, -20, w + 40, h + 40)

      // grid
      ctx.strokeStyle = light ? 'rgba(17,17,17,0.06)' : 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // pipes + coins
      for (const p of pipes.current) {
        const topH = p.gapY - p.gap / 2
        const botY = p.gapY + p.gap / 2
        drawPipe(ctx, p.x, 0, PIPE_WIDTH, topH, true, light)
        drawPipe(ctx, p.x, botY, PIPE_WIDTH, h - botY, false, light)
        if (p.coin && !p.coin.taken) drawCoin(ctx, p.x + PIPE_WIDTH / 2, p.coin.y, frame.current)
      }

      // particles
      for (const pt of parts) {
        const alpha = 1 - pt.life / pt.max
        ctx.globalAlpha = alpha
        ctx.fillStyle = pt.color
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // bird (hidden once it explodes on game over)
      if (stateRef.current !== 'over') {
        drawBird(ctx, BIRD_X, birdY.current, birdRot.current, frame.current)
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [endGame, makePipe, spawnParticles])

  const medal = medalForScore(score)

  const shareScore = useCallback(async () => {
    const text = `I scored ${score} (and grabbed ${coins} coins) on @iBzA FlyBuds! 🐦 Can you beat me?`
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) {
        await navigator.share({ title: '@iBzA FlyBuds', text, url })
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        setShareMsg('Copied! Paste it anywhere 📋')
        setTimeout(() => setShareMsg(''), 2500)
      }
    } catch {
      /* user cancelled share */
    }
  }, [score, coins])

  return (
    <div
      ref={wrapRef}
      data-theme={theme}
      className="ibza-game-root relative flex w-full max-w-[460px] flex-col items-center"
    >
      {/* HUD: live score + coins top-right */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-1">
        <span className="ibza-tag">SCORE</span>
        <span className="ibza-mono ibza-glow-amber text-4xl font-extrabold tabular-nums">
          {String(score).padStart(2, '0')}
        </span>
        <span className="ibza-tag mt-1 inline-flex items-center gap-1">
          <span className="ibza-glow-amber">●</span> {coins}
        </span>
        <span className="ibza-tag mt-2">TIME</span>
        <span className="ibza-mono text-base font-bold tabular-nums text-[var(--ibza-teal)]">
          {formatTime(timeMs)}
        </span>
      </div>

      {/* top-left: status + toggles */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <span className="ibza-rec" />
        <span className="ibza-tag">{state === 'playing' ? 'ACTIVE' : 'STANDBY'}</span>
        <button
          onClick={(e) => { e.stopPropagation(); toggleTheme() }}
          aria-label="Toggle theme"
          className="ibza-mono ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ibza-line-strong)] text-[13px] text-[var(--ibza-text)] transition hover:scale-110"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); unlockAudio(); toggleMute() }}
          aria-label="Toggle sound"
          className="ibza-mono flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ibza-line-strong)] text-[13px] text-[var(--ibza-text)] transition hover:scale-110"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* canvas */}
      <div
        className="ibza-frame relative overflow-hidden rounded-3xl border border-[var(--ibza-line)]"
        onPointerDown={(e) => { e.preventDefault(); flap() }}
        role="button"
        tabIndex={0}
        aria-label="Flap"
      >
        <canvas ref={canvasRef} className="ibza-scanlines block touch-none" />

        {state === 'ready' && (
          <Overlay>
            <p className="ibza-tag ibza-flicker">@iBzA FLYBUDS</p>
            <h2 className="ibza-display mt-3 text-3xl text-white">TAP TO FLY</h2>
            <p className="mt-3 max-w-[250px] text-center text-sm text-[var(--ibza-text-dim)]">
              Tap / click / <span className="ibza-glow-amber">SPACE</span> to flap.
              Grab coins, dodge obstacles — it gets faster as you go.
            </p>
            <PrimaryBtn onClick={flap}>Launch Flight →</PrimaryBtn>
            {totalCoins > 0 && (
              <p className="ibza-tag mt-4">WALLET: <span className="ibza-glow-amber">{totalCoins}</span> COINS</p>
            )}
          </Overlay>
        )}

        {state === 'over' && (
          <Overlay>
            <p className="ibza-tag text-[var(--ibza-red)]">FLIGHT TERMINATED</p>
            <h2 className="ibza-display mt-1 text-4xl text-white">GAME OVER</h2>

            {medal && (
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-black"
                  style={{ background: medal.color }}
                >
                  ★
                </span>
                <span className="ibza-mono text-sm font-bold" style={{ color: medal.color }}>
                  {medal.name} MEDAL
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <Stat label="SCORE" value={score} highlight />
              <Stat label="COINS" value={coins} />
              <Stat label="BEST" value={best} />
            </div>
            <p className="ibza-tag mt-3">
              SURVIVED <span className="ibza-glow-amber ibza-mono">{formatTime(timeMs)}</span>
            </p>

            {((score > 0 && score >= best) || (timeMs > 0 && timeMs >= bestTimeMs)) && (
              <p className="ibza-tag mt-2 text-[var(--ibza-teal)]">★ NEW RECORD</p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <PrimaryBtn onClick={flap}>Restart ↻</PrimaryBtn>
              <button
                onClick={(e) => { e.stopPropagation(); shareScore() }}
                className="ibza-mono rounded-full border border-[var(--ibza-line-strong)] px-6 py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ibza-text)] transition hover:bg-[var(--ibza-hover)]"
              >
                Share ↗
              </button>
            </div>
            {shareMsg && <p className="ibza-tag mt-3 text-[var(--ibza-teal)]">{shareMsg}</p>}
          </Overlay>
        )}
      </div>

      <p className="ibza-tag mt-4 text-center">
        TAP TO FLAP · COLLECT COINS · SPEED RISES · @iBzA UNIVERSE
      </p>
    </div>
  )
}

// ---- canvas drawing helpers -------------------------------------------------
function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, isTop: boolean, light: boolean
) {
  const grad = ctx.createLinearGradient(x, 0, x + w, 0)
  if (light) {
    grad.addColorStop(0, 'rgba(14,143,116,0.95)')
    grad.addColorStop(0.5, 'rgba(14,143,116,0.7)')
    grad.addColorStop(1, 'rgba(14,143,116,0.95)')
  } else {
    grad.addColorStop(0, 'rgba(26,165,137,0.85)')
    grad.addColorStop(0.5, 'rgba(26,165,137,0.55)')
    grad.addColorStop(1, 'rgba(26,165,137,0.85)')
  }
  ctx.fillStyle = grad
  ctx.fillRect(x, y, w, h)

  ctx.fillStyle = light ? 'rgba(185,121,26,0.95)' : 'rgba(246,181,60,0.9)'
  if (isTop) ctx.fillRect(x, y + h - 4, w, 4)
  else ctx.fillRect(x, y, w, 4)

  const capH = 18
  ctx.fillStyle = light ? 'rgba(14,143,116,1)' : 'rgba(26,165,137,1)'
  if (isTop) ctx.fillRect(x - 4, y + h - capH, w + 8, capH)
  else ctx.fillRect(x - 4, y, w + 8, capH)

  ctx.strokeStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const pulse = 1 + Math.sin(frame / 8) * 0.08
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.shadowColor = 'rgba(246,181,60,0.8)'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#f6b53c'
  ctx.beginPath()
  ctx.arc(0, 0, COIN_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#0b0e13'
  ctx.font = 'bold 11px JetBrains Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('@', 0, 1)
  ctx.restore()
}

function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, frame: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.shadowColor = 'rgba(246,181,60,0.7)'
  ctx.shadowBlur = 18
  ctx.fillStyle = '#f6b53c'
  ctx.beginPath()
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  const wing = Math.sin(frame / 4) * 5
  ctx.fillStyle = '#c98a1e'
  ctx.beginPath()
  ctx.ellipse(-3, 2 + wing, 9, 5, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0b0e13'
  ctx.beginPath()
  ctx.arc(7, -5, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff4d4d'
  ctx.beginPath()
  ctx.moveTo(BIRD_R - 2, -2)
  ctx.lineTo(BIRD_R + 8, 0)
  ctx.lineTo(BIRD_R - 2, 4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ---- UI helpers -------------------------------------------------------------
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="ibza-overlay absolute inset-0 z-10 flex flex-col items-center justify-center px-6 backdrop-blur-[2px]">
      {children}
    </div>
  )
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="ibza-mono mt-6 rounded-full bg-[var(--ibza-amber)] px-7 py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-black transition hover:scale-105"
    >
      {children}
    </button>
  )
}

function Stat({ label, value, text, highlight }: {
  label: string; value?: number; text?: string; highlight?: boolean
}) {
  return (
    <div className="ibza-panel min-w-[84px] rounded-2xl px-4 py-3 text-center">
      <p className="ibza-tag">{label}</p>
      <p className={`ibza-mono mt-1 text-2xl font-extrabold tabular-nums ${highlight ? 'ibza-glow-amber' : 'text-white'}`}>
        {text !== undefined ? text : value}
      </p>
    </div>
  )
}

function formatTime(ms: number) {
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  const tenths = Math.floor((ms % 1000) / 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`
}
