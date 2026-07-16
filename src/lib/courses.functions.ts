import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Course } from "./courses";
import {
  appendCoursesForAdmin,
  deleteCourseForAdmin,
  listCoursesForUser,
  replaceCoursesForAdmin,
  upsertCourseForAdmin,
} from "./courses.server";

export const listCoursesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listCoursesForUser(context));

export const upsertCourseServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { course: Course; isNew?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await upsertCourseForAdmin(context, data.course, data.isNew);
    return { ok: true as const };
  });

export const deleteCourseServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await deleteCourseForAdmin(context, data.id);
    return { ok: true as const };
  });

export const replaceCoursesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courses: Course[] }) => input)
  .handler(async ({ data, context }) => {
    await replaceCoursesForAdmin(context, data.courses);
    return { ok: true as const };
  });

export const appendCoursesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courses: Course[] }) => input)
  .handler(async ({ data, context }) => {
    return appendCoursesForAdmin(context, data.courses);
  });
