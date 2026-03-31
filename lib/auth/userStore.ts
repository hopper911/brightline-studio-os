import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isVercelVisualOnly } from "@/lib/runtime/vercel";

export type DbUser = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  workspaceId: string;
};

function nextWorkspaceId(): string {
  return `ws-${randomUUID()}`;
}

function nextUserId(): string {
  return `usr-${randomUUID()}`;
}

function normalizeRole(value: unknown): DbUser["role"] {
  if (value === "owner" || value === "admin" || value === "member") return value;
  return "member";
}

export async function getOrCreateUserByEmail(email: string): Promise<DbUser> {
  if (isVercelVisualOnly()) {
    const normalized = email.trim().toLowerCase();
    return {
      id: "vercel-user",
      email: normalized,
      role: "owner",
      workspaceId: "vercel-visual",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true, workspaceId: true },
  });

  if (existing?.id) {
    return {
      id: existing.id,
      email: existing.email,
      role: normalizeRole(existing.role),
      workspaceId: existing.workspaceId,
    };
  }

  const now = new Date();
  const workspaceId = nextWorkspaceId();
  const userId = nextUserId();

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "My Studio",
      ownerId: userId,
      planId: "starter",
      createdAt: now,
      users: {
        create: {
          id: userId,
          email: normalizedEmail,
          role: "owner",
          createdAt: now,
        },
      },
      settings: {
        create: { aiMode: "local", createdAt: now, updatedAt: now },
      },
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

  return { id: userId, email: normalizedEmail, role: "owner", workspaceId };
}

