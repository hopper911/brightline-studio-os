import "server-only";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { isVercelVisualOnly } from "@/lib/runtime/vercel";
import { prisma } from "@/lib/prisma";

function dlog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch("http://127.0.0.1:7674/ingest/e84bcaee-662b-4bc9-adef-7852b493a49d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bb0f56" },
    body: JSON.stringify({
      sessionId: "bb0f56",
      runId: "prod-crash-ssr",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log
}

/** Lazy — avoids loading better-sqlite3 until needed (Vercel dashboard never calls). */
function getDbLazy(): ReturnType<typeof import("@/lib/db").getDb> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDb } = require("@/lib/db") as typeof import("@/lib/db");
  return getDb();
}

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceContext = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
};

const COOKIE_WORKSPACE = "bl_workspace_id";
const COOKIE_USER = "bl_user_id";

function nextWorkspaceId(): string {
  return `ws-${randomUUID()}`;
}

function nextUserId(): string {
  return `usr-${randomUUID()}`;
}

function normalizeRole(value: unknown): WorkspaceRole {
  if (value === "owner" || value === "admin" || value === "member") return value;
  return "member";
}

async function readCookieIds(): Promise<{ workspaceId: string | null; userId: string | null }> {
  const jar = await cookies();
  const workspaceId = jar.get(COOKIE_WORKSPACE)?.value ?? null;
  const userId = jar.get(COOKIE_USER)?.value ?? null;
  dlog("H_cookie", "lib/auth/workspaceContext.ts:readCookieIds", "cookie_ids", {
    hasWorkspaceId: Boolean(workspaceId),
    hasUserId: Boolean(userId),
  });
  return { workspaceId, userId };
}

function ensureBootstrapWorkspaceAndUser(): WorkspaceContext {
  throw new Error("ensureBootstrapWorkspaceAndUser is not supported in Postgres mode; use ensureBootstrapWorkspaceAndUserAsync()");
}

async function ensureBootstrapWorkspaceAndUserAsync(): Promise<WorkspaceContext> {
  const existing = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, ownerId: true, owner: { select: { role: true } } },
  });

  if (existing?.id && existing.ownerId) {
    return { workspaceId: existing.id, userId: existing.ownerId, role: normalizeRole(existing.owner?.role) };
  }

  const now = new Date();
  const workspaceId = nextWorkspaceId();
  const userId = nextUserId();

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "Default Workspace",
      ownerId: userId,
      planId: "starter",
      createdAt: now,
      users: {
        create: {
          id: userId,
          email: "owner@local",
          role: "owner",
          createdAt: now,
        },
      },
      settings: { create: { aiMode: "local", createdAt: now, updatedAt: now } },
      planLimits: {
        create: {
          plan: "free",
          maxProjects: 10,
          maxDrafts: 200,
          maxActiveAutomations: 3,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  });

  return { workspaceId, userId, role: "owner" };
}

async function validateContextFromDb(params: { workspaceId: string; userId: string }): Promise<WorkspaceContext | null> {
  const row = await prisma.user.findFirst({
    where: { id: params.userId },
    select: { id: true, role: true, workspaceId: true },
  });

  if (!row?.id) return null;
  if (row.workspaceId !== params.workspaceId) return null;

  return { workspaceId: params.workspaceId, userId: params.userId, role: normalizeRole(row.role) };
}

const VERCEL_SYNTHETIC_CTX: WorkspaceContext = {
  workspaceId: "vercel-visual",
  userId: "vercel-user",
  role: "owner",
};

/**
 * Returns the active workspace context, creating a default workspace/user and
 * setting cookies if none exist.
 */
export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  dlog("H_entry", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "enter", {
    vercelVisualOnly: isVercelVisualOnly(),
  });
  if (isVercelVisualOnly()) {
    // Do not call cookies().set() here — Server Components cannot mutate cookies (Next.js 15).
    return VERCEL_SYNTHETIC_CTX;
  }

  const { auth } = await import("@/lib/auth/auth");
  let session: Awaited<ReturnType<typeof auth>> | null = null;
  try {
    session = await auth();
  } catch (err) {
    dlog("H_auth", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "auth_throw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const sessionUser = session?.user;
  if (sessionUser?.id && sessionUser.workspaceId) {
    const ctx: WorkspaceContext = {
      workspaceId: sessionUser.workspaceId,
      userId: sessionUser.id,
      role: normalizeRole(sessionUser.role),
    };
    // Do not call cookies().set() here — requireWorkspaceContext runs from Server Components.
    // Use ensureWorkspaceContextCookies() from a Server Action if you need to sync cookies.
    dlog("H_auth", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "auth_ctx", {
      hasUserId: true,
      hasWorkspaceId: true,
      role: ctx.role,
    });
    return ctx;
  }

  const { workspaceId, userId } = await readCookieIds();
  if (workspaceId && userId) {
    try {
      const ctx = await validateContextFromDb({ workspaceId, userId });
      if (ctx) {
        dlog("H_db", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "cookie_ctx_valid", { ok: true });
        return ctx;
      }
      dlog("H_db", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "cookie_ctx_invalid", { ok: false });
    } catch (err) {
      dlog("H_db", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "validate_throw", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let boot: WorkspaceContext;
  try {
    boot = await ensureBootstrapWorkspaceAndUserAsync();
    dlog("H_bootstrap", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "bootstrap_ok", { ok: true });
  } catch (err) {
    dlog("H_bootstrap", "lib/auth/workspaceContext.ts:requireWorkspaceContext", "bootstrap_throw", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  return boot;
}
