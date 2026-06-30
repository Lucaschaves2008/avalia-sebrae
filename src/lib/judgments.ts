import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Region } from "./auth";

export type JudgmentDecision = "MANTIDO" | "ATUALIZADO" | "INATIVACAO";
export type JudgmentPriority = "Alta" | "Média" | "Baixa";

export interface Judgment {
  id: string;
  processId: string;
  courseId: string;
  userId: string;
  userName: string;
  userEmail: string;
  region: Region;
  decision: JudgmentDecision;
  updatesNeeded?: string;
  priority: JudgmentPriority | null;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export const DECISION_LABELS: Record<JudgmentDecision, string> = {
  MANTIDO: "Mantido",
  ATUALIZADO: "Mantido com atualizações",
  INATIVACAO: "Inativação",
};

export const DECISION_STYLES: Record<JudgmentDecision, string> = {
  MANTIDO: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ATUALIZADO: "border-amber-300 bg-amber-50 text-amber-800",
  INATIVACAO: "border-rose-300 bg-rose-50 text-rose-800",
};

export const PRIORITY_STYLES: Record<JudgmentPriority, string> = {
  Alta: "border-rose-300 bg-rose-50 text-rose-800",
  Média: "border-amber-300 bg-amber-50 text-amber-800",
  Baixa: "border-sky-300 bg-sky-50 text-sky-800",
};

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

// ---------- Reactive cache ----------

let cache: Judgment[] = [];
let fetched = false;
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

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

async function fetchAll(): Promise<Judgment[]> {
  const [judgRes, profRes] = await Promise.all([
    supabase.from("judgments").select("*"),
    supabase.from("profiles").select("id, name, email"),
  ]);
  const profilesById = new Map<string, DbProfile>();
  for (const p of (profRes.data ?? []) as DbProfile[]) profilesById.set(p.id, p);
  return ((judgRes.data ?? []) as DbJudgment[]).map((r) => mapRow(r, profilesById));
}

export async function refreshJudgments() {
  cache = await fetchAll();
  fetched = true;
  notify();
}

export function listJudgments(): Judgment[] {
  return cache;
}

export function useJudgmentsList(): Judgment[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (!fetched) void refreshJudgments();
      return () => {
        listeners.delete(cb);
      };
    },
    () => cache,
    () => cache,
  );
}

// ---------- Mutations ----------

export async function upsertJudgment(
  input: Omit<Judgment, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Judgment> {
  if (input.decision === "ATUALIZADO" && !input.updatesNeeded?.trim()) {
    throw new Error(
      "Por favor, descreva quais as atualizações necessárias para este curso.",
    );
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
  const { data, error } = await supabase
    .from("judgments")
    .upsert(row, { onConflict: "process_id,course_id,user_id" })
    .select("*")
    .single();
  if (error) throw error;

  const saved: Judgment = {
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
  };

  // Optimistic local update — replace if exists for (processId, courseId, userId), else append
  const idx = cache.findIndex(
    (j) =>
      j.processId === saved.processId &&
      j.courseId === saved.courseId &&
      j.userId === saved.userId,
  );
  if (idx >= 0) cache = [...cache.slice(0, idx), saved, ...cache.slice(idx + 1)];
  else cache = [...cache, saved];
  notify();

  // Re-sync in background to pick up server-side fields
  void refreshJudgments();
  return saved;
}

export async function deleteJudgment(
  courseId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("judgments")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", userId);
  if (error) throw error;
  cache = cache.filter((j) => !(j.courseId === courseId && j.userId === userId));
  notify();
  void refreshJudgments();
}

export function findUserJudgment(
  judgments: Judgment[],
  courseId: string,
  userId: string,
): Judgment | undefined {
  return judgments.find((j) => j.courseId === courseId && j.userId === userId);
}

export function judgmentsForCourse(
  judgments: Judgment[],
  courseId: string,
): Judgment[] {
  return judgments.filter((j) => j.courseId === courseId);
}
