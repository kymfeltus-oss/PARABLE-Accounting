"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { ShieldCheck, Database, Landmark, Users, Briefcase } from "lucide-react";

export default function RegisterFullPage() {
  const [mounted, setMounted] = useState(false);
  const [glitter, setGlitter] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    orgName: "",
    taxId: "",
    orgType: "501c3",
    currentSystem: "quickbooks",
    dataMigrationNeeded: false,
    importHistoryYears: "1",
    userCount: "1-5",
    primaryAccessType: "full-admin",
    requiresApprovalWorkflow: false,
    bankIntegrationPlan: "immediate",
    reportingFrequency: "monthly",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    setMounted(true);
    setGlitter(
      Array.from({ length: 300 }).map((_, i) => ({
        id: i,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        s: Math.random() * 1.5 + 0.5,
        d: 4 + Math.random() * 6,
      })),
    );
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: { data: { ...formData, onboarding_complete: true } },
    });
    if (!error) window.location.href = "/member";
    else alert(error.message);
  };

  if (!mounted) return <main className="min-h-screen bg-[#010204]" />;

  const inputClass =
    "w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-[10px] font-mono tracking-wider text-white focus:border-purple-500/50 outline-none transition-all appearance-none";
  const labelClass = "text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400/80 mb-2 block ml-1";

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#010204] py-20 flex flex-col items-center">
      <div className="absolute inset-0 z-10 pointer-events-none">
        {glitter.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-white shadow-[0_0_8px_white]"
            style={{ left: p.x, top: p.y, width: p.s, height: p.s }}
            animate={{ opacity: [0, 0.8, 0], y: [0, -100] }}
            transition={{ duration: p.d, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <div className="relative z-20 w-full max-w-6xl px-6">
        <div className="mb-16 text-center">
          <motion.img
            src="/logo.svg"
            animate={{
              filter: [
                "drop-shadow(0 0 10px #FFFFFF22)",
                "drop-shadow(0 0 35px #00FFFF44)",
                "drop-shadow(0 0 10px #FFFFFF22)",
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="mx-auto mb-6 w-44"
          />
          <h1 className="text-sm font-black uppercase tracking-[0.8em] text-white">CREATE NEW ACCOUNT</h1>
          <p className="mt-3 text-[9px] italic uppercase tracking-[0.3em] text-white/40">
            Establish Institutional Infrastructure, Governance & Compliance
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className="grid grid-cols-1 gap-8 rounded-3xl border border-white/5 bg-white/[0.02] p-10 backdrop-blur-3xl md:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-6">
            <h3 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-white">
              <ShieldCheck size={14} className="text-purple-500" /> Identity Access
            </h3>
            <div>
              <label className={labelClass}>Signatory Name</label>
              <input
                type="text"
                placeholder="Full Legal Name"
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Security Key (Password)</label>
              <input
                type="password"
                placeholder="••••••••"
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-white">
              <Briefcase size={14} className="text-purple-500" /> Entity Details
            </h3>
            <div>
              <label className={labelClass}>Organization Name</label>
              <input
                type="text"
                placeholder="Official Registered Name"
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Tax ID / EIN</label>
              <input
                type="text"
                placeholder="XX-XXXXXXX"
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>IRS Classification</label>
              <select className={inputClass} onChange={(e) => setFormData({ ...formData, orgType: e.target.value })}>
                <option value="501c3">501(c)(3) Non-Profit</option>
                <option value="religious">Religious Institution</option>
                <option value="llc">LLC / Partnership</option>
                <option value="scorp">S-Corp / Corporation</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-white">
              <Users size={14} className="text-cyan-400" /> Governance
            </h3>
            <div>
              <label className={labelClass}>Total System Users</label>
              <select className={inputClass} onChange={(e) => setFormData({ ...formData, userCount: e.target.value })}>
                <option value="1-5">1-5 Users (Small Team)</option>
                <option value="6-20">6-20 Users (Institutional)</option>
                <option value="21+">21+ Users (Enterprise)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Initial Access Tier</label>
              <select
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, primaryAccessType: e.target.value })}
              >
                <option value="full-admin">Full Sovereign (CFO/Admin)</option>
                <option value="editor">Standard Editor (Staff)</option>
                <option value="viewer">Audit Only (Board/Auditor)</option>
              </select>
            </div>
            <div
              className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4"
              onClick={() => setFormData({ ...formData, requiresApprovalWorkflow: !formData.requiresApprovalWorkflow })}
            >
              <input type="checkbox" checked={formData.requiresApprovalWorkflow} className="h-4 w-4 rounded" readOnly />
              <span className="text-[8px] font-bold uppercase leading-tight tracking-tighter text-white/60">
                Multi-Signatory Approval for Transfers
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-white">
              <Database size={14} className="text-cyan-400" /> Data Migration
            </h3>
            <div>
              <label className={labelClass}>Current Financial System</label>
              <select
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, currentSystem: e.target.value })}
              >
                <option value="quickbooks">QuickBooks Online/Desktop</option>
                <option value="xero">Xero</option>
                <option value="excel">Manual / Excel</option>
                <option value="other">Other Legacy System</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Years of History to Import</label>
              <select
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, importHistoryYears: e.target.value })}
              >
                <option value="1">1 Year (Current)</option>
                <option value="3">3 Years (Standard Audit)</option>
                <option value="7">7 Years (Full IRS Compliance)</option>
              </select>
            </div>
            <div
              className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4"
              onClick={() => setFormData({ ...formData, dataMigrationNeeded: !formData.dataMigrationNeeded })}
            >
              <input type="checkbox" checked={formData.dataMigrationNeeded} className="h-4 w-4 rounded" readOnly />
              <span className="text-[9px] font-bold uppercase tracking-tighter text-white/60">
                Requires Data Migration Support
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-white">
              <Landmark size={14} className="text-cyan-400" /> Treasury Management
            </h3>
            <div>
              <label className={labelClass}>Banking Integration Plan</label>
              <select
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, bankIntegrationPlan: e.target.value })}
              >
                <option value="immediate">Immediate Plaid/Live Link</option>
                <option value="manual">Manual Statement Upload</option>
                <option value="hybrid">Hybrid Monitoring</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Reporting Frequency</label>
              <select
                className={inputClass}
                onChange={(e) => setFormData({ ...formData, reportingFrequency: e.target.value })}
              >
                <option value="monthly">Monthly Reconcile</option>
                <option value="quarterly">Quarterly Tax Prep</option>
                <option value="realtime">Real-Time Ledger Audit</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-end md:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="h-16 w-full rounded-2xl bg-cyan-400 text-black font-black uppercase tracking-[0.5em] italic shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-all hover:scale-[1.01]"
            >
              CREATE ACCOUNT
            </button>
            <p className="mt-6 text-center text-[8px] uppercase italic tracking-widest text-white/20">
              Step {formData.email ? "2" : "1"} - Establish Institutional Compliance
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
