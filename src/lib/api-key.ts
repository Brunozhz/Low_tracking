import crypto from "node:crypto";

import { db } from "@/lib/db";

export function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createApiKey() {
  const raw = `ltk_${crypto.randomBytes(24).toString("base64url")}`;
  return {
    raw,
    prefix: raw.slice(0, 12),
    secretHash: hashApiKey(raw),
  };
}

export async function getApiKeyContext(rawApiKey: string | null) {
  if (!rawApiKey) {
    return null;
  }

  const secretHash = hashApiKey(rawApiKey);

  const apiKey = await db.apiKey.findFirst({
    where: {
      secretHash,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      workspace: true,
      project: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}

