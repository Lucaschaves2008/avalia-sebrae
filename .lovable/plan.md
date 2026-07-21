## Ajustes no AppShell (sidebar)

### 1. Logo do SEBRAE alinhada à esquerda
No header da sidebar (`src/components/AppShell.tsx`), trocar o container que hoje centraliza a logo (`justify-center`) por alinhamento à esquerda (`justify-start`), mantendo padding lateral consistente com os itens do menu (px-5) para que a logo fique na mesma linha vertical dos rótulos "WORKSPACE" e dos ícones abaixo.

### 2. Botão de recolher redondo, discreto, igual à referência
Reestilizar o botão de collapse para replicar o visual da imagem enviada:

- Formato totalmente redondo (`rounded-full`), tamanho compacto (~28px).
- Fundo branco sólido com leve sombra suave (não translúcido/blur).
- Borda muito sutil em cinza claro.
- Ícone chevron cinza escuro discreto (não branco).
- Posicionado flutuando na borda direita da sidebar, sobreposto à divisa com o conteúdo, aproximadamente na altura da linha "WORKSPACE".
- Hover sutil (leve escurecimento do fundo), sem efeito chamativo.

### Detalhes técnicos

Arquivo único: `src/components/AppShell.tsx`

- Header logo: `flex h-16 items-center justify-start px-5 border-b border-white/10`.
- Botão collapse:
  - Classes: `absolute top-[72px] -right-3 z-20 hidden h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 lg:inline-flex`
  - Ícone: `ChevronLeft` / `ChevronRight` em `h-3.5 w-3.5`.

Nenhuma outra alteração de layout, tokens ou comportamento.