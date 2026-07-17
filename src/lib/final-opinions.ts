import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FinalDecision = "MANTER" | "ATUALIZAR" | "INATIVAR";
export type FinalPriority = "ALTA" | "MEDIA" | "BAIXA";
export type OpinionStatus = "NAO_INICIADO" | "EM_ANDAMENTO" | "FINALIZADO";

export interface FinalOpinionItem {
  id: string;
  opinionId: string;
  courseId: string;
  decision: FinalDecision | null;
  priority: FinalPriority | null;
  observation: string;
  decidedBy: string | null;
  decidedAt: string | null;
  updatedAt: string;
}


export interface FinalOpinion {
  id: string;
  processId: string;
  status: OpinionStatus;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: FinalOpinionItem[];
}

export const DECISION_LABELS: Record<FinalDecision, string> = {
  MANTER: "Manter",
  ATUALIZAR: "Atualizar",
  INATIVAR: "Inativar",
};

export const PRIORITY_LABELS: Record<FinalPriority, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};


export const DECISION_STYLES: Record<FinalDecision, string> = {
  MANTER: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ATUALIZAR: "border-amber-300 bg-amber-50 text-amber-800",
  INATIVAR: "border-rose-300 bg-rose-50 text-rose-800",
};

export const DECISION_BTN_STYLES: Record<
  FinalDecision,
  { active: string; idle: string }
> = {
  MANTER: {
    active: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
    idle: "border-emerald-300 text-emerald-800 hover:bg-emerald-50",
  },
  ATUALIZAR: {
    active: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    idle: "border-amber-300 text-amber-800 hover:bg-amber-50",
  },
  INATIVAR: {
    active: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
    idle: "border-rose-300 text-rose-800 hover:bg-rose-50",
  },
};

export const STATUS_LABELS: Record<OpinionStatus, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
};

export const STATUS_STYLES: Record<OpinionStatus, string> = {
  NAO_INICIADO: "border-slate-300 bg-slate-50 text-slate-700",
  EM_ANDAMENTO: "border-amber-300 bg-amber-50 text-amber-800",
  FINALIZADO: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

// ---------- Reactive cache ----------
let cache: FinalOpinion[] = [];
let fetched = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

type DbOpinion = {
  id: string;
  process_id: string;
  status: string;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};
type DbItem = {
  id: string;
  opinion_id: string;
  course_id: string;
  decision: string | null;
  priority: string | null;
  observation: string;
  decided_by: string | null;
  decided_at: string | null;
  updated_at: string;
};

async function fetchAll(): Promise<FinalOpinion[]> {
  const [oRes, iRes] = await Promise.all([
    supabase
      .from("final_opinions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("final_opinion_items").select("*"),
  ]);
  if (oRes.error) {
    console.error("[final-opinions] fetch error:", oRes.error);
    return [];
  }
  const itemsByOpinion = new Map<string, FinalOpinionItem[]>();
  for (const r of (iRes.data ?? []) as unknown as DbItem[]) {
    const arr = itemsByOpinion.get(r.opinion_id) ?? [];
    arr.push({
      id: r.id,
      opinionId: r.opinion_id,
      courseId: r.course_id,
      decision: (r.decision as FinalDecision | null) ?? null,
      priority: (r.priority as FinalPriority | null) ?? null,
      observation: r.observation ?? "",
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      updatedAt: r.updated_at,
    });
    itemsByOpinion.set(r.opinion_id, arr);
  }

  return ((oRes.data ?? []) as DbOpinion[]).map((r) => ({
    id: r.id,
    processId: r.process_id,
    status: r.status as OpinionStatus,
    finalizedAt: r.finalized_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: itemsByOpinion.get(r.id) ?? [],
  }));
}

export async function refreshFinalOpinions() {
  cache = await fetchAll();
  fetched = true;
  notify();
}

function requestFinalOpinionsRefresh() {
  if (fetched) return;
  queueMicrotask(() => {
    if (!fetched) void refreshFinalOpinions();
  });
}

export function listFinalOpinions(): FinalOpinion[] {
  return cache;
}

export function useFinalOpinionsList(): FinalOpinion[] {
  return useFinalOpinionsListWhen(true);
}

export function useFinalOpinionsListWhen(enabled: boolean): FinalOpinion[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (enabled) requestFinalOpinionsRefresh();
      return () => {
        listeners.delete(cb);
      };
    },
    () => cache,
    () => cache,
  );
}

// ---------- Mutations ----------

/** Save (or clear) a single item's decision + priority + observation. Auto-syncs cache. */
export async function saveOpinionItem(input: {
  itemId: string;
  decision: FinalDecision | null;
  priority: FinalPriority | null;
  observation: string;
  userId: string;
}): Promise<void> {
  const row = {
    decision: input.decision,
    priority: input.priority,
    observation: input.observation,
    decided_by: input.decision ? input.userId : null,
    decided_at: input.decision ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("final_opinion_items")
    .update(row as never)
    .eq("id", input.itemId);
  if (error) throw new Error(error.message);
  await refreshFinalOpinions();
}


/** Super-admin manual override for opinion status. */
export async function overrideOpinionStatus(
  opinionId: string,
  status: OpinionStatus,
): Promise<void> {
  const { error } = await supabase
    .from("final_opinions")
    .update({
      status,
      finalized_at: status === "FINALIZADO" ? new Date().toISOString() : null,
    })
    .eq("id", opinionId);
  if (error) throw new Error(error.message);
  await refreshFinalOpinions();
}

export function findOpinionByProcess(
  opinions: FinalOpinion[],
  processId: string,
): FinalOpinion | undefined {
  return opinions.find((o) => o.processId === processId);
}
