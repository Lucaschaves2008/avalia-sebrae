import { useEffect, useState } from "react";
import type { Region } from "./auth";
import {
  deleteJudgmentServer,
  listJudgmentsServer,
  upsertJudgmentServer,
} from "./judgments.functions";
import { reportBackendFailure, reportBackendSuccess } from "./connectivity";

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

import { loadCache, saveCache, isFresh } from "./cache-persist";
const CACHE_KEY = "judgments";

let cache: Judgment[] = [];
let fetched = false;
let loading = false;
let errorMessage: string | null = null;
let lastSavedAt = 0;

const _persisted = loadCache<Judgment[]>(CACHE_KEY);
if (_persisted) {
  cache = _persisted.data;
  fetched = true;
  lastSavedAt = _persisted.savedAt;
}

let statusSnapshot: { loading: boolean; error: string | null; fetched: boolean } = {
  loading,
  error: errorMessage,
  fetched,
};
const emptyStatusSnapshot = { loading: false, error: null, fetched: false };
let refreshScheduled = false;
const listeners = new Set<() => void>();
function notify() {
  statusSnapshot = { loading, error: errorMessage, fetched };
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
  return listJudgmentsServer();
}

function isMissingAuthHeader(error: unknown): boolean {
  return error instanceof Error && /No authorization header provided/i.test(error.message);
}

function requestJudgmentsRefresh() {
  if (fetched && isFresh(lastSavedAt)) return;
  if (loading || refreshScheduled) return;
  refreshScheduled = true;
  window.setTimeout(() => {
    refreshScheduled = false;
    if (!loading) void refreshJudgments();
  }, 0);
}

export async function refreshJudgments() {
  loading = true;
  errorMessage = null;
  notify();
  try {
    cache = await fetchAll();
    fetched = true;
    loading = false;
    errorMessage = null;
    lastSavedAt = Date.now();
    saveCache(CACHE_KEY, cache);
    reportBackendSuccess();
    notify();
  } catch (error) {
    console.error("[judgments] fetch error:", error);
    fetched = !isMissingAuthHeader(error) ? fetched || false : false;
    loading = false;
    errorMessage = error instanceof Error ? error.message : "Falha ao carregar avaliações.";
    reportBackendFailure();
    notify();
  }
}


export function listJudgments(): Judgment[] {
  return cache;
}

export function useJudgmentsList(): Judgment[] {
  return useJudgmentsListWhen(true);
}

export function useJudgmentsListWhen(enabled: boolean): Judgment[] {
  const [snapshot, setSnapshot] = useState(cache);

  useEffect(() => {
    const update = () => setSnapshot(cache);
    listeners.add(update);
    if (enabled) requestJudgmentsRefresh();
    return () => {
      listeners.delete(update);
    };
  }, [enabled]);

  return snapshot;
}

export function useJudgmentsStatus(): { loading: boolean; error: string | null; fetched: boolean } {
  return useJudgmentsStatusWhen(true);
}

export function useJudgmentsStatusWhen(enabled: boolean): { loading: boolean; error: string | null; fetched: boolean } {
  const [snapshot, setSnapshot] = useState(statusSnapshot);

  useEffect(() => {
    const update = () => setSnapshot(statusSnapshot);
    listeners.add(update);
    if (enabled) requestJudgmentsRefresh();
    return () => {
      listeners.delete(update);
    };
  }, [enabled]);

  return enabled ? snapshot : emptyStatusSnapshot;
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
  const saved = await upsertJudgmentServer({ data: input });

  // Optimistic local update — replace if exists for (processId, courseId, userId), else append
  const idx = cache.findIndex(
    (j) =>
      j.processId === saved.processId &&
      j.courseId === saved.courseId &&
      j.userId === saved.userId,
  );
  if (idx >= 0) cache = [...cache.slice(0, idx), saved, ...cache.slice(idx + 1)];
  else cache = [...cache, saved];
  lastSavedAt = Date.now();
  saveCache(CACHE_KEY, cache);
  notify();

  // Re-sync in background to pick up server-side fields
  void refreshJudgments();
  return saved;
}

export async function deleteJudgment(
  courseId: string,
  userId: string,
): Promise<void> {
  await deleteJudgmentServer({ data: { courseId, userId } });
  cache = cache.filter((j) => !(j.courseId === courseId && j.userId === userId));
  lastSavedAt = Date.now();
  saveCache(CACHE_KEY, cache);
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
