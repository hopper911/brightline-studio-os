import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/db/workspace";
import { isVercelVisualOnly } from "@/lib/runtime/vercel";

export type PhotographyType = "architecture" | "real_estate" | "corporate" | "events" | "mixed";
export type MainGoal = "get_more_clients" | "streamline_workflow" | "scale_business";

export type WorkspaceProfile = {
  workspaceId: string;
  photographyType: PhotographyType | null;
  servicesOffered: string[];
  mainLocation: string | null;
  mainGoal: MainGoal | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertWorkspaceProfileInput = {
  photographyType: PhotographyType;
  servicesOffered: string[];
  mainLocation: string;
  mainGoal: MainGoal;
  workspaceId?: string;
};

function safeParseStringArray(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

function safeParseMainGoal(value: unknown): MainGoal | null {
  if (value === "get_more_clients" || value === "streamline_workflow" || value === "scale_business") return value;
  return null;
}

function safeParsePhotoType(value: unknown): PhotographyType | null {
  if (value === "architecture" || value === "real_estate" || value === "corporate" || value === "events" || value === "mixed") {
    return value;
  }
  return null;
}

function rowToProfile(row: Record<string, unknown>): WorkspaceProfile {
  const goals = safeParseStringArray(row.goalsJson);
  return {
    workspaceId: row.workspaceId as string,
    photographyType: safeParsePhotoType(row.businessType),
    servicesOffered: safeParseStringArray(row.servicesJson),
    mainLocation: (row.mainLocation as string | null) ?? null,
    mainGoal: safeParseMainGoal(goals[0]),
    createdAt: row.createdAt as string,
    updatedAt: (row.updatedAt as string) ?? (row.createdAt as string),
  };
}

export function getWorkspaceProfile(workspaceId?: string): WorkspaceProfile | null {
  throw new Error("getWorkspaceProfile() is synchronous but Postgres access is async; use getWorkspaceProfileAsync().");
}

export function hasWorkspaceProfile(workspaceId?: string): boolean {
  throw new Error("hasWorkspaceProfile() is synchronous but Postgres access is async; use hasWorkspaceProfileAsync().");
}

export function upsertWorkspaceProfile(input: UpsertWorkspaceProfileInput): WorkspaceProfile {
  throw new Error("upsertWorkspaceProfile() is synchronous but Postgres access is async; use upsertWorkspaceProfileAsync().");
}

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString() : new Date(0).toISOString();
}

export async function getWorkspaceProfileAsync(workspaceId?: string): Promise<WorkspaceProfile | null> {
  if (isVercelVisualOnly()) return null;
  const wsId = await resolveWorkspaceId(workspaceId);
  const row = await prisma.workspaceProfile.findFirst({
    where: { workspaceId: wsId },
    select: {
      workspaceId: true,
      businessType: true,
      servicesOfferedJson: true,
      mainLocation: true,
      goalsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return null;
  return rowToProfile({
    workspaceId: row.workspaceId,
    businessType: row.businessType,
    servicesJson: row.servicesOfferedJson,
    mainLocation: row.mainLocation,
    goalsJson: row.goalsJson,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export async function hasWorkspaceProfileAsync(workspaceId?: string): Promise<boolean> {
  if (isVercelVisualOnly()) return true;
  const wsId = await resolveWorkspaceId(workspaceId);
  const row = await prisma.workspaceProfile.findFirst({ where: { workspaceId: wsId }, select: { workspaceId: true } });
  return Boolean(row?.workspaceId);
}

export async function upsertWorkspaceProfileAsync(input: UpsertWorkspaceProfileInput): Promise<WorkspaceProfile> {
  const wsId = await resolveWorkspaceId(input.workspaceId);
  const now = new Date();
  const services = input.servicesOffered.map((s) => s.trim()).filter(Boolean);
  const goalsJson = JSON.stringify([input.mainGoal]);
  const servicesJson = JSON.stringify(services);

  await prisma.workspaceProfile.upsert({
    where: { workspaceId: wsId },
    create: {
      workspaceId: wsId,
      businessType: input.photographyType,
      servicesOfferedJson: servicesJson,
      mainLocation: input.mainLocation.trim(),
      goalsJson,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      businessType: input.photographyType,
      servicesOfferedJson: servicesJson,
      mainLocation: input.mainLocation.trim(),
      goalsJson,
      updatedAt: now,
    },
  });

  const out = await getWorkspaceProfileAsync(wsId);
  if (!out) throw new Error("Failed to upsert workspace profile");
  return out;
}

export function getWorkspaceProfileContextString(profile: WorkspaceProfile | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.photographyType) parts.push(`Photography type: ${profile.photographyType.replace(/_/g, " ")}`);
  if (profile.mainLocation) parts.push(`Location: ${profile.mainLocation}`);
  if (profile.mainGoal) parts.push(`Primary goal: ${profile.mainGoal.replace(/_/g, " ")}`);
  if (profile.servicesOffered.length > 0) parts.push(`Services offered: ${profile.servicesOffered.slice(0, 8).join(", ")}`);
  return parts.join(". ");
}

