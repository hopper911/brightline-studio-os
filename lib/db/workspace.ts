import "server-only";

import { prisma } from "@/lib/prisma";

export async function resolveWorkspaceId(explicit?: string): Promise<string> {
  if (explicit && explicit.trim()) return explicit;
  const row = await prisma.workspace.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!row?.id) {
    throw new Error("No workspace exists. Database bootstrap did not run.");
  }
  return row.id;
}

