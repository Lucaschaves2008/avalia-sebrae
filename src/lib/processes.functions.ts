import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProcessInput } from "./processes";
import {
  deleteProcessForAdmin,
  listProcessesForUser,
  upsertProcessForAdmin,
} from "./processes.server";

export const listProcessesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listProcessesForUser(context));

export const upsertProcessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProcessInput) => input)
  .handler(async ({ data: input, context }) => upsertProcessForAdmin(context, input));

export const deleteProcessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await deleteProcessForAdmin(context, data.id);
    return { ok: true as const };
  });
