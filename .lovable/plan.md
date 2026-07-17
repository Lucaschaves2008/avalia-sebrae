## Diagnóstico confirmado

O erro mostrado na imagem não é um bloqueio direto do Zscaler ao banco. A mensagem real é:

```text
Unauthorized: No authorization header provided
```

Pelo código atual, a página de Cursos dispara `useCoursesList`, `useProcessesList` e `useJudgmentsList` antes de confirmar que a sessão do usuário já foi hidratada. Essas consultas chamam funções protegidas no backend, que exigem o token no header `Authorization`. Quando a tela abre pela primeira vez, o token ainda pode não estar disponível para o middleware; ao clicar em “Tentar novamente”, a sessão já terminou de carregar e tudo funciona.

Ou seja: o Zscaler/Browser Isolation aumenta a chance de lentidão e timing instável, mas a falha concreta é uma corrida entre hidratação da sessão e carregamento de dados protegidos.

## Plano de correção

### 1. Bloquear consultas protegidas até a sessão estar pronta
- Refatorar a tela de Cursos para separar:
  - camada de autenticação/carregamento de sessão;
  - camada de dados dos cursos/processos/avaliações.
- Só montar os hooks de dados depois que `AuthProvider` confirmar um usuário válido.
- Isso elimina as chamadas protegidas sem `Authorization` no primeiro carregamento.

### 2. Aplicar a mesma proteção nas demais telas autenticadas
Revisar e ajustar as telas que usam os mesmos caches protegidos:
- Dashboard
- Processos Avaliativos
- Parecer Final
- Relatórios
- Usuários

O objetivo é impedir que qualquer página autenticada dispare dados protegidos antes da sessão estar pronta.

### 3. Tornar os caches resilientes a erro transitório de autenticação
- Tratar `Unauthorized: No authorization header provided` como erro transitório de hidratação, não como erro final imediato.
- Ao detectar esse caso, fazer uma nova tentativa curta após a sessão estar disponível.
- Manter a página de erro apenas para falhas persistentes reais.

### 4. Criar um “bootstrap” único de sessão
- Centralizar no `AuthProvider` um estado claro de sessão pronta.
- Garantir que `getSession()`/evento de auth termine antes das telas internas iniciarem chamadas de backend.
- Evitar que cada página tente resolver isso de forma diferente.

### 5. Manter a arquitetura resiliente ao Zscaler
- Preservar o proxy same-origin `/supa-api` para login/autenticação e chamadas do cliente.
- Preservar as funções server-side para dados críticos.
- Manter o navegador falando apenas com o domínio da aplicação sempre que possível.
- Não reintroduzir chamadas diretas do navegador ao domínio externo do backend.

### 6. Melhorar o comportamento visual
- Remover mensagens precipitadas de falha quando a sessão ainda está carregando.
- Mostrar “Carregando...” enquanto o app confirma a sessão.
- Só mostrar “Tentar novamente” se a falha continuar depois da tentativa automática.

### 7. Ajuste visual pendente da logo
- Trocar o uso da logo azul em placa branca por versão branca/sem fundo quando estiver sobre cabeçalho azul/escuro.

### 8. Validação
- Testar o fluxo de login e atualização direta em `/courses`.
- Validar que a primeira entrada na tela de Cursos não gera mais erro de autorização.
- Confirmar que o botão “Tentar novamente” deixa de ser necessário no caso comum.
- Verificar que cursos, processos e avaliações continuam carregando normalmente para gestor regional e gestor nacional.