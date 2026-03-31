import "server-only";

import { cookies } from "next/headers";
import { requireWorkspaceContext, type WorkspaceContext } from "@/lib/auth/workspaceContext";

const COOKIE_WORKSPACE = "bl_workspace_id";
const COOKIE_USER = "bl_user_id";

async function setCookieIds(params: { workspaceId: string; userId: string }): Promise<void> {
  const jar = await cookies();
  const base = { httpOnly: true, sameSite: "lax" as const, path: "/" };
  jar.set(COOKIE_WORKSPACE, params.workspaceId, base);
  jar.set(COOKIE_USER, params.userId, base);
}

/**
 * Explicitly re-selects (or initializes) workspace context and sets cookies.
 *
 * IMPORTANT: Only call from a Server Action or Route Handler.
 */
export async function ensureWorkspaceContextCookies(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspaceContext();
  await setCookieIds({ workspaceId: ctx.workspaceId, userId: ctx.userId });
  return ctx;
}

