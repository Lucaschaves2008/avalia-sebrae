import { useEffect, useState } from "react";
import {
  deleteProcessServer,
  listProcessesServer,
  upsertProcessServer,
} from "./processes.functions";
import { reportBackendFailure, reportBackendSuccess } from "./connectivity";

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
let loading = false;
let errorMessage: string | null = null;
let statusSnapshot: { loading: boolean; error: string | null; fetched: boolean } = {
  loading,
  error: errorMessage,
  fetched,
};
const emptyStatusSnapshot = { loading: false, error: null, fetched: false };
let refreshScheduled = false;
const listeners = new Set<() => void>();
const notify = () => {
  statusSnapshot = { loading, error: errorMessage, fetched };
  listeners.forEach((l) => l());
};

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
  return listProcessesServer();
}

function isMissingAuthHeader(error: unknown): boolean {
  return error instanceof Error && /No authorization header provided/i.test(error.message);
}

function requestProcessesRefresh() {
  if (fetched || loading || refreshScheduled) return;
  refreshScheduled = true;
  window.setTimeout(() => {
    refreshScheduled = false;
    if (!fetched && !loading) void refreshProcesses();
  }, 0);
}

export async function refreshProcesses() {
  loading = true;
  errorMessage = null;
  notify();
  try {
    cache = await fetchAll();
    fetched = true;
    loading = false;
    errorMessage = null;
    reportBackendSuccess();
    notify();
  } catch (error) {
    console.error("[processes] fetch error:", error);
    fetched = !isMissingAuthHeader(error);
    loading = false;
    errorMessage = error instanceof Error ? error.message : "Falha ao carregar processos.";
    reportBackendFailure();
    notify();
  }
}

export function listProcesses(): EvaluationProcess[] {
  return cache;
}

export function useProcessesList(): EvaluationProcess[] {
  return useProcessesListWhen(true);
}

export function useProcessesListWhen(enabled: boolean): EvaluationProcess[] {
  const [snapshot, setSnapshot] = useState(cache);

  useEffect(() => {
    const update = () => setSnapshot(cache);
    listeners.add(update);
    if (enabled) requestProcessesRefresh();
    return () => {
      listeners.delete(update);
    };
  }, [enabled]);

  return snapshot;
}

export function useProcessesStatus(): { loading: boolean; error: string | null; fetched: boolean } {
  return useProcessesStatusWhen(true);
}

export function useProcessesStatusWhen(enabled: boolean): { loading: boolean; error: string | null; fetched: boolean } {
  const [snapshot, setSnapshot] = useState(statusSnapshot);

  useEffect(() => {
    const update = () => setSnapshot(statusSnapshot);
    listeners.add(update);
    if (enabled) requestProcessesRefresh();
    return () => {
      listeners.delete(update);
    };
  }, [enabled]);

  return enabled ? snapshot : emptyStatusSnapshot;
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
  const { processId } = await upsertProcessServer({ data: input });
  await refreshProcesses();
  return cache.find((p) => p.id === processId)!;
}

export async function deleteProcess(id: string): Promise<void> {
  await deleteProcessServer({ data: { id } });
  await refreshProcesses();
}
