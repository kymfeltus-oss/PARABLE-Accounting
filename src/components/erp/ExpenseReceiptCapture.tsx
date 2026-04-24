"use client";

import { useCallback, useId, useState } from "react";

/**
 * Mobile-first receipt capture — local preview only; wire to storage + approval in a follow-up.
 */
export default function ExpenseReceiptCapture() {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = useCallback((f: File | null) => {
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      if (f && f.type.startsWith("image/")) return URL.createObjectURL(f);
      return null;
    });
  }, []);

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 p-6"
        style={{ boxShadow: "0 0 0 1px rgb(var(--brand-cyber-rgb) / 0.08), 0 20px 50px rgba(0,0,0,0.5)" }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.3em]"
          style={{ color: "rgb(var(--brand-cyber-rgb) / 0.85)" }}
        >
          Ingest
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-white/95">Capture receipt</h2>
        <p className="mt-1 max-w-xl text-sm text-white/50">
          Use your device camera in the field; files stay in-browser until you connect upload + policy routing.
        </p>
        <label
          htmlFor={id}
          className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/40 py-10 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.4)]"
        >
          <input
            id={id}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <span className="text-xs font-semibold text-[var(--brand-cyber)]">Tap or drop</span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-white/40">JPG · PNG · PDF</span>
        </label>
        {file && (
          <p className="mt-3 font-mono text-[10px] text-white/45" title={file.name}>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        )}
      </div>

      {preview && (
        <div
          className="overflow-hidden rounded-2xl border border-white/10 p-2"
          style={{ boxShadow: "inset 0 0 0 1px rgb(var(--brand-cyber-rgb) / 0.12)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic blob URL */}
          <img src={preview} alt="Receipt preview" className="max-h-[min(50vh,420px)] w-full object-contain" />
        </div>
      )}

      {file && !preview && (
        <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
          Non-image file selected — preview not shown. Connect PDF rendering in pipeline.
        </p>
      )}
    </div>
  );
}
