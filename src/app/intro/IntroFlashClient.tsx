"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function IntroFlashClient({ appType }: any) {
  const [mounted, setMounted] = useState(false);
  const [glitter, setGlitter] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    // 300 Particles for high-density cinematic atmosphere
    setGlitter(Array.from({ length: 300 }).map((_, i) => ({
      id: i,
      x: `${Math.random() * 100}%`,
      y: `${Math.random() * 100}%`,
      s: Math.random() * 1.5 + 0.5,
      d: 3 + Math.random() * 6,
      tone: i % 3 === 0 ? "cyan" : "white",
    })));
  }, []);

  if (!mounted) return <main className="min-h-screen bg-[#010204]" />;

  const label = appType === "giving" ? "Giving" : "Accounting";

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#010204]">
      {/* Cinematic Sparkle Engine */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {glitter.map((p) => (
          <motion.span
            key={p.id}
            className={`absolute rounded-full ${p.tone === "cyan" ? "bg-cyan-400/80" : "bg-white"} shadow-[0_0_10px_rgba(255,255,255,0.8)]`}
            style={{ left: p.x, top: p.y, width: p.s, height: p.s }}
            animate={{ opacity: [0, 0.9, 0], y: [0, -60] }}
            transition={{ duration: p.d, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <div className="relative z-20 flex flex-col items-center text-center px-6">
        <motion.div 
          animate={{ 
            y: [0, -12, 0],
            rotate: [0, 0.3, -0.3, 0]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Logo with Living Pulse Glow */}
          <motion.img 
            src="/logo.svg" 
            alt="PARABLE" 
            className="mx-auto w-full max-w-[18rem] sm:max-w-md mb-4 select-none"
            animate={{ filter: ["drop-shadow(0 0 15px #FFFFFF22)", "drop-shadow(0 0 45px #00FFFF55)", "drop-shadow(0 0 15px #FFFFFF22)"] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          
          <h2 className="mt-4 font-[family-name:var(--font-inter)] text-[0.75rem] font-bold uppercase tracking-[0.8em] text-white sm:text-sm drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
            {label}
          </h2>
          
          <p className="mt-2 text-[10px] font-bold italic uppercase tracking-[0.35em] text-white/80 max-w-xs mx-auto leading-relaxed">
            First ERP System that Guarantees IRS Compliance
          </p>
        </motion.div>

        {/* NEW "GHOST CAPSULE" BUTTONS - Subtle Purple Outline */}
        <div className="mt-24 flex flex-col sm:flex-row items-center gap-8">
          <Link href="/login" className="group relative">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="relative h-14 w-60 flex items-center justify-center rounded-full border border-purple-500/40 bg-purple-500/5 backdrop-blur-sm transition-all group-hover:border-cyan-400 group-hover:bg-cyan-400/5 shadow-[0_0_15px_rgba(168,85,247,0.1)] group-hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
            >
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white italic transition-all group-hover:text-cyan-400">
                Login
              </span>
            </motion.div>
          </Link>

          <Link href="/login" className="group relative">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="relative h-14 w-60 flex items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition-all group-hover:border-purple-400 group-hover:bg-purple-400/5 shadow-[0_0_10px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
            >
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white/90 italic transition-all group-hover:text-purple-400">
                Create Account
              </span>
            </motion.div>
          </Link>
        </div>
      </div>
    </main>
  );
}