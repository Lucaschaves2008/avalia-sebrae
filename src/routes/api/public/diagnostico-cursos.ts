import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/diagnostico-cursos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { count, error } = await supabaseAdmin
            .from("courses")
            .select("id", { count: "exact", head: true });

          if (error) {
            console.error("[diagnostico-cursos] backend read failed:", error);
            return Response.json(
              { ok: false, error: "Falha ao consultar cursos pelo servidor do aplicativo." },
              { status: 502, headers: { "cache-control": "no-store" } },
            );
          }

          return Response.json(
            { ok: true, coursesCount: count ?? 0 },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          console.error("[diagnostico-cursos] unexpected failure:", error);
          return Response.json(
            { ok: false, error: "Falha inesperada no diagnóstico de cursos." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
