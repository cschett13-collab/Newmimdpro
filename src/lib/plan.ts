// Pre-market plan storage. Local-only (browser localStorage).
// Plans are pre-committed setups: market, thesis, entry trigger, stop,
// target, max stake. The alert bot consumes the same data via export.

export type PlanType = "polymarket" | "stock";
export type PlanDirection = "above" | "below";
export type PlanStatus = "pending" | "staged" | "executed" | "skipped";

export type PlanRow = {
  id: string;
  date: string; // YYYY-MM-DD
  type: PlanType;
  symbol: string; // ticker for stock, slug for polymarket
  outcome: string; // YES/NO for polymarket, ignored for stock
  thesis: string;
  trigger: PlanDirection;
  triggerPrice: number;
  stop: number;
  target: number;
  maxStake: number;
  status: PlanStatus;
  stagedAt: number | null; // ms when stage timer started
  createdAt: number;
};

export type PlanState = {
  plans: PlanRow[];
};

export const PLAN_STORAGE_KEY = "fvce_pm_plan_v1";
export const STAGE_TIMER_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_PLAN_STATE: PlanState = { plans: [] };

export function loadPlans(): PlanState {
  if (typeof window === "undefined") return DEFAULT_PLAN_STATE;
  try {
    const raw = window.localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN_STATE;
    const parsed = JSON.parse(raw) as Partial<PlanState>;
    return { plans: Array.isArray(parsed.plans) ? parsed.plans : [] };
  } catch {
    return DEFAULT_PLAN_STATE;
  }
}

export function savePlans(state: PlanState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(state));
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newPlanId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function timeRemaining(stagedAt: number | null): number {
  if (!stagedAt) return 0;
  return Math.max(0, STAGE_TIMER_MS - (Date.now() - stagedAt));
}

export function isStaged(p: PlanRow): boolean {
  return p.status === "staged" && timeRemaining(p.stagedAt) > 0;
}

export function isUnlocked(p: PlanRow): boolean {
  return p.status === "staged" && timeRemaining(p.stagedAt) === 0;
}

export type AlertConfig = {
  type: PlanType;
  slug?: string;
  symbol?: string;
  outcome?: string;
  above?: number;
  below?: number;
  label: string;
};

export function plansToAlerts(plans: PlanRow[]): AlertConfig[] {
  return plans
    .filter((p) => p.status === "pending" || p.status === "staged")
    .map((p) => {
      const base: AlertConfig = {
        type: p.type,
        label: planLabel(p),
      };
      if (p.type === "polymarket") {
        base.slug = p.symbol;
        base.outcome = p.outcome || "Yes";
      } else {
        base.symbol = p.symbol;
      }
      if (p.trigger === "above") base.above = p.triggerPrice;
      else base.below = p.triggerPrice;
      return base;
    });
}

export function planLabel(p: PlanRow): string {
  const dir = p.trigger === "above" ? "↑" : "↓";
  if (p.type === "polymarket") {
    return `${p.symbol} ${p.outcome} ${dir} ${(p.triggerPrice * 100).toFixed(0)}¢`;
  }
  return `${p.symbol} ${dir} $${p.triggerPrice}`;
}
