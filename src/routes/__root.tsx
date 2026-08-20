import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { ErrorState } from "../components/ErrorState";
import { AuthProvider } from "../lib/auth";
import { TourProvider } from "../lib/tour/TourProvider";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <ErrorState
      error={error}
      boundary="tanstack_root_error_component"
      reset={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "AVALIA SEBRAE - Cursos da Educação Empreendedora" },
      {
        name: "description",
        content:
          "Sistema de avaliação do portifólio de cursos da Educação empreendedora do SEBRAE.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "AVALIA SEBRAE - Cursos da Educação Empreendedora" },
      {
        property: "og:description",
        content:
          "Sistema de avaliação do portifólio de cursos da Educação empreendedora do SEBRAE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "AVALIA SEBRAE - Cursos da Educação Empreendedora" },
      {
        name: "twitter:description",
        content:
          "Sistema de avaliação do portifólio de cursos da Educação empreendedora do SEBRAE.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/25c22f00-6935-45bb-8ed7-c9b9626f9bc0/id-preview-68edef14--81758dd2-0424-43d3-a1d1-1364bd0a8e8b.lovable.app-1782847431550.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/25c22f00-6935-45bb-8ed7-c9b9626f9bc0/id-preview-68edef14--81758dd2-0424-43d3-a1d1-1364bd0a8e8b.lovable.app-1782847431550.png",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="sebrae-app-root">{children}</div>
        <div id="sebrae-portal-root" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // AuthProvider fica AQUI, e não dentro de cada rota: montado uma vez, a
  // sessão é hidratada uma única vez para toda a aplicação. Quando cada
  // página montava o próprio provider, toda navegação relia perfil e papel
  // do usuário no banco e passava pela tela de "Carregando...".
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TourProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </TourProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
