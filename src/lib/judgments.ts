import { useSyncExternalStore } from "react";
import type { Region } from "./auth";

export type JudgmentDecision = "MANTIDO" | "ATUALIZADO" | "INATIVACAO";
export type JudgmentPriority = "Alta" | "Média" | "Baixa";

export interface Judgment {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userEmail: string;
  region: Region;
  decision: JudgmentDecision;
  updatesNeeded?: string;
  priority: JudgmentPriority;
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

const STORAGE_KEY = "sebrae.judgments.v1";
const EVENT = "sebrae:judgments-changed";

function load(): Judgment[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Judgment[];
  } catch {
    return [];
  }
}

function save(items: Judgment[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function listJudgments(): Judgment[] {
  return load();
}

export function upsertJudgment(
  input: Omit<Judgment, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Judgment {
  const items = load();
  const now = new Date().toISOString();
  const idx = items.findIndex(
    (j) => j.courseId === input.courseId && j.userId === input.userId,
  );
  if (idx === -1) {
    const created: Judgment = {
      ...input,
      id: input.id ?? `j-${Date.now().toString(36)}`,
      createdAt: now,
      updatedAt: now,
    };
    items.push(created);
    save(items);
    return created;
  }
  const updated: Judgment = {
    ...items[idx],
    ...input,
    id: items[idx].id,
    createdAt: items[idx].createdAt,
    updatedAt: now,
  };
  items[idx] = updated;
  save(items);
  return updated;
}

export function deleteJudgment(courseId: string, userId: string) {
  save(load().filter((j) => !(j.courseId === courseId && j.userId === userId)));
}

export function useJudgmentsList(): Judgment[] {
  useSyncExternalStore(
    (cb) => {
      const h = () => cb();
      window.addEventListener(EVENT, h);
      window.addEventListener("storage", h);
      return () => {
        window.removeEventListener(EVENT, h);
        window.removeEventListener("storage", h);
      };
    },
    () => window.localStorage.getItem(STORAGE_KEY) ?? "",
    () => "",
  );
  return listJudgments();
}

export function findUserJudgment(
  judgments: Judgment[],
  courseId: string,
  userId: string,
): Judgment | undefined {
  return judgments.find((j) => j.courseId === courseId && j.userId === userId);
}

export function judgmentsForCourse(judgments: Judgment[], courseId: string): Judgment[] {
  return judgments.filter((j) => j.courseId === courseId);
}
