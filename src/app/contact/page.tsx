"use client";

import Link from "next/link";
import { useState } from "react";

const field =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-cyber)] focus:ring-2 focus:ring-[var(--brand-cyber)]/30";

const CONTACT_EMAIL = "info@parableaccountant.com";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const openInquiryMail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      window.alert("Please enter a message.");
      return;
    }
    const body = [
      name.trim() && `Name: ${name.trim()}`,
      email.trim() && `Reply email: ${email.trim()}`,
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");
    const subj = subject.trim() || "Parable Accounting inquiry";
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
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
          Send an inquiry using the form below (opens your email app), or reach us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#0a1628] underline hover:no-underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <form onSubmit={openInquiryMail} className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
          <button
            type="submit"
            className="w-full rounded-md border-2 border-cyan-500/20 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 transition hover:brightness-105"
            style={{ backgroundColor: "var(--brand-cyber)" }}
          >
            Send inquiry
          </button>
          <p className="text-center text-xs text-slate-500">
            Opens your default email app addressed to {CONTACT_EMAIL}.
          </p>
        </form>
      </div>
    </main>
  );
}
