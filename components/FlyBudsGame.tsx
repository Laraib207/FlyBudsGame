'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  unlockAudio,
  setMuted as setEngineMuted,
  sfxFlap,
  sfxScore,
  sfxGameOver,
  playBootTune,
} from './sound'

// ---- Tunable game constants -------------------------------------------------
// Tuned to feel calm & beginner-friendly: gentle gravity, soft flap,
// wide gaps, slow obstacles — so players can actually enjoy the flight.
const GRAVITY = 0.26 // downward pull per frame (lower = floatier)
const FLAP = -6.0 // upward velocity on tap (softer hop)
const MAX_FALL = 7.5 // terminal velocity (slower drop)
const PIPE_GAP = 205 // vertical gap between top/bottom obstacle (wider = easier)
const PIPE_WIDTH = 74
const PIPE_SPACING = 340 // horizontal distance between pipes (more breathing room)
const PIPE_SPEED = 1.7 // how fast obstacles move left (bird "moves ahead")
const BIRD_X = 96 // bird's fixed x position
const BIRD_R = 15 // bird radius (collision)

type GameState = 'ready' | 'playing' | 'over'

type Pipe = {
  x: number
  gapY: number // center of the gap
  passed: boolean
}

export default function FlyBudsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<GameState>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [timeMs, setTimeMs] = useState(0)
  const [bestTimeMs, setBestTimeMs] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [muted, setMuted] = useState(false)

  // mutable game data kept in refs so the animation loop stays stable
  const sizeRef = useRef({ w: 420, h: 640 })
  const birdY = useRef(0)
  const birdV = useRef(0)
  const birdRot = useRef(0)
  const pipes = useRef<Pipe[]>([])
  const scoreRef = useRef(0)
  const stateRef = useRef<GameState>('ready')
  const rafRef = useRef(0)
  const frame = useRef(0)
  const startTimeRef = useRef(0)
  const elapsedRef = useRef(0)
  const themeRef = useRef<'dark' | 'light'>('dark')

  // load best score + best time + theme
  useEffect(() => {
    const saved = Number(localStorage.getItem('ibza-flybuds-best') || 0)
    if (saved > 0) setBest(saved)
    const savedTime = Number(localStorage.getItem('ibza-flybuds-best-time') || 0)
    if (savedTime > 0) setBestTimeMs(savedTime)
    const savedTheme = (localStorage.getItem('ibza-flybuds-theme') as 'dark' | 'light') || 'dark'
    setTheme(savedTheme)
    themeRef.current = savedTheme
    const savedMute = localStorage.getItem('ibza-flybuds-muted') === '1'
    setMuted(savedMute)
    setEngineMuted(savedMute)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      setEngineMuted(next)
      localStorage.setItem('ibza-flybuds-muted', next ? '1' : '0')
      return next
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      themeRef.current = next
      localStorage.setItem('ibza-flybuds-theme', next)
      return next
    })
  }, [])

  const makePipe = useCallback((x: number): Pipe => {
    const h = sizeRef.current.h
    const margin = 80
    const gapY = margin + PIPE_GAP / 2 + Math.random() * (h - PIPE_GAP - margin * 2)
    return { x, gapY, passed: false }
  }, [])

  const resetGame = useCallback(() => {
    const { w, h } = sizeRef.current
    birdY.current = h / 2
    birdV.current = 0
    birdRot.current = 0
    scoreRef.current = 0
    frame.current = 0
    elapsedRef.current = 0
    setScore(0)
    setTimeMs(0)
    pipes.current = [
      makePipe(w + 80),
      makePipe(w + 80 + PIPE_SPACING),
      makePipe(w + 80 + PIPE_SPACING * 2),
    ]
  }, [makePipe])

  const startGame = useCallback(() => {
    resetGame()
    startTimeRef.current = performance.now()
    stateRef.current = 'playing'
    setState('playing')
    playBootTune()
  }, [resetGame])

  const endGame = useCallback(() => {
    if (stateRef.current === 'over') return
    elapsedRef.current = performance.now() - startTimeRef.current
    stateRef.current = 'over'
    setState('over')
    setTimeMs(elapsedRef.current)
    sfxGameOver()
    setBest((prev) => {
      const next = Math.max(prev, scoreRef.current)
      localStorage.setItem('ibza-flybuds-best', String(next))
      return next
    })
    setBestTimeMs((prev) => {
      const next = Math.max(prev, elapsedRef.current)
      localStorage.setItem('ibza-flybuds-best-time', String(Math.round(next)))
      return next
    })
  }, [])

  const flap = useCallback(() => {
    unlockAudio()
    if (stateRef.current === 'ready') {
      startGame()
      birdV.current = FLAP
      sfxFlap()
      return
    }
    if (stateRef.current === 'playing') {
      birdV.current = FLAP
      sfxFlap()
      return
    }
    if (stateRef.current === 'over') {
      startGame()
      birdV.current = FLAP
      sfxFlap()
    }
  }, [startGame])

  // sizing
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current
      const canvas = canvasRef.current
      if (!wrap || !canvas) return
      const maxW = 460
      const w = Math.min(wrap.clientWidth, maxW)
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

      // ----- UPDATE -----
      if (stateRef.current === 'playing') {
        birdV.current = Math.min(birdV.current + GRAVITY, MAX_FALL)
        birdY.current += birdV.current
        birdRot.current = Math.max(-0.5, Math.min(1.2, birdV.current / 12))

        // live survival timer (update ~every 4 frames to limit re-renders)
        if (frame.current % 4 === 0) {
          setTimeMs(performance.now() - startTimeRef.current)
        }

        // move pipes
        for (const p of pipes.current) p.x -= PIPE_SPEED

        // recycle + spawn
        if (pipes.current.length && pipes.current[0].x + PIPE_WIDTH < 0) {
          pipes.current.shift()
          const lastX = pipes.current[pipes.current.length - 1].x
          pipes.current.push(makePipe(lastX + PIPE_SPACING))
        }

        // score + collision
        for (const p of pipes.current) {
          if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
            p.passed = true
            scoreRef.current++
            setScore(scoreRef.current)
            sfxScore()
          }
          const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_WIDTH
          if (inX) {
            const topGap = p.gapY - PIPE_GAP / 2
            const botGap = p.gapY + PIPE_GAP / 2
            if (birdY.current - BIRD_R < topGap || birdY.current + BIRD_R > botGap) {
              endGame()
            }
          }
        }

        // ground / ceiling
        if (birdY.current + BIRD_R > h || birdY.current - BIRD_R < 0) {
          birdY.current = Math.max(BIRD_R, Math.min(h - BIRD_R, birdY.current))
          endGame()
        }
      } else if (stateRef.current === 'ready') {
        // idle bob
        birdY.current = h / 2 + Math.sin(frame.current / 18) * 10
      }

      // ----- DRAW -----
      ctx.clearRect(0, 0, w, h)

      const light = themeRef.current === 'light'

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
      ctx.fillRect(0, 0, w, h)

      // grid
      ctx.strokeStyle = light ? 'rgba(17,17,17,0.06)' : 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // pipes / obstacles
      for (const p of pipes.current) {
        const topH = p.gapY - PIPE_GAP / 2
        const botY = p.gapY + PIPE_GAP / 2
        drawPipe(ctx, p.x, 0, PIPE_WIDTH, topH, true, light)
        drawPipe(ctx, p.x, botY, PIPE_WIDTH, h - botY, false, light)
      }

      // bird
      drawBird(ctx, BIRD_X, birdY.current, birdRot.current, frame.current)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [endGame, makePipe])

  return (
    <div
      ref={wrapRef}
      data-theme={theme}
      className="ibza-game-root relative flex w-full max-w-[460px] flex-col items-center"
    >
      {/* HUD: live score top-right */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-1">
        <span className="ibza-tag">SCORE</span>
        <span className="ibza-mono ibza-glow-amber text-4xl font-extrabold tabular-nums">
          {String(score).padStart(2, '0')}
        </span>
        <span className="ibza-tag mt-1">BEST {best}</span>
        <span className="ibza-tag mt-2">TIME</span>
        <span className="ibza-mono text-lg font-bold tabular-nums text-[var(--ibza-teal)]">
          {formatTime(timeMs)}
        </span>
      </div>

      {/* top-left: live indicator + theme toggle */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <span className="ibza-rec" />
        <span className="ibza-tag">{state === 'playing' ? 'FLIGHT ACTIVE' : 'STANDBY'}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleTheme()
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="ibza-mono ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ibza-line-strong)] text-[13px] text-[var(--ibza-text)] transition hover:scale-110"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            unlockAudio()
            toggleMute()
          }}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          className="ibza-mono flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ibza-line-strong)] text-[13px] text-[var(--ibza-text)] transition hover:scale-110"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* canvas */}
      <div
        className="ibza-frame relative overflow-hidden rounded-3xl border border-[var(--ibza-line)]"
        onPointerDown={(e) => {
          e.preventDefault()
          flap()
        }}
        role="button"
        tabIndex={0}
        aria-label="Flap"
      >
        <canvas ref={canvasRef} className="ibza-scanlines block touch-none" />

        {/* READY overlay */}
        {state === 'ready' && (
          <Overlay>
            <p className="ibza-tag ibza-flicker">iBzA FLYBUDS</p>
            <h2 className="ibza-display mt-3 text-3xl text-white">TAP TO FLY</h2>
            <p className="mt-3 max-w-[240px] text-center text-sm text-[var(--ibza-text-dim)]">
              Tap, click or press <span className="ibza-glow-amber">SPACE</span> to flap.
              Dodge the obstacles. Beat your best.
            </p>
            <PrimaryBtn onClick={flap}>Launch Flight →</PrimaryBtn>
          </Overlay>
        )}

        {/* OVER overlay */}
        {state === 'over' && (
          <Overlay>
            <p className="ibza-tag text-[var(--ibza-red)]">FLIGHT TERMINATED</p>
            <h2 className="ibza-display mt-2 text-4xl text-white">GAME OVER</h2>

            <p className="mt-3 text-center text-sm text-[var(--ibza-text-dim)]">
              You stayed airborne for{' '}
              <span className="ibza-glow-amber ibza-mono">{formatTime(timeMs)}</span>
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Stat label="SCORE" value={score} highlight />
              <Stat label="TIME" text={formatTime(timeMs)} />
              <Stat label="BEST" value={best} />
            </div>

            {((score > 0 && score >= best) || (timeMs > 0 && timeMs >= bestTimeMs)) && (
              <p className="ibza-tag mt-4 text-[var(--ibza-teal)]">★ NEW RECORD</p>
            )}

            <PrimaryBtn onClick={flap}>Restart Flight ↻</PrimaryBtn>
            <a
              href="/"
              className="ibza-mono mt-3 text-[11px] uppercase tracking-[0.2em] text-[var(--ibza-text-dim)] transition hover:text-white"
            >
              ← Back to iBzA FlyBuds
            </a>
          </Overlay>
        )}
      </div>

      <p className="ibza-tag mt-4 text-center">
        SPACE / TAP TO FLAP · OBSTACLES INCOMING · iBzA UNIVERSE
      </p>
    </div>
  )
}

// ---- canvas drawing helpers -------------------------------------------------
function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isTop: boolean,
  light: boolean
) {
  // body
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

  // amber edge glow
  ctx.fillStyle = light ? 'rgba(185,121,26,0.95)' : 'rgba(246,181,60,0.9)'
  if (isTop) {
    ctx.fillRect(x, y + h - 4, w, 4)
  } else {
    ctx.fillRect(x, y, w, 4)
  }

  // cap
  const capH = 18
  ctx.fillStyle = light ? 'rgba(14,143,116,1)' : 'rgba(26,165,137,1)'
  if (isTop) {
    ctx.fillRect(x - 4, y + h - capH, w + 8, capH)
  } else {
    ctx.fillRect(x - 4, y, w + 8, capH)
  }

  // border
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  frame: number
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)

  // glow
  ctx.shadowColor = 'rgba(246,181,60,0.7)'
  ctx.shadowBlur = 18

  // body
  ctx.fillStyle = '#f6b53c'
  ctx.beginPath()
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0

  // wing (flap)
  const wing = Math.sin(frame / 4) * 5
  ctx.fillStyle = '#c98a1e'
  ctx.beginPath()
  ctx.ellipse(-3, 2 + wing, 9, 5, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // eye
  ctx.fillStyle = '#0b0e13'
  ctx.beginPath()
  ctx.arc(7, -5, 3, 0, Math.PI * 2)
  ctx.fill()

  // beak
  ctx.fillStyle = '#ff4d4d'
  ctx.beginPath()
  ctx.moveTo(BIRD_R - 2, -2)
  ctx.lineTo(BIRD_R + 8, 0)
  ctx.lineTo(BIRD_R - 2, 4)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// ---- small UI helpers -------------------------------------------------------
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
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="ibza-mono mt-6 rounded-full bg-[var(--ibza-amber)] px-7 py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-black transition hover:scale-105"
    >
      {children}
    </button>
  )
}

function Stat({
  label,
  value,
  text,
  highlight,
}: {
  label: string
  value?: number
  text?: string
  highlight?: boolean
}) {
  return (
    <div className="ibza-panel min-w-[92px] rounded-2xl px-5 py-3 text-center">
      <p className="ibza-tag">{label}</p>
      <p
        className={`ibza-mono mt-1 text-2xl font-extrabold tabular-nums ${
          highlight ? 'ibza-glow-amber' : 'text-white'
        }`}
      >
        {text !== undefined ? text : value}
      </p>
    </div>
  )
}

// mm:ss.t survival time formatter
function formatTime(ms: number) {
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  const tenths = Math.floor((ms % 1000) / 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`
}
