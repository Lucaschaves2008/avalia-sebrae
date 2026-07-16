import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EvaluationProcess, ProcessInput, ProcessScope, ProcessStatus } from "./processes";

type DbProcess = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  scope: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapProcess(r: DbProcess, courseMap: Map<string, string[]>): EvaluationProcess {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    startDate: r.start_date,
    endDate: r.end_date,
    scope: r.scope as ProcessScope,
    status: r.status as ProcessStatus,
    courseIds: courseMap.get(r.id) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Apenas administradores podem gerenciar processos.");
}

export const listProcessesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [pRes, pcRes] = await Promise.all([
      context.supabase
        .from("evaluation_processes")
        .select("*")
        .order("created_at", { ascending: false }),
      context.supabase.from("evaluation_process_courses").select("process_id, course_id"),
    ]);
    if (pRes.error) throw new Error(pRes.error.message);
    if (pcRes.error) throw new Error(pcRes.error.message);

    const courseMap = new Map<string, string[]>();
    for (const r of (pcRes.data ?? []) as { process_id: string; course_id: string }[]) {
      const arr = courseMap.get(r.process_id) ?? [];
      arr.push(r.course_id);
      courseMap.set(r.process_id, arr);
    }

    return ((pRes.data ?? []) as DbProcess[]).map((r) => mapProcess(r, courseMap));
  });

export const upsertProcessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProcessInput) => input)
  .handler(async ({ data: input, context }) => {
    await requireAdmin(context);
    if (!input.name.trim()) throw new Error("Informe o nome do processo.");
    if (!input.startDate || !input.endDate) throw new Error("Informe o período de avaliação.");
    if (input.endDate < input.startDate) throw new Error("A data final deve ser maior ou igual à inicial.");

    const row = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      start_date: input.startDate,
      end_date: input.endDate,
      scope: input.scope,
      status: input.status,
    };

    let processId = input.id;
    if (processId) {
      const { error } = await context.supabase.from("evaluation_processes").update(row).eq("id", processId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await context.supabase
        .from("evaluation_processes")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      processId = (data as { id: string }).id;
    }

    const { data: existing, error: existingErr } = await context.supabase
      .from("evaluation_process_courses")
      .select("course_id")
      .eq("process_id", processId);
    if (existingErr) throw new Error(existingErr.message);

    const have = new Set(((existing ?? []) as { course_id: string }[]).map((r) => r.course_id));
    const want = new Set(input.courseIds);
    const toAdd = [...want].filter((c) => !have.has(c));
    const toRemove = [...have].filter((c) => !want.has(c));

    if (toAdd.length) {
      const { error } = await context.supabase
        .from("evaluation_process_courses")
        .insert(toAdd.map((course_id) => ({ process_id: processId!, course_id })));
      if (error) throw new Error(error.message);
    }
    if (toRemove.length) {
      const { error } = await context.supabase
        .from("evaluation_process_courses")
        .delete()
        .eq("process_id", processId!)
        .in("course_id", toRemove);
      if (error) throw new Error(error.message);
    }

    return { processId };
  });

export const deleteProcessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { count, error: countErr } = await context.supabase
      .from("judgments")
      .select("id", { count: "exact", head: true })
      .eq("process_id", data.id);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) throw new Error("Este processo possui avaliações registradas e não pode ser excluído.");

    const { error: linkErr } = await context.supabase
      .from("evaluation_process_courses")
      .delete()
      .eq("process_id", data.id);
    if (linkErr) throw new Error(linkErr.message);

    const { error } = await context.supabase.from("evaluation_processes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
