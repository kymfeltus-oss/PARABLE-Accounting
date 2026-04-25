"use client";

import Link from "next/link";
import { useState } from "react";

const field =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-cyber)] focus:ring-2 focus:ring-[var(--brand-cyber)]/30";

const OFFICIAL_SITE = "https://www.parableaccountant.com";
const CONTACT_EMAIL = "info@parableaccountant.com";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const openInquiryMail = () => {
    const body = [
      name.trim() && `Name: ${name.trim()}`,
      email.trim() && `Reply email: ${email.trim()}`,
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");
    const subj = subject.trim() || "PARABLE Accounting inquiry";
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    if (!message.trim()) {
      window.alert("Please enter a message.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim() || "PARABLE Accounting inquiry",
          message: message.trim(),
        }),
      });
      if (res.ok) {
        window.alert("Thank you — your message was sent. We will reply soon.");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
        setBusy(false);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 503) {
        openInquiryMail();
        setBusy(false);
        return;
      }
      setFormErr(j.error ?? "Could not send. Try again or use your email app.");
    } catch {
      openInquiryMail();
    }
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <Link
          href="/register"
          className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          ← Back to create account
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Contact us</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Questions about PARABLE Accounting on{" "}
          <a href={OFFICIAL_SITE} className="font-semibold text-[#0a1628] underline hover:no-underline">
            www.parableaccountant.com
          </a>
          ? Send a message below (we deliver via secure Zoho SMTP when configured), or email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#0a1628] underline hover:no-underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="inq-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="inq-name"
              name="name"
              type="text"
              autoComplete="name"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="inq-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Your email
            </label>
            <input
              id="inq-email"
              name="email"
              type="email"
              autoComplete="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="so we can reply"
            />
          </div>
          <div>
            <label htmlFor="inq-subject" className="mb-1.5 block text-sm font-medium text-slate-700">
              Subject <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="inq-subject"
              name="subject"
              type="text"
              className={field}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="inq-message" className="mb-1.5 block text-sm font-medium text-slate-700">
              Message
            </label>
            <textarea
              id="inq-message"
              name="message"
              required
              rows={5}
              className={field + " min-h-[120px] resize-y py-2.5"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
            />
          </div>
          {formErr && <p className="text-sm text-red-600">{formErr}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md border-2 border-cyan-500/20 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 transition hover:brightness-105 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand-cyber)" }}
          >
            {busy ? "Sending…" : "Send inquiry"}
          </button>
          <p className="text-center text-xs text-slate-500">
            If the server cannot use SMTP yet, we open your mail app to {CONTACT_EMAIL} instead.
          </p>
        </form>
      </div>
    </main>
  );
}
