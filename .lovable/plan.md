
## Objetivo

Permitir que novos usuários criem a própria conta direto na tela de login, sem depender da Juliana (Gestão Nacional). O novo usuário entra ativo como **Gestor Regional** e já pode avaliar cursos.

## Fluxo

1. Na tela `/login`, adicionar um link **"Criar conta"** abaixo do formulário de acesso.
2. Ao clicar, alternar o painel branco (metade esquerda) para o modo **"Criar conta"**, mantendo a metade azul do SEBRAE intacta. Layout inspirado na referência enviada, sem o campo *Workspace* nem *Código de convite*.
3. Campos do formulário de cadastro:
   - Nome completo
   - E-mail
   - Senha
   - Confirmar senha
   - Região (select — as 5 regiões)
   - UF (select — filtrado pela Região)
   - Unidade (texto, ex.: "SEBRAE SP")
4. Ao submeter:
   - Validar senhas iguais e mínimo 8 caracteres.
   - Chamar `supabase.auth.signUp` com `user_metadata` (name, phone vazio, unity, region) — a trigger `handle_new_user` já cria o profile e atribui papel `gestor` (o primeiro usuário do sistema vira admin automaticamente, mas isso não se aplica aqui já que a Juliana existe).
   - Após o signUp bem-sucedido, fazer login automático com `signInWithPassword` e redirecionar para `/dashboard`.
   - Marcar `is_first_access = false` no profile (o usuário definiu a própria senha, não precisa forçar troca).
   - Definir `state` no profile a partir da UF escolhida.
5. Exibir toasts de sucesso/erro e estado de loading no botão, no mesmo padrão do login atual.

## Detalhes técnicos

- Estender `AuthContextValue.signUp` em `src/lib/auth.tsx` para aceitar também `state` e retornar `{ ok, user }`, atualizando o profile com `state` e `is_first_access = false` logo após o signUp (ou fazer isso no próprio componente de cadastro após o login automático).
- Em `src/routes/login.tsx`, adicionar um estado local `mode: "login" | "signup"` que troca o conteúdo do painel branco. O painel azul do SEBRAE e o `PrvdFooter` permanecem inalterados.
- Reutilizar `REGIONS` e `STATES_BY_REGION` já exportados de `src/lib/auth.tsx`.
- Auto-confirm de e-mail deve estar habilitado (via `supabase--configure_auth` com `auto_confirm_email: true`) para o usuário entrar direto sem precisar clicar em link de e-mail.
- Nenhuma alteração no banco é necessária — a trigger `handle_new_user` já cuida da criação de profile + role `gestor`.
- Nenhuma mudança nas policies de RLS: `gestor` já enxerga cursos como qualquer usuário logado (comportamento atual).

## Fora do escopo

- Não incluir campo Workspace nem Código de convite.
- Não alterar o fluxo de "primeiro acesso obrigatório" para usuários criados pela Juliana (esse continua exigindo troca de senha).
- Não mexer no painel azul do SEBRAE nem no rodapé PRVD.
