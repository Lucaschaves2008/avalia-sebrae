import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachReadySupabaseAuth } from "@/lib/supabase-auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // Apenas UM anexador de token. Antes rodavam dois em sequência
  // (attachSupabaseAuth + attachReadySupabaseAuth): ambos liam a sessão e o
  // segundo sobrescrevia o header do primeiro, dobrando o trabalho em toda
  // chamada de server function sem nenhum efeito adicional.
  // attachReadySupabaseAuth é o mais completo — também aguarda a sessão
  // quando a chamada acontece durante a inicialização do app.
  functionMiddleware: [attachReadySupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
