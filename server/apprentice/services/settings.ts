import { eq } from "drizzle-orm";

import { thresholdsFor, type Thresholds } from "../engine/trust.js";
import { getDb, schema } from "../../db/index.js";
import type { Scope } from "./core.js";

export type ApprenticeSettings = {
  watchMode: boolean;
  minSupport: number;
  demoMode: boolean;
  githubRepo: string | null;
  thresholds: Thresholds;
};

export async function getSettings(scope: Scope): Promise<ApprenticeSettings> {
  const [row] = await getDb()
    .select()
    .from(schema.apprenticeSettings)
    .where(eq(schema.apprenticeSettings.ownerEmail, scope.ownerEmail))
    .limit(1);
  const demoMode = row ? row.demoMode === 1 : true;
  return {
    watchMode: row ? row.watchMode === 1 : true,
    minSupport: row?.minSupport ?? 2,
    demoMode,
    githubRepo: row?.githubRepo ?? null,
    thresholds: thresholdsFor(demoMode),
  };
}

export async function updateSettings(
  scope: Scope,
  patch: Partial<{ watchMode: boolean; minSupport: number; demoMode: boolean; githubRepo: string | null }>,
): Promise<ApprenticeSettings> {
  const current = await getSettings(scope);
  const next = { ...current, ...patch };
  const values = {
    ownerEmail: scope.ownerEmail,
    orgId: scope.orgId,
    watchMode: next.watchMode ? 1 : 0,
    minSupport: next.minSupport,
    demoMode: next.demoMode ? 1 : 0,
    githubRepo: next.githubRepo,
    updatedAt: Date.now(),
  };
  await getDb()
    .insert(schema.apprenticeSettings)
    .values(values)
    .onConflictDoUpdate({ target: schema.apprenticeSettings.ownerEmail, set: values });
  return getSettings(scope);
}
