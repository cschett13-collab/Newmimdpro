const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://localhost:11434").replace(/\/$/, "");

export async function runLocalAI(
  prompt: string,
  model: string = process.env.LOCAL_CODER_MODEL ?? "qwen2.5-coder:7b",
): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { response: string };
  return data.response;
}
