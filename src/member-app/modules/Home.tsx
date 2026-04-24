"use client";

import { SOVEREIGN } from "../styles";

const bg =
  "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1920&q=90";

export function Home({ onGive }: { onGive: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col" style={{ background: SOVEREIGN.MATTE }}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 min-h-[56vh] bg-black" />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${SOVEREIGN.MATTE} 0%, transparent 32%, rgba(0,0,0,0.5) 55%, ${SOVEREIGN.MATTE} 100%)`,
          }}
        />
        <div className="absolute bottom-36 left-0 right-0 px-4 text-center">
          <h1
            className="text-3xl font-black uppercase tracking-[0.2em] text-white"
            style={{ textShadow: `0 0 50px color-mix(in srgb, ${SOVEREIGN.GLOW} 30%, transparent)` }}
          >
            Sanctuary
          </h1>
          <p className="mt-2 text-xs text-white/50">Sovereign · your giving, one place</p>
        </div>
      </div>
      <div className="safe-pb-6 px-4 pb-6">
        <button
          type="button"
          onClick={onGive}
          className="pp-mfab block w-full rounded-2xl py-4 text-center text-sm font-black uppercase tracking-[0.35em] text-[#0a0a0a]"
          style={{
            background: SOVEREIGN.GLOW,
            boxShadow: `0 0 40px color-mix(in srgb, ${SOVEREIGN.GLOW} 50%, transparent)`,
            animation: "ppFabPulse 2.4s ease-in-out infinite",
          }}
        >
          GIVE
        </button>
      </div>
      <style>{`
        @keyframes ppFabPulse {
          0%, 100% { box-shadow: 0 0 28px color-mix(in srgb, #00ffff 40%, transparent), 0 0 60px color-mix(in srgb, #00ffff 18%, transparent); }
          50% { box-shadow: 0 0 44px color-mix(in srgb, #00ffff 60%, transparent), 0 0 88px color-mix(in srgb, #00ffff 32%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pp-mfab { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
