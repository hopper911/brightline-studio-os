/**
 * Bright Line Studio OS – approval store (Postgres via Prisma)
 *
 * Tracks pending approvals. Approve or reject actions.
 */

import { prisma } from "@/lib/prisma";
import { assertNotDemoMode } from "@/lib/runtime/demoGuard";

export type Approval = {
  id: string;
  workspaceId: string;
  actionType: string;
  room: string;
  status: "pending" | "approved" | "rejected";
  payloadJson: string | null;
  createdAt: string;
};

function nextId(): string {
  return `appr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type CreateApprovalInput = {
  actionType: string;
  room: string;
  payload: unknown;
  workspaceId?: string;
  projectId?: string | null;
};

export async function createApproval(input: CreateApprovalInput): Promise<Approval> {
  assertNotDemoMode("Creating approvals");
  const id = nextId();
  const createdAt = new Date();
  const payloadJson = JSON.stringify(input.payload ?? null);
  const wsId = input.workspaceId?.trim() ? input.workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");

  await prisma.approval.create({
    data: {
      id,
      workspaceId: wsId,
      actionType: input.actionType,
      room: input.room,
      projectId: input.projectId ?? null,
      status: "pending",
      payloadJson,
      createdAt,
    },
  });
  return {
    id,
    workspaceId: wsId,
    actionType: input.actionType,
    room: input.room,
    status: "pending",
    payloadJson,
    createdAt: createdAt.toISOString(),
  };
}

export async function getApprovalsByProject(projectId: string): Promise<Approval[]> {
  return getApprovalsByProjectForWorkspace(undefined, projectId);
}

export async function getApprovalsByProjectForWorkspace(
  workspaceId: string | undefined,
  projectId: string
): Promise<Approval[]> {
  const wsId = workspaceId?.trim() ? workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");
  const rows = await prisma.approval.findMany({
    where: { workspaceId: wsId, projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, workspaceId: true, actionType: true, room: true, status: true, payloadJson: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    actionType: r.actionType,
    room: r.room,
    status: r.status as Approval["status"],
    payloadJson: r.payloadJson ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPendingApprovals(): Promise<Approval[]> {
  return getPendingApprovalsForWorkspace(undefined);
}

export async function getPendingApprovalsForWorkspace(workspaceId: string | undefined): Promise<Approval[]> {
  const wsId = workspaceId?.trim() ? workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");
  const rows = await prisma.approval.findMany({
    where: { workspaceId: wsId, status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true, workspaceId: true, actionType: true, room: true, status: true, payloadJson: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    actionType: r.actionType,
    room: r.room,
    status: r.status as Approval["status"],
    payloadJson: r.payloadJson ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function approveAction(id: string): Promise<Approval | null> {
  assertNotDemoMode("Approving actions");
  return approveActionForWorkspace(undefined, id);
}

export async function approveActionForWorkspace(workspaceId: string | undefined, id: string): Promise<Approval | null> {
  assertNotDemoMode("Approving actions");
  const wsId = workspaceId?.trim() ? workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");
  const updated = await prisma.approval.updateMany({ where: { workspaceId: wsId, id, status: "pending" }, data: { status: "approved" } });
  if (updated.count === 0) return null;
  const row = await prisma.approval.findFirst({
    where: { workspaceId: wsId, id },
    select: { id: true, workspaceId: true, actionType: true, room: true, status: true, payloadJson: true, createdAt: true },
  });
  return row
    ? {
        id: row.id,
        workspaceId: row.workspaceId,
        actionType: row.actionType,
        room: row.room,
        status: row.status as Approval["status"],
        payloadJson: row.payloadJson ?? null,
        createdAt: row.createdAt.toISOString(),
      }
    : null;
}

export async function rejectAction(id: string): Promise<Approval | null> {
  assertNotDemoMode("Rejecting actions");
  return rejectActionForWorkspace(undefined, id);
}

export async function rejectActionForWorkspace(workspaceId: string | undefined, id: string): Promise<Approval | null> {
  assertNotDemoMode("Rejecting actions");
  const wsId = workspaceId?.trim() ? workspaceId : null;
  if (!wsId) throw new Error("workspaceId_required");
  const updated = await prisma.approval.updateMany({ where: { workspaceId: wsId, id, status: "pending" }, data: { status: "rejected" } });
  if (updated.count === 0) return null;
  const row = await prisma.approval.findFirst({
    where: { workspaceId: wsId, id },
    select: { id: true, workspaceId: true, actionType: true, room: true, status: true, payloadJson: true, createdAt: true },
  });
  return row
    ? {
        id: row.id,
        workspaceId: row.workspaceId,
        actionType: row.actionType,
        room: row.room,
        status: row.status as Approval["status"],
        payloadJson: row.payloadJson ?? null,
        createdAt: row.createdAt.toISOString(),
      }
    : null;
}
