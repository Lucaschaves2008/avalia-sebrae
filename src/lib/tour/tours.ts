// Configuração de tours por página / módulo.
// Cada Step aponta para um seletor CSS `data-tour="..."` no DOM da página.
// Adicionar novos passos aqui é suficiente — o componente não muda.

export type TourStep = {
  target: string; // seletor CSS, ex: '[data-tour="dashboard-kpis"]'
  title: string;
  description: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  // Se true, permite que o passo apareça mesmo quando o alvo não existe
  // (mostra centralizado, sem spotlight). Útil para intro/fim.
  centeredIfMissing?: boolean;
};

export type TourConfig = {
  key: string;
  steps: TourStep[];
};

// Tour genérico de boas-vindas — pode ser mostrado no primeiro login,
// antes de qualquer página específica.
export const welcomeTour: TourConfig = {
  key: "welcome",
  steps: [
    {
      target: "__none__",
      centeredIfMissing: true,
      title: "Bem-vindo(a) ao AVALIA SEBRAE 👋",
      description:
        "Vamos fazer um tour rápido para você conhecer as principais áreas do sistema. Você pode pular a qualquer momento.",
    },
  ],
};

// Cada chave corresponde à página onde o tour roda.
export const tours: Record<string, TourConfig> = {
  dashboard: {
    key: "dashboard",
    steps: [
      {
        target: '[data-tour="dashboard-header"]',
        title: "Painel principal",
        description:
          "Este é o seu ponto de partida. Aqui você encontra um resumo do processo avaliativo e navega para as demais áreas.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dashboard-nav"]',
        title: "Menu de navegação",
        description:
          "Use estes botões para acessar Cursos, Processos, Pareceres e Relatórios. As opções variam conforme o seu perfil.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dashboard-process"]',
        title: "Processo avaliativo",
        description:
          "Selecione o processo em andamento. Os indicadores e gráficos abaixo são atualizados de acordo com o processo escolhido.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dashboard-kpis"]',
        title: "Indicadores em tempo real",
        description:
          "Acompanhe o progresso das avaliações: cursos a avaliar, avaliações realizadas, completude e pendências.",
        placement: "top",
      },
      {
        target: '[data-tour="help-btn"]',
        title: "Precisa de ajuda?",
        description:
          "Clique em Ajuda a qualquer momento para refazer este tour ou revisar as instruções do sistema.",
        placement: "bottom",
        centeredIfMissing: true,
      },
    ],
  },

  courses: {
    key: "courses",
    steps: [
      {
        target: '[data-tour="courses-title"]',
        title: "Avaliação de Cursos",
        description:
          "Aqui você vê todos os cursos e realiza a sua avaliação. Gestores nacionais também podem cadastrar e importar cursos.",
        placement: "bottom",
      },
      {
        target: '[data-tour="courses-filters"]',
        title: "Filtros inteligentes",
        description:
          "Refine a lista por texto, esforço de confecção e status de avaliação para encontrar rapidamente o que precisa.",
        placement: "bottom",
      },
      {
        target: '[data-tour="courses-list"]',
        title: "Cursos e status",
        description:
          "A barra colorida à esquerda de cada curso indica o status: vermelho para pendente, verde para já avaliado.",
        placement: "top",
      },
    ],
  },

  users: {
    key: "users",
    steps: [
      {
        target: '[data-tour="users-title"]',
        title: "Gestão de Usuários",
        description:
          "Cadastre e gerencie os gestores nacionais e regionais que terão acesso ao sistema.",
        placement: "bottom",
      },
      {
        target: '[data-tour="users-new"]',
        title: "Novo usuário",
        description:
          "Use este botão para criar um novo usuário. A senha inicial pode ser alterada no primeiro acesso.",
        placement: "left",
      },
    ],
  },

  processes: {
    key: "processes",
    steps: [
      {
        target: '[data-tour="processes-title"]',
        title: "Processos Avaliativos",
        description:
          "Defina os processos avaliativos: período, amplitude (Nacional, Regional, Ambos) e os cursos que serão avaliados.",
        placement: "bottom",
      },
      {
        target: '[data-tour="processes-new"]',
        title: "Criar processo",
        description:
          "Ao criar um processo, o parecer final é preparado automaticamente para todos os cursos vinculados.",
        placement: "left",
      },
    ],
  },

  "final-opinions": {
    key: "final-opinions",
    steps: [
      {
        target: '[data-tour="final-opinions-title"]',
        title: "Parecer Final",
        description:
          "A Gerência Nacional consolida aqui a decisão final por curso: Manter, Atualizar ou Inativar.",
        placement: "bottom",
      },
    ],
  },

  reports: {
    key: "reports",
    steps: [
      {
        target: '[data-tour="reports-title"]',
        title: "Relatórios",
        description:
          "Selecione um processo avaliativo e gere o Relatório de Avaliação Global e Priorização para impressão ou PDF.",
        placement: "bottom",
      },
    ],
  },
};

export function getTour(pageKey: string): TourConfig | null {
  return tours[pageKey] ?? null;
}
