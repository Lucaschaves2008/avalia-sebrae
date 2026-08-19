import { useEffect, useState } from "react";
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
import { loadCache, saveCache, isFresh, parseCachedList,
  sanitizeFetchedList, asString } from "./cache-persist";
const CACHE_KEY = "final-opinions";

const FINAL_DECISIONS: FinalDecision[] = ["MANTER", "ATUALIZAR", "INATIVAR"];
const FINAL_PRIORITIES: FinalPriority[] = ["ALTA", "MEDIA", "BAIXA"];
const OPINION_STATUSES: OpinionStatus[] = ["NAO_INICIADO", "EM_ANDAMENTO", "FINALIZADO"];

function parseCachedItem(raw: Record<string, unknown>): FinalOpinionItem | null {
  const id = asString(raw.id);
  if (!id) return null;
  const decision = asString(raw.decision);
  const priority = asString(raw.priority);
  return {
    id,
    opinionId: asString(raw.opinionId),
    courseId: asString(raw.courseId),
    decision: (FINAL_DECISIONS as string[]).includes(decision)
      ? (decision as FinalDecision)
      : null,
    priority: (FINAL_PRIORITIES as string[]).includes(priority)
      ? (priority as FinalPriority)
      : null,
    observation: asString(raw.observation),
    decidedBy: typeof raw.decidedBy === "string" ? raw.decidedBy : null,
    decidedAt: typeof raw.decidedAt === "string" ? raw.decidedAt : null,
    updatedAt: asString(raw.updatedAt),
  };
}

// `items` é percorrido no render; um parecer sem a lista derruba a página.
function parseCachedOpinion(raw: Record<string, unknown>): FinalOpinion | null {
  const id = asString(raw.id);
  if (!id) return null;
  const items = parseCachedList(raw.items ?? [], parseCachedItem);
  if (items === null) return null;
  const status = asString(raw.status);
  return {
    id,
    processId: asString(raw.processId),
    status: (OPINION_STATUSES as string[]).includes(status)
      ? (status as OpinionStatus)
      : "NAO_INICIADO",
    finalizedAt: typeof raw.finalizedAt === "string" ? raw.finalizedAt : null,
    createdAt: asString(raw.createdAt),
    updatedAt: asString(raw.updatedAt),
    items,
  };
}

let cache: FinalOpinion[] = [];
let fetched = false;
let lastSavedAt = 0;
let refreshScheduled = false;
let loading = false;

const _persisted = loadCache<FinalOpinion[]>(CACHE_KEY, (raw) =>
  parseCachedList(raw, parseCachedOpinion),
);
if (_persisted) {
  cache = _persisted.data;
  fetched = true;
  lastSavedAt = _persisted.savedAt;
}

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
    return cache;
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
  if (loading) return;
  loading = true;
  try {
    // Mesma fronteira de normalização do cache, agora para os dados do
    // banco: uma linha fora do formato não pode chegar crua ao render.
    cache = sanitizeFetchedList(await fetchAll(), parseCachedOpinion, "final-opinions");
    fetched = true;
    lastSavedAt = Date.now();
    saveCache(CACHE_KEY, cache);
    notify();
  } finally {
    loading = false;
  }
}

function requestFinalOpinionsRefresh() {
  if (fetched && isFresh(lastSavedAt)) return;
  if (refreshScheduled || loading) return;
  refreshScheduled = true;
  window.setTimeout(() => {
    refreshScheduled = false;
    if (!loading) void refreshFinalOpinions();
  }, 0);
}


export function listFinalOpinions(): FinalOpinion[] {
  return cache;
}

export function useFinalOpinionsList(): FinalOpinion[] {
  return useFinalOpinionsListWhen(true);
}

export function useFinalOpinionsListWhen(enabled: boolean): FinalOpinion[] {
  const [snapshot, setSnapshot] = useState(cache);

  useEffect(() => {
    const update = () => setSnapshot(cache);
    listeners.add(update);
    if (enabled) requestFinalOpinionsRefresh();
    return () => {
      listeners.delete(update);
    };
  }, [enabled]);

  return snapshot;
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
