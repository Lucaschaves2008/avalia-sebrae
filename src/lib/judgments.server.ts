import type { Region } from "./auth";
import type { Judgment, JudgmentDecision, JudgmentPriority } from "./judgments";

type DbJudgment = {
  id: string;
  process_id: string;
  course_id: string;
  user_id: string;
  region: string;
  decision: string;
  updates_required: string | null;
  priority: string | null;
  notes: string;
  updated_at: string;
};

type DbProfile = { id: string; name: string; email: string };

const DECISION_TO_DB: Record<JudgmentDecision, string> = {
  MANTIDO: "MANTIDO",
  ATUALIZADO: "ATUALIZADO",
  INATIVACAO: "INATIVAÇÃO",
};

const DB_TO_DECISION: Record<string, JudgmentDecision> = {
  MANTIDO: "MANTIDO",
  ATUALIZADO: "ATUALIZADO",
  "INATIVAÇÃO": "INATIVACAO",
};

function mapRow(row: DbJudgment, profilesById: Map<string, DbProfile>): Judgment {
  const p = profilesById.get(row.user_id);
  return {
    id: row.id,
    processId: row.process_id,
    courseId: row.course_id,
    userId: row.user_id,
    userName: p?.name ?? "",
    userEmail: p?.email ?? "",
    region: row.region as Region,
    decision: DB_TO_DECISION[row.decision] ?? "MANTIDO",
    updatesNeeded: row.updates_required ?? undefined,
    priority: (row.priority ?? null) as JudgmentPriority | null,
    reason: row.notes,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  };
}

async function assertCanModifyJudgment(
  context: { supabase: any; userId: string },
  targetUserId: string,
  action: "registrar" | "excluir",
) {
  if (targetUserId === context.userId) return;
  const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (roleErr) throw new Error(roleErr.message);
  if (!isAdmin) throw new Error(`Você só pode ${action} sua própria avaliação.`);
}

export async function listJudgmentsForUser(context: { supabase: any }) {
  const [judgRes, profRes] = await Promise.all([
    context.supabase.from("judgments").select("*"),
    context.supabase.from("profiles").select("id, name, email"),
  ]);
  if (judgRes.error) throw new Error(judgRes.error.message);
  if (profRes.error) throw new Error(profRes.error.message);

  const profilesById = new Map<string, DbProfile>();
  for (const p of (profRes.data ?? []) as DbProfile[]) profilesById.set(p.id, p);
  return ((judgRes.data ?? []) as DbJudgment[]).map((r) => mapRow(r, profilesById));
}

export async function upsertJudgmentForUser(
  context: { supabase: any; userId: string },
  input: Omit<Judgment, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  await assertCanModifyJudgment(context, input.userId, "registrar");
  if (input.decision === "ATUALIZADO" && !input.updatesNeeded?.trim()) {
    throw new Error("Por favor, descreva quais as atualizações necessárias para este curso.");
  }

  const row = {
    process_id: input.processId,
    course_id: input.courseId,
    user_id: input.userId,
    region: input.region,
    decision: DECISION_TO_DB[input.decision],
    updates_required: input.updatesNeeded ?? null,
    priority: input.priority,
    notes: input.reason,
  };

  const { data, error } = await context.supabase
    .from("judgments")
    .upsert(row, { onConflict: "process_id,course_id,user_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: (data as DbJudgment).id,
    processId: input.processId,
    courseId: input.courseId,
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    region: input.region,
    decision: input.decision,
    updatesNeeded: input.updatesNeeded,
    priority: input.priority,
    reason: input.reason,
    createdAt: (data as DbJudgment).updated_at,
    updatedAt: (data as DbJudgment).updated_at,
  } satisfies Judgment;
}

export async function deleteJudgmentForUser(
  context: { supabase: any; userId: string },
  courseId: string,
  userId: string,
) {
  await assertCanModifyJudgment(context, userId, "excluir");
  const { error } = await context.supabase
    .from("judgments")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
