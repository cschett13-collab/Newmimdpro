"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Which deals should I push on this week?",
  "Summarize unread conversations and who to reply to first.",
  "Which appointments are coming up that need confirmation?",
  "Where is the pipeline thinnest right now?",
];

export function ChatAssistant({
  clientId,
  clientName,
  configured,
}: {
  clientId: string;
  clientName: string;
  configured: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: Msg = { role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);
      setError(null);

      try {
        const res = await fetch(`/api/c/${clientId}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        if (!res.ok || !res.body) {
          setError(await res.text());
          setMessages(history);
          setStreaming(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = prev.slice();
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = {
                role: "assistant",
                content: last.content + chunk,
              };
            }
            return next;
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        setMessages(history);
      } finally {
        setStreaming(false);
      }
    },
    [clientId, messages],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || streaming || !configured) return;
    send(t);
  };

  return (
    <div className="card flex flex-col h-[calc(100vh-13rem)] min-h-[500px]">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!configured ? (
          <div className="m-auto max-w-md text-center text-sm text-ink-500">
            <Sparkles className="h-8 w-8 mx-auto text-ink-300 mb-3" />
            Set{" "}
            <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">
              ANTHROPIC_API_KEY
            </code>{" "}
            in <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">.env.local</code>{" "}
            to enable the AI assistant.
          </div>
        ) : messages.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-8">
            <Sparkles className="h-8 w-8 mx-auto text-brand-500 mb-3" />
            <div className="font-semibold">Ask anything about {clientName}</div>
            <div className="text-sm text-ink-500 mt-1">
              The assistant has live access to this client&apos;s contacts,
              pipeline, conversations, and upcoming appointments.
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2 text-left">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-sm rounded-lg border border-ink-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40 text-ink-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-ink-50 text-ink-800"
                }`}
              >
                {m.content || (streaming ? "…" : "")}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))
        )}
        {error && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-ink-100 p-3 flex gap-2"
      >
        <input
          className="input flex-1"
          placeholder={
            configured
              ? `Ask about ${clientName}…`
              : "AI assistant disabled — configure ANTHROPIC_API_KEY"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!configured || streaming}
        />
        <button
          type="submit"
          disabled={!configured || streaming || !input.trim()}
          className="btn-primary disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
}
