import Image from 'next/image'
import FlyBudsGame from '../components/FlyBudsGame'
import InstallButton from '../components/InstallButton'

export default function Page() {
  return (
    <main className="ibza-scanlines relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-6">
      {/* backdrop */}
      <div className="ibza-grid-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -left-32 top-0 h-[26rem] w-[26rem] rounded-full bg-[var(--ibza-amber)] opacity-[0.08] blur-[140px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[var(--ibza-teal)] opacity-[0.07] blur-[150px]" />

      {/* brand bar */}
      <div className="relative z-10 mb-5 flex items-center gap-3">
        <Image
          src="/brand/flybuds-icon.svg"
          alt="@iBzA Flying Buds logo"
          width={36}
          height={36}
          priority
        />
        <span className="ibza-mono text-sm font-bold uppercase tracking-[0.3em] text-white">
          @iBzA
        </span>
        <span className="ibza-tag">/ FLYBUDS</span>
      </div>

      <div className="relative z-10 flex w-full justify-center">
        <FlyBudsGame />
      </div>

      <p className="relative z-10 mt-6 ibza-tag">© 2026 @iBzA · THELARAIB</p>
      <InstallButton />
    </main>
  )
}
