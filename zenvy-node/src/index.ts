import "dotenv/config";
import { Telegraf, type Context } from "telegraf";
import cron from "node-cron";

type AgentStatus = "running" | "stopped";
type ModelMode = "local" | "premium" | "auto";

type Agent = {
  id: string;
  name: string;
  goal: string;
  status: AgentStatus;
  lastHeartbeat?: number;
  modelMode: ModelMode;
};

const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID;
const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
const DEFAULT_LOCAL_MODEL = process.env.DEFAULT_LOCAL_MODEL ?? "llama3.1:8b";
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN missing — set it in .env");
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);

const agents: Agent[] = [
  {
    id: "code-agent",
    name: "Code Builder Agent",
    goal: "Build websites, code tools, fix bugs, and improve the Zenvy AI system.",
    status: "running",
    modelMode: "local",
  },
  {
    id: "money-agent",
    name: "Cash Flow Agent",
    goal: "Find ways to turn ideas into offers, ads, funnels, and income systems.",
    status: "running",
    modelMode: "local",
  },
  {
    id: "ad-agent",
    name: "Ad Agent",
    goal: "Create ads, hooks, captions, landing page copy, and sales angles.",
    status: "running",
    modelMode: "local",
  },
  {
    id: "research-agent",
    name: "Research Agent",
    goal: "Break down ideas, compare options, and create useful summaries.",
    status: "running",
    modelMode: "local",
  },
];

function isOwner(ctx: Context): boolean {
  return String(ctx.from?.id) === String(OWNER_TELEGRAM_ID);
}

async function ownerOnly(ctx: Context): Promise<boolean> {
  if (!isOwner(ctx)) {
    await ctx.reply("Not authorized.");
    return false;
  }
  return true;
}

function heartbeat(agent: Agent): void {
  agent.lastHeartbeat = Date.now();
}

function chooseModel(prompt: string, mode: ModelMode): { provider: "ollama" | "openai"; model: string } {
  const text = prompt.toLowerCase();

  if (mode === "local") {
    if (text.includes("code") || text.includes("website") || text.includes("debug")) {
      return { provider: "ollama", model: "qwen2.5-coder:7b" };
    }
    if (text.includes("reason") || text.includes("plan") || text.includes("strategy")) {
      return { provider: "ollama", model: "deepseek-r1:8b" };
    }
    return { provider: "ollama", model: DEFAULT_LOCAL_MODEL };
  }

  if (mode === "premium" && process.env.OPENAI_API_KEY) {
    return { provider: "openai", model: "gpt-4.1-mini" };
  }

  return { provider: "ollama", model: DEFAULT_LOCAL_MODEL };
}

async function runOllama(prompt: string, model: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "No local response.";
}

async function runOpenAI(prompt: string, model: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: prompt }),
  });
  if (!res.ok) throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { output_text?: string };
  return data.output_text ?? "No premium response.";
}

async function askAI(prompt: string, mode: ModelMode = "local"): Promise<string> {
  const selected = chooseModel(prompt, mode);
  if (selected.provider === "openai") return runOpenAI(prompt, selected.model);
  return runOllama(prompt, selected.model);
}

function buildAgentPrompt(agent: Agent): string {
  return `
You are ${agent.name}.

Goal:
${agent.goal}

Rules:
- Work toward useful, legal, money-producing outcomes.
- Do not spam people.
- Do not break platform rules.
- Prefer local/free tools first.
- Create practical outputs: code, ads, plans, scripts, funnels, automations.
- If something fails, try a simpler safe method.

Task:
Give the next useful action this agent should take today.
`.trim();
}

async function runAgent(agent: Agent): Promise<string | undefined> {
  if (agent.status !== "running") return;
  heartbeat(agent);
  const prompt = buildAgentPrompt(agent);
  const output = await askAI(prompt, agent.modelMode);
  console.log(`\n[${agent.name}]\n${output}`);
  return output;
}

// ---------- Telegram commands ----------

bot.start(async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  await ctx.reply(
    `Zenvy Agent Control online.

Commands:
/agents
/runall
/run <agent-id>
/stop <agent-id>
/startagent <agent-id>
/status
/ask <question>

Agents: ${agents.map((a) => a.id).join(", ")}`,
  );
});

bot.command("agents", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  const text = agents
    .map(
      (a) =>
        `${a.id}\nName: ${a.name}\nStatus: ${a.status}\nMode: ${a.modelMode}\nGoal: ${a.goal}\nHeartbeat: ${a.lastHeartbeat ? new Date(a.lastHeartbeat).toLocaleString() : "none"}`,
    )
    .join("\n\n");
  await ctx.reply(text);
});

bot.command("status", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  const running = agents.filter((a) => a.status === "running").length;
  const stopped = agents.filter((a) => a.status === "stopped").length;
  await ctx.reply(`Running: ${running}\nStopped: ${stopped}`);
});

bot.command("runall", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  await ctx.reply("Running all agents now.");
  for (const agent of agents) {
    try {
      const output = await runAgent(agent);
      if (output) await ctx.reply(`${agent.name} output:\n\n${output.slice(0, 3900)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`${agent.name} failed: ${msg}`);
    }
  }
});

bot.command("run", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  const id = ctx.message.text.split(" ")[1];
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    await ctx.reply("Agent not found.");
    return;
  }
  try {
    const output = await runAgent(agent);
    if (output) await ctx.reply(`${agent.name} output:\n\n${output.slice(0, 3900)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`${agent.name} failed: ${msg}`);
  }
});

bot.command("stop", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  const id = ctx.message.text.split(" ")[1];
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    await ctx.reply("Agent not found.");
    return;
  }
  agent.status = "stopped";
  await ctx.reply(`${agent.name} stopped.`);
});

bot.command("startagent", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  const id = ctx.message.text.split(" ")[1];
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    await ctx.reply("Agent not found.");
    return;
  }
  agent.status = "running";
  await ctx.reply(`${agent.name} started.`);
});

bot.command("ask", async (ctx) => {
  if (!(await ownerOnly(ctx))) return;
  const prompt = ctx.message.text.replace("/ask", "").trim();
  if (!prompt) {
    await ctx.reply("Send: /ask build me a landing page");
    return;
  }
  try {
    const answer = await askAI(prompt, "local");
    await ctx.reply(answer.slice(0, 3900));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`AI failed: ${msg}`);
  }
});

// ---------- Cron jobs ----------

cron.schedule("*/5 * * * *", async () => {
  console.log("Cron: running money agent.");
  const agent = agents.find((a) => a.id === "money-agent");
  if (agent) await runAgent(agent).catch((e) => console.error(e));
});

cron.schedule("*/10 * * * *", async () => {
  console.log("Cron: running ad agent.");
  const agent = agents.find((a) => a.id === "ad-agent");
  if (agent) await runAgent(agent).catch((e) => console.error(e));
});

cron.schedule("*/15 * * * *", async () => {
  console.log("Cron: running code agent.");
  const agent = agents.find((a) => a.id === "code-agent");
  if (agent) await runAgent(agent).catch((e) => console.error(e));
});

cron.schedule("*/2 * * * *", () => {
  for (const agent of agents) {
    if (agent.status === "running") heartbeat(agent);
  }
  console.log("Heartbeat updated.");
});

// ---------- launch + graceful shutdown ----------

bot.launch().then(() => console.log("Zenvy Telegram Agent System is running."));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
