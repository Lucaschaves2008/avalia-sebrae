# Corrigir o bloco visível no painel de login

## Problema

No painel azul do login a imagem está ancorada só na metade inferior (altura fixa de 62%), com uma cor sólida atrás e um degradê por cima. Isso cria a faixa/linha horizontal visível no meio do painel — o "bloco" que aparece no print.

## Correção

- Fazer a imagem ocupar o painel inteiro (`inset-0`, `object-cover`, ancorada na base), sem altura fixa, para não haver emenda.
- Trocar o degradê por uma única sobreposição suave: azul forte no topo, quase transparente sobre o prédio na base — sem mudanças bruscas de opacidade.
- Manter a cor azul de fundo apenas como fallback enquanto a imagem carrega (mesmo tom do topo da foto, evitando "flash").
- Manter o texto na posição atual (acima do prédio), a tipografia fluida e o preload da imagem WebP otimizada.

## Detalhes técnicos

Arquivo: `src/routes/login.tsx`, painel de marca (bloco `lg:flex`).
- `img`: `absolute inset-0 h-full w-full object-cover object-bottom`.
- Overlay único: `linear-gradient(180deg, #0f2f7f 0%, rgba(15,47,127,0.85) 42%, rgba(10,38,105,0.35) 100%)`.
- Nenhuma mudança de conteúdo, formulário ou lógica de autenticação.
