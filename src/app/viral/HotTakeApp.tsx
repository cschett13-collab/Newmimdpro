"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  Category,
  Take,
  encodeTake,
  generateTake,
} from "./takes";

type Props = {
  initialTake: Take | null;
  initialCategory: string | null;
};

const GRADIENTS = [
  "from-pink-500 via-red-500 to-yellow-500",
  "from-fuchsia-500 via-purple-600 to-indigo-600",
  "from-orange-500 via-pink-500 to-red-600",
  "from-emerald-400 via-cyan-500 to-blue-600",
  "from-yellow-400 via-orange-500 to-rose-600",
];

function gradientFor(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export default function HotTakeApp({ initialTake, initialCategory }: Props) {
  const [take, setTake] = useState<Take | null>(initialTake);
  const [category, setCategory] = useState<Category | null>(
    initialCategory && (CATEGORIES as readonly string[]).includes(initialCategory)
      ? (initialCategory as Category)
      : null,
  );
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);
  const [agreeCount, setAgreeCount] = useState(0);
  const [disagreeCount, setDisagreeCount] = useState(0);
  const [voted, setVoted] = useState<"agree" | "disagree" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // seed counts so the page feels alive
  useEffect(() => {
    if (!take) return;
    let h = 0;
    for (let i = 0; i < take.text.length; i++)
      h = (h * 131 + take.text.charCodeAt(i)) | 0;
    const base = Math.abs(h) % 9000;
    setAgreeCount(800 + (base % 4000));
    setDisagreeCount(400 + ((base * 7) % 3500));
    setVoted(null);
  }, [take?.text]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !take) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("t", encodeTake(take));
    url.searchParams.set("c", take.category);
    return url.toString();
  }, [take]);

  function roll(cat?: Category | null) {
    setShake(true);
    setTimeout(() => setShake(false), 350);
    const next = generateTake(cat ?? category);
    setTake(next);
    setCopied(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("t", encodeTake(next));
      url.searchParams.set("c", next.category);
      window.history.replaceState({}, "", url.toString());
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  }

  async function nativeShare() {
    if (!take || !shareUrl) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "🔥 Hot Take",
          text: `"${take.text}"`,
          url: shareUrl,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    copyLink();
  }

  function vote(kind: "agree" | "disagree") {
    if (voted) return;
    setVoted(kind);
    if (kind === "agree") setAgreeCount((n) => n + 1);
    else setDisagreeCount((n) => n + 1);
  }

  const totalVotes = agreeCount + disagreeCount;
  const agreePct = totalVotes ? Math.round((agreeCount / totalVotes) * 100) : 50;

  const grad = take ? gradientFor(take.text) : GRADIENTS[0];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-50 antialiased">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-10">
        <header className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-300">
            <span className="text-2xl">🔥</span>
            <span>HOT TAKES</span>
          </div>
          <div className="text-xs text-zinc-500">spicy. shareable. unhinged.</div>
        </header>

        <h1 className="mt-10 text-center text-4xl font-black leading-tight sm:text-5xl">
          Generate a hot take
          <br />
          <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-yellow-300 bg-clip-text text-transparent">
            you&apos;ll regret sharing.
          </span>
        </h1>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <CategoryPill
            label="surprise me"
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c}
              label={c}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>

        <div
          ref={cardRef}
          className={`mt-8 w-full transition-transform ${
            shake ? "animate-[wiggle_0.35s_ease]" : ""
          }`}
        >
          <div
            className={`rounded-3xl bg-gradient-to-br ${grad} p-[2px] shadow-2xl`}
          >
            <div className="rounded-3xl bg-zinc-900/95 p-7 sm:p-10">
              {take ? (
                <>
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    <span>#{take.category}</span>
                    <HeatMeter heat={take.heat} />
                  </div>
                  <p className="mt-5 text-2xl font-extrabold leading-snug sm:text-3xl">
                    &ldquo;{take.text}&rdquo;
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => vote("agree")}
                      disabled={!!voted}
                      className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                        voted === "agree"
                          ? "bg-emerald-500 text-emerald-50"
                          : "bg-zinc-800 hover:bg-zinc-700"
                      } ${voted && voted !== "agree" ? "opacity-50" : ""}`}
                    >
                      <span>🔥</span>
                      <span>based</span>
                      <span className="text-zinc-400 group-hover:text-zinc-200">
                        {formatCount(agreeCount)}
                      </span>
                    </button>
                    <button
                      onClick={() => vote("disagree")}
                      disabled={!!voted}
                      className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                        voted === "disagree"
                          ? "bg-rose-500 text-rose-50"
                          : "bg-zinc-800 hover:bg-zinc-700"
                      } ${voted && voted !== "disagree" ? "opacity-50" : ""}`}
                    >
                      <span>💀</span>
                      <span>cringe</span>
                      <span className="text-zinc-400 group-hover:text-zinc-200">
                        {formatCount(disagreeCount)}
                      </span>
                    </button>
                    <div className="ml-auto text-xs text-zinc-500">
                      {agreePct}% based
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-orange-400 transition-all"
                      style={{ width: `${agreePct}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-lg text-zinc-400">
                  Tap the button. We dare you.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full flex-wrap justify-center gap-3">
          <button
            onClick={() => roll()}
            className="group rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-yellow-400 px-6 py-3 text-base font-bold text-zinc-900 shadow-lg shadow-orange-500/30 transition hover:scale-[1.03] active:scale-95"
          >
            🎲 {take ? "another one" : "give me a take"}
          </button>
          <button
            onClick={nativeShare}
            disabled={!take}
            className="rounded-full bg-zinc-800 px-5 py-3 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            ↗ share
          </button>
          <button
            onClick={copyLink}
            disabled={!take}
            className="rounded-full bg-zinc-800 px-5 py-3 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {copied ? "✓ copied!" : "🔗 copy link"}
          </button>
        </div>

        <p className="mt-10 max-w-md text-center text-xs text-zinc-500">
          Every take is fictional and exists for vibes only. If you take any of
          this seriously, that's between you and your group chat.
        </p>
      </div>

      <style>{`
        @keyframes wiggle {
          0% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(-6px) rotate(-1.2deg); }
          50% { transform: translateX(6px) rotate(1.2deg); }
          75% { transform: translateX(-3px) rotate(-0.6deg); }
          100% { transform: translateX(0) rotate(0); }
        }
      `}</style>
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
        active
          ? "border-orange-400 bg-orange-400/10 text-orange-200"
          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function HeatMeter({ heat }: { heat: number }) {
  const flames = Math.max(1, Math.min(10, Math.round(heat)));
  return (
    <span aria-label={`heat ${flames}/10`} className="tracking-tight">
      {"🔥".repeat(Math.min(5, Math.ceil(flames / 2)))}
    </span>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}
