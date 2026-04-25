"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [glitter, setGlitter] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    setMounted(true);
    setGlitter(Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      x: `${Math.random() * 100}%`,
      y: `${Math.random() * 100}%`,
      s: Math.random() * 1.5 + 0.5,
      d: 3 + Math.random() * 7,
    })));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) window.location.href = "/";
    else alert(error.message);
  };

  if (!mounted) return <div className="min-h-screen bg-[#010204]" />;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#010204]">
      {/* Sparkle Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {glitter.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-cyan-400/40 shadow-[0_0_8px_#00FFFF66]"
            style={{ left: p.x, top: p.y, width: p.s, height: p.s }}
            animate={{ opacity: [0.1, 0.8, 0.1], y: [0, -30] }}
            transition={{ duration: p.d, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <div className="relative z-20 w-full max-w-md px-8 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <motion.img 
            src="/logo.svg" 
            alt="PARABLE" 
            className="mx-auto w-48 mb-6 select-none"
            animate={{ filter: ["drop-shadow(0 0 10px #00FFFF33)", "drop-shadow(0 0 30px #00FFFF66)", "drop-shadow(0 0 10px #00FFFF33)"] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <h2 className="font-[family-name:var(--font-inter)] text-[0.7rem] font-bold uppercase tracking-[0.5em] text-cyan-200/80 mb-12">
            ACCOUNTING ERP SYSTEM FOR MINISTRIES
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="EMAIL/USERNAME" 
              className="w-full h-14 bg-slate-900/40 border border-slate-800 rounded-2xl px-6 text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-all font-mono text-sm"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="PASSWORD" 
              className="w-full h-14 bg-slate-900/40 border border-slate-800 rounded-2xl px-6 text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-all font-mono text-sm"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full h-14 bg-cyan-400 text-black rounded-2xl font-black uppercase tracking-widest italic shadow-[0_0_25px_#00FFFF44] hover:scale-[1.02] active:scale-95 transition-all mt-8">
              Authorize
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}