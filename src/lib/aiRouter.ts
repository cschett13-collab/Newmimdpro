export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Provider = "openai" | "anthropic" | "ollama";

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://localhost:11434").replace(/\/$/, "");

export async function routeAI(opts: {
  messages: Message[];
  provider: Provider;
  model: string;
  apiKey?: string;
}): Promise<string> {
  switch (opts.provider) {
    case "openai":
      return runOpenAI(opts.messages, opts.model, opts.apiKey ?? "");
    case "anthropic":
      return runAnthropic(opts.messages, opts.model, opts.apiKey ?? "");
    case "ollama":
      return runOllamaChat(opts.messages, opts.model);
  }
}

async function runOpenAI(messages: Message[], model: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("OpenAI key missing");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: messages }),
  });
  const data = (await res.json()) as { output_text?: string; error?: unknown };
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data.error ?? data)}`);
  return data.output_text ?? "";
}

async function runAnthropic(messages: Message[], model: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("Anthropic key missing");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages: turns }),
  });
  const data = (await res.json()) as {
    content?: Array<{ text?: string }>;
    error?: unknown;
  };
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(data.error ?? data)}`);
  return data.content?.[0]?.text ?? "";
}

async function runOllamaChat(messages: Message[], model: string): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const data = (await res.json()) as { message?: { content?: string } };
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${JSON.stringify(data)}`);
  return data.message?.content ?? "";
}
