import { useSyncExternalStore } from "react";
import Papa from "papaparse";
import {
  appendCoursesServer,
  deleteCourseServer,
  listCoursesServer,
  replaceCoursesServer,
  upsertCourseServer,
} from "./courses.functions";
import { reportBackendFailure, reportBackendSuccess } from "./connectivity";

// ---------- Types ----------

export type BCG = "Estrela" | "Vaca Leiteira" | "Interrogação" | "Abacaxi";
export type FgvRating = "NA" | "PA" | "NAP" | "SA";

export const BCG_OPTIONS: BCG[] = ["Estrela", "Vaca Leiteira", "Interrogação", "Abacaxi"];
export const FGV_OPTIONS: FgvRating[] = ["NA", "PA", "NAP", "SA"];

export const FGV_LABELS: Record<FgvRating, string> = {
  NA: "Não atendido",
  PA: "Parcialmente atendido",
  NAP: "Não se aplica",
  SA: "Satisfatoriamente atendido",
};

export interface CourseMaterials {
  moa: boolean;
  planosAula: boolean;
  manualConsultor: boolean;
  manualMultiplicador: boolean;
  manualGestor: boolean;
  guiaProfessor: boolean;
  manualEstudante: boolean;
  slides: boolean;
  fichaTecnica: boolean;
  enxovalMarketing: boolean;
}

export interface CourseFgv {
  bncc: FgvRating;
  contextoLocal: FgvRating;
  abordagemConceitual: FgvRating;
  atratividadeVisual: FgvRating;
  verificacaoAprendizagem: FgvRating;
  socioemocionais: FgvRating;
  entrecomp: FgvRating;
  projetoVida: FgvRating;
  aplicacaoTransversal: FgvRating;
  integracaoComunitaria: FgvRating;
}

export interface Course {
  id: string;
  codigo: string;
  solucao: string;
  link: string;
  publicoAlvo: string;
  instrumento: string;
  modalidade: string;
  idadeMeses: number;
  atendimentosAno: number;
  ids: number;
  bcg: BCG | "";
  dataHabilitacao: string;
  materials: CourseMaterials;
  fgv: CourseFgv;
  ferramentasInclusao: string;
  sinteseAvaliacao: string;
  pontosAtencao: string;
}

export const MATERIAL_LABELS: Record<keyof CourseMaterials, string> = {
  moa: "Manual de Operação e Aplicação (MOA)",
  planosAula: "Planos de Aula",
  manualConsultor: "Manual do Consultor",
  manualMultiplicador: "Manual do Multiplicador",
  manualGestor: "Manual do Gestor",
  guiaProfessor: "Guia do Professor",
  manualEstudante: "Manual do Estudante",
  slides: "Slides (PPT)",
  fichaTecnica: "Ficha Técnica",
  enxovalMarketing: "Enxoval de Marketing",
};

export const FGV_FIELD_LABELS: Record<keyof CourseFgv, string> = {
  bncc: "Alinhamento à BNCC",
  contextoLocal: "Contexto Local",
  abordagemConceitual: "Abordagem Conceitual",
  atratividadeVisual: "Atratividade Visual",
  verificacaoAprendizagem: "Verificação de Aprendizagem",
  socioemocionais: "Competências Socioemocionais",
  entrecomp: "Competências EntreComp",
  projetoVida: "Projeto de Vida / Mundo do Trabalho",
  aplicacaoTransversal: "Aplicação Transversal",
  integracaoComunitaria: "Integração Comunitária",
};

function emptyMaterials(): CourseMaterials {
  return {
    moa: false,
    planosAula: false,
    manualConsultor: false,
    manualMultiplicador: false,
    manualGestor: false,
    guiaProfessor: false,
    manualEstudante: false,
    slides: false,
    fichaTecnica: false,
    enxovalMarketing: false,
  };
}

function emptyFgv(): CourseFgv {
  return {
    bncc: "NAP",
    contextoLocal: "NAP",
    abordagemConceitual: "NAP",
    atratividadeVisual: "NAP",
    verificacaoAprendizagem: "NAP",
    socioemocionais: "NAP",
    entrecomp: "NAP",
    projetoVida: "NAP",
    aplicacaoTransversal: "NAP",
    integracaoComunitaria: "NAP",
  };
}

export function emptyCourse(): Course {
  return {
    id: `c-${Date.now().toString(36)}`,
    codigo: "",
    solucao: "",
    link: "",
    publicoAlvo: "",
    instrumento: "",
    modalidade: "",
    idadeMeses: 0,
    atendimentosAno: 0,
    ids: 0,
    bcg: "",
    dataHabilitacao: "",
    materials: emptyMaterials(),
    fgv: emptyFgv(),
    ferramentasInclusao: "",
    sinteseAvaliacao: "",
    pontosAtencao: "",
  };
}

// ---------- DB <-> model mapping ----------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DbCourse = {
  id: string;
  solution_name: string;
  access_link: string | null;
  target_audience: string | null;
  instrument: string | null;
  modality: string | null;
  activation_date: string | null;
  age_months: number | null;
  current_year_attendance: number | null;
  ids_score: number | string | null;
  bcg_classification: string | null;
  has_moa: boolean | null;
  has_class_plans: boolean | null;
  has_consultant_manual: boolean | null;
  has_multiplicator_manual: boolean | null;
  has_manager_manual: boolean | null;
  has_teacher_guide: boolean | null;
  has_student_manual: boolean | null;
  has_slides: boolean | null;
  has_technical_sheet: boolean | null;
  has_marketing_kit: boolean | null;
  fgv_bncc: string | null;
  fgv_context: string | null;
  fgv_conceptual: string | null;
  fgv_visual: string | null;
  fgv_learning_eval: string | null;
  fgv_socioemotional: string | null;
  fgv_entrecomp: string | null;
  fgv_life_project: string | null;
  fgv_transversal: string | null;
  fgv_community: string | null;
  fgv_inclusion_tools: string | null;
  fgv_synthesis: string | null;
  fgv_attention_points: string | null;
};

function fgvFrom(v: string | null): FgvRating {
  return v === "NA" || v === "PA" || v === "NAP" || v === "SA" ? v : "NAP";
}

function rowToCourse(r: DbCourse): Course {
  return {
    id: r.id,
    codigo: r.id,
    solucao: r.solution_name,
    link: r.access_link ?? "",
    publicoAlvo: r.target_audience ?? "",
    instrumento: r.instrument ?? "",
    modalidade: r.modality ?? "",
    idadeMeses: r.age_months ?? 0,
    atendimentosAno: r.current_year_attendance ?? 0,
    ids: r.ids_score == null ? 0 : Number(r.ids_score),
    bcg: (r.bcg_classification ?? "") as Course["bcg"],
    dataHabilitacao: r.activation_date ?? "",
    materials: {
      moa: !!r.has_moa,
      planosAula: !!r.has_class_plans,
      manualConsultor: !!r.has_consultant_manual,
      manualMultiplicador: !!r.has_multiplicator_manual,
      manualGestor: !!r.has_manager_manual,
      guiaProfessor: !!r.has_teacher_guide,
      manualEstudante: !!r.has_student_manual,
      slides: !!r.has_slides,
      fichaTecnica: !!r.has_technical_sheet,
      enxovalMarketing: !!r.has_marketing_kit,
    },
    fgv: {
      bncc: fgvFrom(r.fgv_bncc),
      contextoLocal: fgvFrom(r.fgv_context),
      abordagemConceitual: fgvFrom(r.fgv_conceptual),
      atratividadeVisual: fgvFrom(r.fgv_visual),
      verificacaoAprendizagem: fgvFrom(r.fgv_learning_eval),
      socioemocionais: fgvFrom(r.fgv_socioemotional),
      entrecomp: fgvFrom(r.fgv_entrecomp),
      projetoVida: fgvFrom(r.fgv_life_project),
      aplicacaoTransversal: fgvFrom(r.fgv_transversal),
      integracaoComunitaria: fgvFrom(r.fgv_community),
    },
    ferramentasInclusao: r.fgv_inclusion_tools ?? "",
    sinteseAvaliacao: r.fgv_synthesis ?? "",
    pontosAtencao: r.fgv_attention_points ?? "",
  };
}

function courseToRow(c: Course) {
  const id = (c.codigo || c.id).trim();
  return {
    id,
    solution_name: c.solucao,
    access_link: c.link || null,
    target_audience: c.publicoAlvo || null,
    instrument: c.instrumento || null,
    modality: c.modalidade || null,
    activation_date: ISO_DATE_RE.test(c.dataHabilitacao) ? c.dataHabilitacao : null,
    age_months: c.idadeMeses || 0,
    current_year_attendance: c.atendimentosAno || 0,
    ids_score: c.ids || 0,
    bcg_classification: c.bcg || null,
    has_moa: c.materials.moa,
    has_class_plans: c.materials.planosAula,
    has_consultant_manual: c.materials.manualConsultor,
    has_multiplicator_manual: c.materials.manualMultiplicador,
    has_manager_manual: c.materials.manualGestor,
    has_teacher_guide: c.materials.guiaProfessor,
    has_student_manual: c.materials.manualEstudante,
    has_slides: c.materials.slides,
    has_technical_sheet: c.materials.fichaTecnica,
    has_marketing_kit: c.materials.enxovalMarketing,
    fgv_bncc: c.fgv.bncc,
    fgv_context: c.fgv.contextoLocal,
    fgv_conceptual: c.fgv.abordagemConceitual,
    fgv_visual: c.fgv.atratividadeVisual,
    fgv_learning_eval: c.fgv.verificacaoAprendizagem,
    fgv_socioemotional: c.fgv.socioemocionais,
    fgv_entrecomp: c.fgv.entrecomp,
    fgv_life_project: c.fgv.projetoVida,
    fgv_transversal: c.fgv.aplicacaoTransversal,
    fgv_community: c.fgv.integracaoComunitaria,
    fgv_inclusion_tools: c.ferramentasInclusao || "",
    fgv_synthesis: c.sinteseAvaliacao || "",
    fgv_attention_points: c.pontosAtencao || "",
  };
}

// ---------- Reactive cache ----------

let cache: Course[] = [];
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
function notify() {
  statusSnapshot = { loading, error: errorMessage, fetched };
  for (const l of listeners) l();
}

async function fetchAll(): Promise<Course[]> {
  return listCoursesServer();
}

function isMissingAuthHeader(error: unknown): boolean {
  return error instanceof Error && /No authorization header provided/i.test(error.message);
}

function requestCoursesRefresh() {
  if (fetched || loading || refreshScheduled) return;
  refreshScheduled = true;
  window.setTimeout(() => {
    refreshScheduled = false;
    if (!fetched && !loading) void refreshCourses();
  }, 0);
}

export async function refreshCourses() {
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
    console.error("[courses] fetchAll error:", error);
    fetched = !isMissingAuthHeader(error);
    loading = false;
    errorMessage = error instanceof Error ? error.message : "Falha ao carregar cursos.";
    reportBackendFailure();
    notify();
  }
}

export function listCourses(): Course[] {
  return cache;
}

export function useCoursesList(): Course[] {
  return useCoursesListWhen(true);
}

export function useCoursesListWhen(enabled: boolean): Course[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (enabled) requestCoursesRefresh();
      return () => {
        listeners.delete(cb);
      };
    },
    () => cache,
    () => cache,
  );
}

export function useCoursesStatus(): { loading: boolean; error: string | null; fetched: boolean } {
  return useCoursesStatusWhen(true);
}

export function useCoursesStatusWhen(enabled: boolean): { loading: boolean; error: string | null; fetched: boolean } {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (enabled) requestCoursesRefresh();
      return () => {
        listeners.delete(cb);
      };
    },
    () => statusSnapshot,
    () => emptyStatusSnapshot,
  );
}

export async function upsertCourse(course: Course, opts?: { isNew?: boolean }): Promise<void> {
  await upsertCourseServer({ data: { course, isNew: opts?.isNew } });
  await refreshCourses();
}

export async function deleteCourse(id: string): Promise<void> {
  await deleteCourseServer({ data: { id } });
  await refreshCourses();
}

export async function replaceCourses(next: Course[]): Promise<void> {
  await replaceCoursesServer({ data: { courses: next } });
  await refreshCourses();
}

export async function appendCourses(next: Course[]): Promise<{ inserted: number; errors: string[] }> {
  const result = await appendCoursesServer({ data: { courses: next } });
  await refreshCourses();
  return result;
}

// ---------- CSV import ----------

const HEADER_ALIASES: Record<string, keyof Course | `mat:${keyof CourseMaterials}` | `fgv:${keyof CourseFgv}`> = {
  "codigo do produto": "codigo",
  "código do produto": "codigo",
  codigo: "codigo",
  código: "codigo",
  "solucao educacional": "solucao",
  "solução educacional": "solucao",
  solucao: "solucao",
  solução: "solucao",
  "link de acesso": "link",
  link: "link",
  "publico-alvo": "publicoAlvo",
  "público-alvo": "publicoAlvo",
  "publico alvo": "publicoAlvo",
  "público alvo": "publicoAlvo",
  instrumento: "instrumento",
  modalidade: "modalidade",
  "idade do produto (meses)": "idadeMeses",
  "idade do produto": "idadeMeses",
  "idade (meses)": "idadeMeses",
  "atendimentos no ano atual": "atendimentosAno",
  "atendimentos no ano": "atendimentosAno",
  atendimentos: "atendimentosAno",
  ids: "ids",
  "classificacao na matriz bcg": "bcg",
  "classificação na matriz bcg": "bcg",
  bcg: "bcg",
  "data de habilitacao": "dataHabilitacao",
  "data de habilitação": "dataHabilitacao",
  "data habilitacao": "dataHabilitacao",
  "data habilitação": "dataHabilitacao",
  "ferramentas de inclusao": "ferramentasInclusao",
  "ferramentas de inclusão": "ferramentasInclusao",
  sintese: "sinteseAvaliacao",
  síntese: "sinteseAvaliacao",
  "sintese da avaliacao": "sinteseAvaliacao",
  "síntese da avaliação": "sinteseAvaliacao",
  "pontos de atencao": "pontosAtencao",
  "pontos de atenção": "pontosAtencao",
  "manual de operacao e aplicacao (moa)": "mat:moa",
  "manual de operação e aplicação (moa)": "mat:moa",
  moa: "mat:moa",
  "planos de aula": "mat:planosAula",
  "manual do consultor": "mat:manualConsultor",
  "manual do multiplicador": "mat:manualMultiplicador",
  "manual do gestor": "mat:manualGestor",
  "guia do professor": "mat:guiaProfessor",
  "manual do estudante": "mat:manualEstudante",
  "slides (ppt)": "mat:slides",
  slides: "mat:slides",
  "ficha tecnica": "mat:fichaTecnica",
  "ficha técnica": "mat:fichaTecnica",
  "enxoval de marketing": "mat:enxovalMarketing",
  bncc: "fgv:bncc",
  "alinhamento bncc": "fgv:bncc",
  "alinhamento à bncc": "fgv:bncc",
  "contexto local": "fgv:contextoLocal",
  "abordagem conceitual": "fgv:abordagemConceitual",
  "atratividade visual": "fgv:atratividadeVisual",
  "verificacao de aprendizagem": "fgv:verificacaoAprendizagem",
  "verificação de aprendizagem": "fgv:verificacaoAprendizagem",
  "competencias socioemocionais": "fgv:socioemocionais",
  "competências socioemocionais": "fgv:socioemocionais",
  socioemocionais: "fgv:socioemocionais",
  "competencias entrecomp": "fgv:entrecomp",
  "competências entrecomp": "fgv:entrecomp",
  entrecomp: "fgv:entrecomp",
  "projeto de vida": "fgv:projetoVida",
  "projeto de vida/mundo do trabalho": "fgv:projetoVida",
  "projeto de vida / mundo do trabalho": "fgv:projetoVida",
  "aplicacao transversal": "fgv:aplicacaoTransversal",
  "aplicação transversal": "fgv:aplicacaoTransversal",
  "integracao comunitaria": "fgv:integracaoComunitaria",
  "integração comunitária": "fgv:integracaoComunitaria",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (["nao", "não", "n", "false", "0"].includes(s)) return false;
  return ["sim", "s", "true", "1", "x", "yes", "y"].includes(s);
}

// Returns a valid FgvRating or null when the value is invalid/empty
// (caller should keep the default and skip the field).
function parseFgvVal(v: unknown): FgvRating | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s === "NOVO") return "NAP";
  if (s === "NA" || s === "PA" || s === "NAP" || s === "SA") return s;
  return null;
}

function parseBcg(v: unknown): BCG | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("estr")) return "Estrela";
  if (s.startsWith("vaca")) return "Vaca Leiteira";
  if (s.startsWith("inter") || s.includes("?")) return "Interrogação";
  if (s.startsWith("abac")) return "Abacaxi";
  return "";
}

function parseNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export interface CsvImportResult {
  courses: Course[];
  skipped: number;
  errors: string[];
}

export async function parseCoursesCsv(file: File): Promise<CsvImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const courses: Course[] = [];
        let skipped = 0;

        results.data.forEach((row, i) => {
          const c = emptyCourse();
          const lineNo = i + 2; // header is line 1

          for (const [rawKey, rawVal] of Object.entries(row)) {
            const target = HEADER_ALIASES[normalizeHeader(rawKey)];
            if (!target) continue;
            if (target.startsWith("mat:")) {
              const key = target.slice(4) as keyof CourseMaterials;
              c.materials[key] = parseBoolean(rawVal);
            } else if (target.startsWith("fgv:")) {
              const key = target.slice(4) as keyof CourseFgv;
              const parsed = parseFgvVal(rawVal);
              if (parsed !== null) c.fgv[key] = parsed;
              // invalid/empty → keep default, ignore field
            } else {
              const key = target as keyof Course;
              switch (key) {
                case "idadeMeses":
                case "atendimentosAno":
                case "ids":
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (c as any)[key] = parseNumber(rawVal);
                  break;
                case "bcg":
                  c.bcg = parseBcg(rawVal);
                  break;
                default:
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (c as any)[key] = String(rawVal ?? "").trim();
              }
            }
          }

          // Strict rule: "Código do produto" is required
          if (!c.codigo.trim()) {
            skipped++;
            errors.push(`Linha ${lineNo}: "Código do produto" em branco — linha ignorada.`);
            return;
          }
          c.id = c.codigo.trim();
          courses.push(c);
        });

        if (results.errors.length) {
          for (const e of results.errors) errors.push(`Linha ${e.row ?? "?"}: ${e.message}`);
        }
        resolve({ courses, skipped, errors });
      },
      error: (err) => reject(err),
    });
  });
}

export const CSV_TEMPLATE = [
  [
    "Código do Produto",
    "Solução Educacional",
    "Link de Acesso",
    "Público-alvo",
    "Instrumento",
    "Modalidade",
    "Idade do Produto (meses)",
    "Atendimentos no ano atual",
    "IDS",
    "Classificação na matriz BCG",
    "Data de Habilitação",
    "MOA",
    "Planos de Aula",
    "Manual do Consultor",
    "Manual do Multiplicador",
    "Manual do Gestor",
    "Guia do Professor",
    "Manual do Estudante",
    "Slides (PPT)",
    "Ficha Técnica",
    "Enxoval de Marketing",
    "BNCC",
    "Contexto Local",
    "Abordagem Conceitual",
    "Atratividade Visual",
    "Verificação de Aprendizagem",
    "Competências Socioemocionais",
    "Competências EntreComp",
    "Projeto de Vida / Mundo do Trabalho",
    "Aplicação Transversal",
    "Integração Comunitária",
    "Ferramentas de Inclusão",
    "Síntese",
    "Pontos de Atenção",
  ],
  [
    "EE-003",
    "Curso Exemplo SEBRAE",
    "https://sebrae.com.br/exemplo",
    "Ensino Médio",
    "Curso",
    "Híbrido",
    "12",
    "850",
    "72",
    "Estrela",
    "2024-02-10",
    "Sim",
    "Sim",
    "Não",
    "Sim",
    "Sim",
    "Sim",
    "Não",
    "Sim",
    "Sim",
    "Não",
    "SA",
    "PA",
    "SA",
    "PA",
    "SA",
    "SA",
    "PA",
    "SA",
    "NAP",
    "NA",
    "Conteúdo com versão em libras e materiais com fonte ampliada.",
    "Curso bem estruturado, com forte aderência às competências.",
    "Atenção ao alinhamento com a realidade local e à atratividade visual.",
  ],
];

export function downloadCsvTemplate() {
  const csv = Papa.unparse(CSV_TEMPLATE);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-portfolio-cursos-sebrae.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export type ReadinessLevel = "alto" | "medio" | "pronto";

export interface ReadinessResult {
  pct: number;
  level: ReadinessLevel;
  label: string;
}

export function computeMaterialReadiness(course: Course): ReadinessResult {
  const items = Object.values(course.materials);
  const done = items.filter(Boolean).length;
  const pct = Math.round((done / items.length) * 100);
  let level: ReadinessLevel;
  let label: string;
  if (pct <= 40) {
    level = "alto";
    label = "Alto Esforço";
  } else if (pct <= 75) {
    level = "medio";
    label = "Médio Esforço";
  } else {
    level = "pronto";
    label = "Pronto / Baixo Esforço";
  }
  return { pct, level, label };
}
