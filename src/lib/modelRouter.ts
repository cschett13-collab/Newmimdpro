import { isOwner } from "./isOwner";
import type { Provider } from "./aiRouter";

export type ModelChoice = {
  provider: Provider;
  model: string;
  apiKey?: string;
  cost: 0 | "paid";
  unlimited: boolean;
};

export type RequestedMode = "local" | "premium";

export type UserApiKeys = {
  openai?: string;
  anthropic?: string;
};

export function chooseModel(opts: {
  email?: string | null;
  requestedMode?: RequestedMode;
  userApiKeys?: UserApiKeys;
}): ModelChoice {
  const { email, requestedMode, userApiKeys } = opts;

  // Owner mode: free, unlimited, local Ollama.
  if (isOwner(email)) {
    return {
      provider: "ollama",
      model: process.env.LOCAL_CODER_MODEL ?? "qwen2.5-coder:7b",
      cost: 0,
      unlimited: true,
    };
  }

  // BYOK mode: user supplied their own key — they pay the provider directly.
  if (userApiKeys?.anthropic) {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      apiKey: userApiKeys.anthropic,
      cost: "paid",
      unlimited: false,
    };
  }
  if (userApiKeys?.openai) {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1",
      apiKey: userApiKeys.openai,
      cost: "paid",
      unlimited: false,
    };
  }

  // User Pro mode: paid hosted credits — operator's key, hosted premium model.
  if (requestedMode === "premium" && process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: process.env.OPENAI_PREMIUM_MODEL ?? "gpt-4.1-mini",
      apiKey: process.env.OPENAI_API_KEY,
      cost: "paid",
      unlimited: false,
    };
  }

  // User Free mode: limited local Ollama.
  return {
    provider: "ollama",
    model: process.env.LOCAL_CHAT_MODEL ?? "llama3.1:8b",
    cost: 0,
    unlimited: false,
  };
}
