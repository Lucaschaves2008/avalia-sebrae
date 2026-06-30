# Processos Avaliativos

Nova entidade que organiza ciclos de avaliação de cursos por período, amplitude (nacional/regional/ambos) e lista de cursos vinculados. Avaliações passam a ser feitas **dentro** de um processo.

## 1. Banco de dados (migração)

### Limpeza
- `DELETE FROM judgments` (zera avaliações existentes para evitar conflito com novo FK).

### Nova tabela `evaluation_processes`
- `id uuid pk`
- `name text not null`
- `description text`
- `start_date date not null`
- `end_date date not null`
- `scope text not null check in ('NACIONAL','REGIONAL','AMBOS')`
- `status text not null default 'ATIVO' check in ('ATIVO','INATIVO','FINALIZADO')`
- `created_by uuid references auth.users`
- `created_at`, `updated_at` timestamps + trigger

### Nova tabela `evaluation_process_courses` (N:N)
- `process_id uuid references evaluation_processes(id) on delete restrict`
- `course_id uuid references courses(id) on delete restrict`
- `primary key (process_id, course_id)`

### Alteração em `judgments`
- Adicionar `process_id uuid not null references evaluation_processes(id) on delete restrict`
- Trocar unique `(course_id, user_id)` por `(process_id, course_id, user_id)`
- FK `course_id → courses(id) on delete restrict` (já existe, garantir RESTRICT)

### Status derivado
- View / função helper que retorna status efetivo: se `end_date < today` e status='ATIVO' → 'FINALIZADO'. Manter coluna persistida + cálculo no frontend.

### RLS / GRANTs
- `evaluation_processes`: SELECT todos autenticados (gestores precisam ver processos ativos). INSERT/UPDATE/DELETE só `admin` (super admin + gestor nacional, ambos = role `admin`).
- `evaluation_process_courses`: SELECT autenticados; mutações só admin.
- Atualizar policies de `judgments` para também filtrar por `process_id` quando aplicável (mantém regra atual de usuário/região).

## 2. Backend / lib

- `src/lib/processes.ts`: CRUD + cache reativo (useSyncExternalStore como `judgments.ts`). Funções: `listProcesses`, `useProcessesList`, `upsertProcess`, `deleteProcess`, `setProcessCourses`, `getActiveProcesses(role, region)`, `computeEffectiveStatus`.
- `src/lib/judgments.ts`: incluir `processId` em todas as operações (upsert key passa a `(process_id, course_id, user_id)`).

## 3. UI

### Nova rota `/processes` (somente admin)
- Lista de processos com nome, período, amplitude, status (badge), # cursos vinculados.
- Drawer/Dialog de criação/edição:
  - Nome, descrição, datas, amplitude, status
  - Seleção múltipla de cursos (busca + checkbox list)
- Botão excluir (bloqueado se houver `judgments` vinculados — mostrar toast).

### Dashboard (admin/nacional)
- Seletor de processo no topo (carrega últimos ativos, default = mais recente).
- Todos os KPIs (cursos a avaliar, avaliações cadastradas, prontidão, regiões ativas, distribuição) recalculados a partir dos cursos vinculados ao processo selecionado e judgments com aquele `process_id`.

### Acesso regional
- Rota `/courses` passa a exibir primeiro a lista de **processos ativos** aplicáveis à amplitude do gestor.
- Ao selecionar um processo, mostra a lista de cursos vinculados com o mesmo comportamento atual (card vermelho/verde, drawer de avaliação). Avaliações são salvas com `process_id`.

### Navegação
- Adicionar link "Processos" no header para admin.

## Detalhes técnicos

- Migração única com DELETE, CREATE TABLEs (com GRANTs antes de RLS), ALTER judgments, novas policies.
- Status "FINALIZADO" calculado em runtime quando `end_date < hoje`; opcionalmente um cron/trigger futuro — fora de escopo.
- Toda página `/processes` e seletor do dashboard ficam atrás do role `admin`.
- Regional vê apenas processos com `scope in ('REGIONAL','AMBOS')` e status efetivo ATIVO.
- Nacional/admin vê processos com `scope in ('NACIONAL','AMBOS')` no dashboard.

Após aprovação executo a migração e em seguida as alterações de código.