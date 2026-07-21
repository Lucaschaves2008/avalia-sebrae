## Objetivo

Restaurar a animação original do tour (scale-in + transições suaves) e corrigir só o bug em que o card "voava" da esquerda ao avançar para o próximo passo.

## Causa do bug

Ao clicar em "Próximo", o `rect` do alvo anterior permanecia no estado por alguns frames. O card então renderizava na posição antiga e a `transition: top/left 200ms` animava dali até a nova posição — daí o efeito de "sobe, vai pra esquerda, depois pro lugar certo".

## Correção mínima em `src/lib/tour/TourProvider.tsx`

1. Restaurar o visual anterior:
   - Voltar a classe `animate-scale-in` no card.
   - Voltar `transition: top 200ms ease-out, left 200ms ease-out, transform 200ms ease-out`.
   - Voltar `transition-all duration-300 ease-out` no spotlight.
   - Voltar `animate-fade-in` no backdrop de fallback.
   - Voltar `behavior: "smooth"` no `scrollIntoView`.

2. Corrigir só o "voo" lateral:
   - Manter o `setRect(null)` + `setMissing(false)` no início do `useLayoutEffect` (ao trocar de passo), para que o card não renderize na posição antiga.
   - Manter `key={stepIndex}` no card, para o `animate-scale-in` re-executar limpo em cada passo, aparecendo já na posição nova (sem transição de deslocamento vindo do passo anterior).
   - Manter os 250ms de espera antes do `rAF` para dar tempo ao scroll suave assentar antes de medir.

## Resultado esperado

- Primeiro passo: aparece com `scale-in` suave (como antes).
- "Próximo": card some por um instante e reaparece no lugar certo com `scale-in`, sem cruzar a tela vindo da posição anterior. Spotlight continua com transição suave entre alvos.