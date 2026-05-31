# iBzA FlyBuds 🐦

A fast, original arcade flight game (Flappy-style) with an **iBzA Tech-Noir** aesthetic — part of the **iBzA** ecosystem by **TheLaraib**.

> Tap, click or press **SPACE** to flap. Dodge the obstacles. Survive as long as you can and beat your best.

## Features

- 🐦 Canvas-based bird with gravity, auto-forward obstacles of variable height
- 📊 Live **score** (top-right) + live **survival timer**
- 🏁 Game-over screen with score, time, best record, and **restart**
- 🌗 **Light / Dark** mode toggle (saved in localStorage)
- 🔊 Synth **sound** system (Web Audio API) — boot tune, flap, score & game-over SFX + mute toggle
- ⚡ Beginner-friendly tuning so anyone can enjoy a longer flight

## Tech Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- React 18 + TypeScript
- Tailwind CSS
- HTML5 Canvas + Web Audio API (no external assets)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

## Build

```bash
npm run build
npm start
```

## Deploy

Deploy instantly on [Vercel](https://vercel.com) — import the repo, framework auto-detects as Next.js, no extra config needed.

---

© 2026 iBzA · TheLaraib
