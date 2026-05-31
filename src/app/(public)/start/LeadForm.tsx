"use client";

import { useState } from "react";

export default function LeadForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Something went wrong");
      }
      window.location.href = "/start/thanks";
    } catch (err: unknown) {
      setStatus("err");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Your name</label>
          <input
            name="name"
            required
            className="input"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="label">Business name</label>
          <input
            name="business"
            required
            className="input"
            placeholder="Acme Roofing"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            name="email"
            required
            className="input"
            placeholder="you@business.com"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" className="input" placeholder="(555) 555-5555" />
        </div>
      </div>
      <div>
        <label className="label">What do you want fixed?</label>
        <textarea
          name="notes"
          rows={3}
          className="input"
          placeholder="We're losing leads from our website and don't have a follow-up system..."
        />
      </div>
      {/* honeypot */}
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary py-3 text-base"
      >
        {status === "sending" ? "Sending..." : "Get my recommendation"}
      </button>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </form>
  );
}
