import type { Creator } from "./types.js";

export function createCreatorDraft(profileUrl: string): Creator {
  const now = new Date().toISOString();

  return {
    id: deriveCreatorId(profileUrl),
    platform: "xhs",
    nickname: "未命名博主",
    profileUrl,
    collectedAt: now,
    lastSyncedAt: now
  };
}

export function deriveCreatorId(profileUrl: string): string {
  const normalized = profileUrl.trim().replace(/\/$/, "");
  const lastSegment = normalized.split("/").filter(Boolean).at(-1);

  if (lastSegment) {
    return sanitizeId(lastSegment);
  }

  return `creator-${Date.now()}`;
}

export function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

