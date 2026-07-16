import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Judgment } from "./judgments";
import {
  deleteJudgmentForUser,
  listJudgmentsForUser,
  upsertJudgmentForUser,
} from "./judgments.server";

export const listJudgmentsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listJudgmentsForUser(context));

export const upsertJudgmentServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Omit<Judgment, "id" | "createdAt" | "updatedAt"> & { id?: string }) => input)
  .handler(async ({ data: input, context }) => upsertJudgmentForUser(context, input));

export const deleteJudgmentServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string; userId: string }) => input)
  .handler(async ({ data, context }) => {
    await deleteJudgmentForUser(context, data.courseId, data.userId);
    return { ok: true as const };
  });
