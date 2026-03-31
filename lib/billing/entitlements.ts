import "server-only";

import { prisma } from "@/lib/prisma";
import { isVercelVisualOnly } from "@/lib/runtime/vercel";

export type FeatureKey = "automation" | "advancedAgents" | "analytics";

export type Entitlements = Record<FeatureKey, boolean> & {
  // Future-proofing: allow numeric limits later without schema changes
  maxProjects?: number;
  maxSeats?: number;
};

export type Plan = {
  id: string;
  name: string;
  price: number;
  limits: Entitlements;
};

const DEFAULT_PLAN_ID = "starter";

function safeParseLimits(value: unknown): Entitlements {
  if (typeof value !== "string" || !value.trim()) {
    return { automation: false, advancedAgents: false, analytics: false };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { automation: false, advancedAgents: false, analytics: false };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      automation: obj.automation === true,
      advancedAgents: obj.advancedAgents === true,
      analytics: obj.analytics === true,
      maxProjects: typeof obj.maxProjects === "number" ? obj.maxProjects : undefined,
      maxSeats: typeof obj.maxSeats === "number" ? obj.maxSeats : undefined,
    };
  } catch {
    return { automation: false, advancedAgents: false, analytics: false };
  }
}

const VERCEL_SYNTHETIC_WORKSPACE = {
  id: "vercel-visual",
  name: "Vercel Visual",
  ownerId: "vercel-user",
  planId: DEFAULT_PLAN_ID,
};

export function getWorkspace(): { id: string; name: string; ownerId: string; planId: string } {
  if (isVercelVisualOnly()) return VERCEL_SYNTHETIC_WORKSPACE;

  throw new Error("getWorkspace() is synchronous but Postgres access is async; use getWorkspaceAsync().");
}

export async function getWorkspaceAsync(): Promise<{ id: string; name: string; ownerId: string; planId: string }> {
  if (isVercelVisualOnly()) return VERCEL_SYNTHETIC_WORKSPACE;
  const row = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, ownerId: true, planId: true },
  });
  if (!row) {
    // Bootstrapping should create one, but keep a safe fallback.
    const workspaceId = `ws-${Date.now()}`;
    const ownerId = `usr-${Date.now()}`;
    const now = new Date();
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: "Default Workspace",
        ownerId,
        planId: DEFAULT_PLAN_ID,
        createdAt: now,
        users: { create: { id: ownerId, email: "owner@local", role: "owner", createdAt: now } },
      },
    });
    return { id: workspaceId, name: "Default Workspace", ownerId, planId: DEFAULT_PLAN_ID };
  }
  return { ...row, planId: row.planId || DEFAULT_PLAN_ID };
}

export function getWorkspacePlan(): Plan {
  if (isVercelVisualOnly()) {
    return {
      id: DEFAULT_PLAN_ID,
      name: "Starter",
      price: 0,
      limits: safeParseLimits(""),
    };
  }

  throw new Error("getWorkspacePlan() is synchronous but Postgres access is async; use getWorkspacePlanAsync().");
}

export async function getWorkspacePlanAsync(): Promise<Plan> {
  if (isVercelVisualOnly()) {
    return { id: DEFAULT_PLAN_ID, name: "Starter", price: 0, limits: safeParseLimits("") };
  }

  const workspace = await getWorkspaceAsync();
  const planRow = await prisma.plan.findFirst({
    where: { id: workspace.planId },
    select: { id: true, name: true, price: true, limitsJson: true },
  });
  const fallbackRow = planRow
    ? null
    : await prisma.plan.findFirst({
        where: { id: DEFAULT_PLAN_ID },
        select: { id: true, name: true, price: true, limitsJson: true },
      });
  const row = planRow ?? fallbackRow;
  if (!row) return { id: DEFAULT_PLAN_ID, name: "Starter", price: 0, limits: safeParseLimits("") };
  return { id: row.id, name: row.name, price: row.price, limits: safeParseLimits(row.limitsJson) };
}

export function getEntitlements(): Entitlements {
  throw new Error("getEntitlements() is synchronous but Postgres access is async; use getEntitlementsAsync().");
}

export async function getEntitlementsAsync(): Promise<Entitlements> {
  const plan = await getWorkspacePlanAsync();
  return plan.limits;
}

export function assertEntitled(feature: FeatureKey): void {
  throw new Error("assertEntitled() is synchronous but Postgres access is async; use assertEntitledAsync().");
}

export async function assertEntitledAsync(feature: FeatureKey): Promise<void> {
  const entitlements = await getEntitlementsAsync();
  if (!entitlements[feature]) throw new Error("upgrade_required");
}

