# AVALIA SEBRAE × Zscaler — diagnóstico e solução

Este documento explica por que o sistema apresentava falhas nos computadores
do SEBRAE, o que foi feito no código para resolver, e o que a equipe de TI
pode fazer para garantir 100% de estabilidade.

## 1. O problema

Os computadores da equipe do SEBRAE navegam através do **Zscaler** (Zscaler
Internet Access), um serviço de segurança corporativa que fica entre o
navegador e a internet. Ele:

- **Filtra por categoria/reputação de domínio** — domínios "novos",
  "não categorizados" ou de "hospedagem em nuvem" são frequentemente
  bloqueados por padrão;
- **Inspeciona TLS (SSL inspection)** — abre e reassina as conexões HTTPS,
  o que pode derrubar ou atrasar conexões de longa duração;
- **Bloqueia silenciosamente** — muitas vezes a requisição simplesmente
  não responde ou devolve uma página de bloqueio, sem erro claro.

### Por que "o banco de dados some"

O sistema é hospedado na Lovable Cloud e usa **Supabase** como banco de
dados. Até esta correção, o **navegador do usuário falava diretamente**
com o Supabase em:

```
https://cmkshrksrrxacfxojxch.supabase.co
```

Ou seja, o funcionamento dependia de **dois domínios** liberados na rede:
o domínio do site **e** o `*.supabase.co`. O Zscaler costuma bloquear o
segundo (domínio de nuvem, fora da lista de permitidos do SEBRAE). O
resultado é exatamente o sintoma relatado:

- a página abre (o domínio do site está liberado),
- mas login, listas e avaliações não carregam — **"o banco sumiu"**,
- sem nenhuma mensagem de erro clara.

## 2. O que foi alterado no código

### a) Proxy same-origin (`/supa-api`) — correção principal

Toda a comunicação do navegador com o banco agora passa pelo **próprio
domínio do site** (`https://<dominio-do-site>/supa-api/...`). O servidor
do aplicativo repassa as chamadas ao Supabase por fora da rede do SEBRAE.

```
ANTES  navegador ──X── Zscaler ──── *.supabase.co   (bloqueado)
AGORA  navegador ───── Zscaler ──── dominio-do-site ──── *.supabase.co
                       (tráfego same-origin, liberado)   (feito pelo servidor)
```

Para o Zscaler, o tráfego de dados é indistinguível do próprio site.
Nenhuma credencial é adicionada no proxy: o token do usuário continua
vindo do navegador e todas as regras de segurança (RLS) do banco
continuam valendo.

Arquivos: `src/routes/supa-api.$.tsx`, `src/integrations/supabase/client.ts`.

### b) Tolerância a instabilidade

Conexões atravessando proxy corporativo caem ou "penduram" com mais
frequência. Agora toda chamada ao banco tem **timeout de 20 s** e até
**2 novas tentativas automáticas** com espera progressiva
(`src/lib/resilient-fetch.ts`).

### c) Aviso visível em vez de tela vazia

Se mesmo assim o banco ficar inacessível, um **banner amarelo** aparece no
topo de todas as telas com botão "Tentar novamente" e link para o
diagnóstico (`src/components/ConnectionBanner.tsx`). O erro de login por
falha de rede também passou a ter mensagem clara em português.

### d) Página de diagnóstico — `/diagnostico`

Acessível sem login. Testa, na máquina do usuário:

1. conexão de rede local;
2. acesso ao servidor do aplicativo;
3. acesso ao banco **através do aplicativo** (caminho novo);
4. acesso **direto** ao Supabase (informativo — é o caminho antigo).

Gera um **relatório copiável** para enviar à TI. Se o teste 4 falhar e o
3 passar, está comprovado que a rede bloqueia o Supabase — e que o sistema
segue funcionando mesmo assim.

## 3. Recomendações para a TI do SEBRAE (defesa em profundidade)

Mesmo com o sistema funcionando via proxy, recomenda-se:

1. **Liberar (allowlist) o domínio do site** no Zscaler — é o único
   domínio do qual o sistema depende agora. Se o site estiver em domínio
   `*.lovable.app`, liberar esse host específico.
2. **Opcional:** liberar também `cmkshrksrrxacfxojxch.supabase.co`
   (ou `*.supabase.co`) — dá um caminho alternativo, mas deixou de ser
   obrigatório.
3. **Isentar o domínio do site da SSL inspection** (SSL bypass), se a
   política permitir — reduz latência e quedas de conexão.
4. **Fortemente recomendado: domínio próprio.** Publicar o sistema em um
   subdomínio institucional (ex.: `avalia.sebrae.com.br` ou um domínio da
   Providence) — domínios estabelecidos raramente caem em bloqueio por
   categoria/reputação, e a liberação na TI fica trivial. A Lovable
   suporta domínio personalizado em *Settings → Domains*.

## 4. Recuperação de senha por e-mail (ação pendente no painel)

O e-mail padrão de "esqueci minha senha" do Supabase contém um link para
`*.supabase.co` — que o Zscaler também bloqueia. O código já suporta o
fluxo alternativo em que o link aponta **direto para o site**; para
ativá-lo, altere o template no painel do Supabase (via Lovable Cloud:
*Authentication → Emails → Reset password*), trocando o link
`{{ .ConfirmationURL }}` por:

```
{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery
```

Com isso, o link do e-mail abre o próprio site e o token é validado pelo
proxy same-origin, sem depender do `*.supabase.co`. O link antigo continua
funcionando fora da rede do SEBRAE (fallback mantido no código).

## 5. Como investigar um novo incidente

1. Peça ao usuário para abrir `https://<dominio-do-site>/diagnostico`.
2. Clique em **"Copiar relatório para a TI"** e envie o texto.
3. Interpretação rápida:

| Teste 2 (site) | Teste 3 (banco via app) | Teste 4 (Supabase direto) | Conclusão |
| --- | --- | --- | --- |
| ✅ | ✅ | ❌ | Rede bloqueia Supabase; sistema OK pelo proxy. Nada a fazer (ou liberar Supabase). |
| ✅ | ✅ | ✅ | Tudo liberado. Incidente foi pontual. |
| ❌ | — | — | Rede bloqueia o próprio site → TI precisa liberar o domínio do site. |
| ✅ | ❌ | — | Problema no servidor do app ↔ Supabase (não é a rede do SEBRAE) → acionar suporte/Lovable. |

## 6. Observações técnicas

- O proxy (`/supa-api`) só encaminha os caminhos `auth/v1`, `rest/v1`,
  `storage/v1` e `functions/v1`, sempre para a URL fixa do projeto
  Supabase, e não injeta chaves — não amplia a superfície de ataque.
- `VITE_SUPABASE_DIRECT="true"` (variável de build) desativa o proxy e
  volta ao acesso direto, se algum dia for necessário.
- As sessões já existentes foram preservadas (mesma chave de
  armazenamento `sb-<ref>-auth-token`).
- A fonte Inter é carregada do Google Fonts; se a rede bloquear
  `fonts.googleapis.com`, o sistema continua funcionando com a fonte
  padrão do sistema (impacto apenas visual).
