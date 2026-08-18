import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Baixa o código da rota assim que o usuário demonstra intenção (hover ou
    // foco no item de menu). Como as rotas são code-split, sem isso o clique
    // só começa a buscar o chunk depois — o que pesa em redes lentas ou com
    // proxy corporativo no caminho.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
