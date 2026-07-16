## Diagnóstico inicial

- O backend hospedado está saudável.
- Existem 11 cursos cadastrados no banco; eles não foram apagados.
- A usuária `juliana.chaves@sebrae.com.br` está ativa e com perfil de administração/GN.
- As regras atuais permitem leitura de cursos por usuários autenticados e gerenciamento por administração/GN.
- O sintoma da imagem indica que a tela está caindo para lista vazia sem mostrar o erro real quando alguma chamada de dados falha.

## Referência Zscaler consultada

A documentação oficial do Zscaler confirma que:

- O Zscaler pode descriptografar/inspecionar HTTPS e isso pode interferir em tráfego de aplicações web.
- É possível isentar URLs da SSL Inspection criando uma categoria customizada de URLs e aplicando uma regra com ação “Do Not Inspect”.
- A Zscaler recomenda testar aplicações críticas e criar exceções permanentes quando a inspeção quebra o funcionamento.
- No caso de Browser Isolation/Zscaler, a URL visível ao navegador pode mudar, então depender de chamadas diretas do navegador para APIs externas é frágil.

## Causa mais provável

A página de cursos ainda depende de chamadas do navegador para rotas de banco via `/supa-api/rest/v1/...`. Mesmo sendo same-origin, o Zscaler ainda pode inspecionar ou reescrever essas chamadas, especialmente quando a aplicação abre dentro do isolamento.

Além disso, a tela de cursos hoje silencia falhas: se a consulta retorna erro, o cache vira `[]`, e o usuário vê apenas “Nenhum curso encontrado”, como se não houvesse dados.

## Plano de correção

### 1. Tirar Cursos do caminho frágil do navegador

Criar funções server-side autenticadas para a área de cursos:

- carregar cursos;
- criar/editar curso;
- excluir curso;
- importar cursos;
- carregar processos e vínculos de processo usados pela tela;
- carregar avaliações/julgamentos usados na mesma tela.

Assim o navegador passa a falar apenas com o próprio app, e o servidor do app fala com o banco fora da rede/Zscaler do usuário.

### 2. Manter segurança por perfil

Nas funções server-side:

- usuários autenticados podem visualizar cursos conforme regra atual;
- GN/admin pode criar, importar, editar e excluir cursos;
- regionais seguem podendo avaliar conforme o fluxo existente;
- nenhuma operação administrativa será liberada apenas pelo frontend.

### 3. Corrigir a experiência quando houver erro

Na tela de cursos:

- substituir “Nenhum curso encontrado” por mensagem real quando houver falha de carregamento;
- mostrar botão “Tentar novamente”;
- manter “Nenhum curso encontrado” somente quando a consulta funcionar e realmente voltar vazia;
- exibir um detalhe simples para suporte: “falha ao carregar cursos/processos/avaliações”.

### 4. Fortalecer diagnóstico para Zscaler

Atualizar `/diagnostico` para testar especificamente:

- app online;
- autenticação pelo app;
- leitura de cursos via novo caminho server-side;
- leitura antiga via `/supa-api/rest/v1/courses` apenas como comparação;
- gerar relatório copiável para TI com recomendação de allowlist/Do Not Inspect do domínio do app.

### 5. Atualizar documentação interna

Atualizar `docs/ZSCALER.md` com:

- orientação oficial resumida do Zscaler: categoria customizada + regra “Do Not Inspect”;
- domínios/endereço do sistema a liberar;
- explicação de que Cursos agora usa server-side como caminho preferencial;
- como interpretar quando “usuários funciona, cursos não”.

### 6. Verificação

Após implementar:

- verificar que Juliana/GN vê os 11 cursos;
- verificar botões de importar, editar, excluir e novo curso para GN/admin;
- verificar que regional consegue visualizar/avaliar conforme processo ativo;
- verificar que a tela nunca mostra lista vazia falsa quando a chamada falha;
- validar `/diagnostico` e o relatório para TI.

## Fora deste plano

O texto sobre “Caverna — Módulo Extra: Relógio de Estudo” parece pertencer a outro projeto. Não vou implementar esse módulo neste app AVALIA SEBRAE dentro desta correção, para não misturar escopos.