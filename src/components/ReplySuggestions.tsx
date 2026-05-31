"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";

type Suggestion = { label: string; text: string };

export function ReplySuggestions({
  clientId,
  contactName,
  lastMessage,
  channel,
  enabled,
}: {
  clientId: string;
  contactName: string;
  lastMessage: string;
  channel?: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setOpen(true);
    try {
      const res = await fetch(
        `/api/c/${clientId}/ai/reply-suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactName, lastMessage, channel }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to generate suggestions");
      } else {
        setSuggestions(json.suggestions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!enabled) return null;

  return (
    <div className="mt-2">
      {!open && (
        <button
          onClick={generate}
          className="text-xs inline-flex items-center gap-1 text-brand-700 hover:underline"
        >
          <Sparkles className="h-3 w-3" />
          Suggest reply
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-ink-100 bg-ink-50/40 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-ink-600 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-brand-600" />
              AI reply drafts
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-ink-500 hover:text-ink-700"
            >
              Close
            </button>
          </div>

          {loading && (
            <div className="mt-3 text-xs text-ink-500">Generating…</div>
          )}

          {error && (
            <div className="mt-3 text-xs text-amber-700">{error}</div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <ul className="mt-3 space-y-2">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="rounded-md bg-white border border-ink-100 p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">
                      {s.label}
                    </div>
                    <button
                      onClick={() => copy(s.text, i)}
                      className="text-xs inline-flex items-center gap-1 text-ink-500 hover:text-brand-700"
                    >
                      {copied === i ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-ink-800 whitespace-pre-wrap">
                    {s.text}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
