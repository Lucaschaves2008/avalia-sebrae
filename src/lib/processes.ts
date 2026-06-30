import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProcessScope = "NACIONAL" | "REGIONAL" | "AMBOS";
export type ProcessStatus = "ATIVO" | "INATIVO" | "FINALIZADO";

export interface EvaluationProcess {
  id: string;
  name: string;
  description: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  scope: ProcessScope;
  status: ProcessStatus;
  courseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const SCOPE_LABELS: Record<ProcessScope, string> = {
  NACIONAL: "Somente Gestores Nacionais",
  REGIONAL: "Somente Gestores Regionais",
  AMBOS: "Nacional e Regional",
};

export const STATUS_LABELS: Record<ProcessStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  FINALIZADO: "Finalizado",
};

export const STATUS_STYLES: Record<ProcessStatus, string> = {
  ATIVO: "border-emerald-300 bg-emerald-50 text-emerald-800",
  INATIVO: "border-slate-300 bg-slate-50 text-slate-700",
  FINALIZADO: "border-sky-300 bg-sky-50 text-sky-800",
};

/** Returns the effective status: if end_date already passed, treat ATIVO as FINALIZADO. */
export function effectiveStatus(p: { status: ProcessStatus; endDate: string }): ProcessStatus {
  if (p.status === "ATIVO") {
    const end = new Date(`${p.endDate}T23:59:59`);
    if (end.getTime() < Date.now()) return "FINALIZADO";
  }
  return p.status;
}

/** True if today is within [startDate, endDate] and status is ATIVO (raw). */
export function isWithinPeriod(p: { startDate: string; endDate: string }): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = new Date(`${p.startDate}T00:00:00`);
  const e = new Date(`${p.endDate}T23:59:59`);
  return today >= s && today <= e;
}

// ---------- Reactive cache ----------
let cache: EvaluationProcess[] = [];
let fetched = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

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

async function fetchAll(): Promise<EvaluationProcess[]> {
  const [pRes, pcRes] = await Promise.all([
    supabase
      .from("evaluation_processes")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("evaluation_process_courses").select("process_id, course_id"),
  ]);
  if (pRes.error) {
    console.error("[processes] fetch error:", pRes.error);
    return [];
  }
  const courseMap = new Map<string, string[]>();
  for (const r of (pcRes.data ?? []) as { process_id: string; course_id: string }[]) {
    const arr = courseMap.get(r.process_id) ?? [];
    arr.push(r.course_id);
    courseMap.set(r.process_id, arr);
  }
  return ((pRes.data ?? []) as DbProcess[]).map((r) => ({
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
  }));
}

export async function refreshProcesses() {
  cache = await fetchAll();
  fetched = true;
  notify();
}

export function listProcesses(): EvaluationProcess[] {
  return cache;
}

export function useProcessesList(): EvaluationProcess[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (!fetched) void refreshProcesses();
      return () => {
        listeners.delete(cb);
      };
    },
    () => cache,
    () => cache,
  );
}

// ---------- Mutations ----------

export interface ProcessInput {
  id?: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  scope: ProcessScope;
  status: ProcessStatus;
  courseIds: string[];
}

export async function upsertProcess(input: ProcessInput): Promise<EvaluationProcess> {
  if (!input.name.trim()) throw new Error("Informe o nome do processo.");
  if (!input.startDate || !input.endDate) throw new Error("Informe o período de avaliação.");
  if (input.endDate < input.startDate)
    throw new Error("A data final deve ser maior ou igual à inicial.");

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
    const { error } = await supabase
      .from("evaluation_processes")
      .update(row)
      .eq("id", processId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("evaluation_processes")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    processId = (data as { id: string }).id;
  }

  // Sync course links (diff against current)
  const { data: existing } = await supabase
    .from("evaluation_process_courses")
    .select("course_id")
    .eq("process_id", processId);
  const have = new Set(
    ((existing ?? []) as { course_id: string }[]).map((r) => r.course_id),
  );
  const want = new Set(input.courseIds);
  const toAdd = [...want].filter((c) => !have.has(c));
  const toRemove = [...have].filter((c) => !want.has(c));
  if (toAdd.length) {
    const { error } = await supabase
      .from("evaluation_process_courses")
      .insert(toAdd.map((course_id) => ({ process_id: processId!, course_id })));
    if (error) throw new Error(error.message);
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("evaluation_process_courses")
      .delete()
      .eq("process_id", processId!)
      .in("course_id", toRemove);
    if (error) throw new Error(error.message);
  }

  await refreshProcesses();
  return cache.find((p) => p.id === processId)!;
}

export async function deleteProcess(id: string): Promise<void> {
  const { count, error: cErr } = await supabase
    .from("judgments")
    .select("id", { count: "exact", head: true })
    .eq("process_id", id);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      "Este processo possui avaliações registradas e não pode ser excluído.",
    );
  }
  const { error: linkErr } = await supabase
    .from("evaluation_process_courses")
    .delete()
    .eq("process_id", id);
  if (linkErr) throw new Error(linkErr.message);
  const { error } = await supabase.from("evaluation_processes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshProcesses();
}
