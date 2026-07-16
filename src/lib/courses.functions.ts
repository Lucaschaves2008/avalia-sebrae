import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Course, CourseMaterials, CourseFgv, FgvRating } from "./courses";

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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function sanitizeCourse(input: Course): Course {
  const materials: CourseMaterials = { ...input.materials };
  const fgv: CourseFgv = { ...input.fgv };
  return { ...input, materials, fgv };
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Apenas a Gerência Nacional pode gerenciar cursos.");
}

export const listCoursesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select("*")
      .order("solution_name", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as DbCourse[]).map(rowToCourse);
  });

export const upsertCourseServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { course: Course; isNew?: boolean }) => ({
    course: sanitizeCourse(input.course),
    isNew: !!input.isNew,
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const row = courseToRow(data.course);
    if (!row.id) throw new Error("Código do produto é obrigatório.");

    if (data.isNew) {
      const { data: existing, error: checkErr } = await context.supabase
        .from("courses")
        .select("id")
        .eq("id", row.id)
        .maybeSingle();
      if (checkErr) throw new Error(checkErr.message);
      if (existing) throw new Error(`Já existe um curso cadastrado com o código "${row.id}".`);
    }

    const { error } = await context.supabase.from("courses").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCourseServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const replaceCoursesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courses: Course[] }) => ({
    courses: input.courses.map(sanitizeCourse),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: existing, error: fetchErr } = await context.supabase.from("courses").select("id");
    if (fetchErr) throw new Error(fetchErr.message);

    const keepIds = new Set(data.courses.map((c) => (c.codigo || c.id).trim()).filter(Boolean));
    const toRemove = ((existing ?? []) as { id: string }[])
      .filter((c) => !keepIds.has(c.id))
      .map((c) => c.id);
    if (toRemove.length) {
      const { error } = await context.supabase.from("courses").delete().in("id", toRemove);
      if (error) throw new Error(error.message);
    }
    if (data.courses.length) {
      const { error } = await context.supabase.from("courses").upsert(data.courses.map(courseToRow));
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const appendCoursesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courses: Course[] }) => ({
    courses: input.courses.map(sanitizeCourse),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const errors: string[] = [];
    let inserted = 0;
    if (!data.courses.length) return { inserted, errors };

    const byId = new Map<string, ReturnType<typeof courseToRow>>();
    for (const course of data.courses) {
      const row = courseToRow(course);
      if (row.id) byId.set(row.id, row);
    }

    const rows = Array.from(byId.values());
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error, data: saved } = await context.supabase
        .from("courses")
        .upsert(batch, { onConflict: "id" })
        .select("id");
      if (error) errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      else inserted += saved?.length ?? batch.length;
    }

    return { inserted, errors };
  });
