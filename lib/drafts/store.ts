/**
 * Bright Line Studio OS – draft store (Postgres via Prisma)
 *
 * Persists drafts to Postgres.
 */

import { prisma } from "@/lib/prisma";
import { assertNotDemoMode } from "@/lib/runtime/demoGuard";
import { trackUsage } from "@/lib/usage/track";

export type Draft = {
  id: string;
  type: string;
  room: string;
  content: string;
  createdAt: string;
  projectId?: string;
};

function nextId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type SaveDraftInput = {
  type: string;
  room: string;
  content: string;
  projectId?: string;
  workspaceId?: string;
  userId?: string;
};

export async function saveDraft(input: SaveDraftInput): Promise<Draft> {
  assertNotDemoMode("Saving drafts");
  const id = nextId();
  const createdAt = new Date();
  const wsId = input.workspaceId?.trim() ? input.workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");

  await prisma.draft.create({
    data: {
      id,
      workspaceId: wsId,
      projectId: input.projectId ?? null,
      room: input.room,
      draftType: input.type,
      content: input.content,
      createdAt,
    },
  });

  trackUsage({
    workspaceId: wsId,
    userId: input.userId,
    eventType: "drafts_generated",
    quantity: 1,
    meta: { room: input.room, draftType: input.type, projectId: input.projectId ?? null },
  });
  return { id, createdAt: createdAt.toISOString(), projectId: input.projectId, ...input };
}

export async function getDrafts(room?: string, projectId?: string): Promise<Draft[]> {
  return getDraftsForWorkspace(undefined, room, projectId);
}

export async function getDraftsForWorkspace(
  workspaceId: string | undefined,
  room?: string,
  projectId?: string
): Promise<Draft[]> {
  const wsId = workspaceId?.trim() ? workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");
  const rows = await prisma.draft.findMany({
    where: { workspaceId: wsId, ...(room ? { room } : {}), ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, projectId: true, room: true, draftType: true, content: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.draftType,
    room: r.room,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    projectId: r.projectId ?? undefined,
  }));
}
