import { useSyncExternalStore } from "react";
import Papa from "papaparse";

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
  dataHabilitacao: string; // ISO date (YYYY-MM-DD) ou texto livre
  materials: CourseMaterials;
  fgv: CourseFgv;
  // Avaliação FGV — campos descritivos complementares
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

// ---------- Storage ----------

const STORAGE_KEY = "sebrae.courses.v1";
const EVENT = "sebrae:courses-changed";

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
    materials: emptyMaterials(),
    fgv: emptyFgv(),
  };
}

const SEED_COURSES: Course[] = [
  {
    id: "c-seed-1",
    codigo: "EE-001",
    solucao: "Jovens Empreendedores Primeiros Passos (JEPP)",
    link: "https://sebrae.com.br/jepp",
    publicoAlvo: "Ensino Fundamental",
    instrumento: "Curso",
    modalidade: "Presencial",
    idadeMeses: 36,
    atendimentosAno: 12500,
    ids: 87,
    bcg: "Estrela",
    materials: {
      moa: true,
      planosAula: true,
      manualConsultor: false,
      manualMultiplicador: true,
      manualGestor: true,
      guiaProfessor: true,
      manualEstudante: true,
      slides: true,
      fichaTecnica: true,
      enxovalMarketing: true,
    },
    fgv: {
      bncc: "SA",
      contextoLocal: "SA",
      abordagemConceitual: "SA",
      atratividadeVisual: "PA",
      verificacaoAprendizagem: "SA",
      socioemocionais: "SA",
      entrecomp: "PA",
      projetoVida: "SA",
      aplicacaoTransversal: "PA",
      integracaoComunitaria: "PA",
    },
  },
  {
    id: "c-seed-2",
    codigo: "EE-002",
    solucao: "Despertar — Professores Empreendedores",
    link: "https://sebrae.com.br/despertar",
    publicoAlvo: "Professor",
    instrumento: "Oficina",
    modalidade: "EAD",
    idadeMeses: 18,
    atendimentosAno: 4300,
    ids: 74,
    bcg: "Interrogação",
    materials: {
      moa: true,
      planosAula: false,
      manualConsultor: true,
      manualMultiplicador: false,
      manualGestor: false,
      guiaProfessor: true,
      manualEstudante: false,
      slides: true,
      fichaTecnica: true,
      enxovalMarketing: false,
    },
    fgv: {
      bncc: "PA",
      contextoLocal: "PA",
      abordagemConceitual: "SA",
      atratividadeVisual: "PA",
      verificacaoAprendizagem: "NA",
      socioemocionais: "SA",
      entrecomp: "SA",
      projetoVida: "PA",
      aplicacaoTransversal: "NAP",
      integracaoComunitaria: "NA",
    },
  },
];

function load(): Course[] {
  if (typeof window === "undefined") return SEED_COURSES;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_COURSES));
    return SEED_COURSES;
  }
  try {
    return JSON.parse(raw) as Course[];
  } catch {
    return SEED_COURSES;
  }
}

function save(courses: Course[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function listCourses(): Course[] {
  return load();
}

export function upsertCourse(course: Course) {
  const courses = load();
  const idx = courses.findIndex((c) => c.id === course.id);
  if (idx === -1) courses.push(course);
  else courses[idx] = course;
  save(courses);
}

export function deleteCourse(id: string) {
  save(load().filter((c) => c.id !== id));
}

export function replaceCourses(next: Course[]) {
  save(next);
}

export function appendCourses(next: Course[]) {
  const existing = load();
  const byCodigo = new Map(existing.map((c) => [c.codigo.toLowerCase(), c]));
  for (const c of next) {
    const key = c.codigo.toLowerCase();
    if (key && byCodigo.has(key)) {
      // overwrite existing by codigo, preserve id
      const prev = byCodigo.get(key)!;
      byCodigo.set(key, { ...c, id: prev.id });
    } else {
      byCodigo.set(key || c.id, c);
    }
  }
  save(Array.from(byCodigo.values()));
}

export function useCoursesList(): Course[] {
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
  return listCourses();
}

// ---------- CSV import ----------

const HEADER_ALIASES: Record<string, keyof Course | `mat:${keyof CourseMaterials}` | `fgv:${keyof CourseFgv}`> = {
  // basics
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
  // materials
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
  // fgv
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
  return ["sim", "s", "true", "1", "x", "yes", "y"].includes(s);
}

function parseFgv(v: unknown): FgvRating {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "NA" || s === "PA" || s === "NAP" || s === "SA") return s;
  return "NAP";
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
          c.id = `c-${Date.now().toString(36)}-${i}`;

          for (const [rawKey, rawVal] of Object.entries(row)) {
            const target = HEADER_ALIASES[normalizeHeader(rawKey)];
            if (!target) continue;
            if (target.startsWith("mat:")) {
              const key = target.slice(4) as keyof CourseMaterials;
              c.materials[key] = parseBoolean(rawVal);
            } else if (target.startsWith("fgv:")) {
              const key = target.slice(4) as keyof CourseFgv;
              c.fgv[key] = parseFgv(rawVal);
            } else {
              const key = target as keyof Course;
              switch (key) {
                case "idadeMeses":
                case "atendimentosAno":
                case "ids":
                  (c as any)[key] = parseNumber(rawVal);
                  break;
                case "bcg":
                  c.bcg = parseBcg(rawVal);
                  break;
                default:
                  (c as any)[key] = String(rawVal ?? "").trim();
              }
            }
          }

          if (!c.codigo && !c.solucao) {
            skipped++;
            return;
          }
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
