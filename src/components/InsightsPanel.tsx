"use client";

import { useCallback, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

export function InsightsPanel({
  clientId,
  configured,
}: {
  clientId: string;
  configured: boolean;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await fetch(`/api/c/${clientId}/ai/insights`, {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        setError(await res.text());
        setLoading(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          AI insights
        </h2>
        <button
          onClick={run}
          disabled={loading || !configured}
          className="btn-ghost text-sm disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          {text ? "Refresh" : "Generate"}
        </button>
      </div>

      {!configured ? (
        <div className="mt-4 text-sm text-ink-500">
          Set <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code>{" "}
          in <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">.env.local</code> to enable
          AI-generated briefings based on this client&apos;s HighLevel data.
        </div>
      ) : error ? (
        <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : text ? (
        <div className="mt-4 prose-tight text-sm whitespace-pre-wrap leading-relaxed text-ink-700">
          {text}
        </div>
      ) : (
        <div className="mt-4 text-sm text-ink-500">
          Generate a plain-English briefing of what&apos;s working, what needs
          attention, and what to do next — based on this client&apos;s live
          HighLevel data.
        </div>
      )}
    </div>
  );
}
