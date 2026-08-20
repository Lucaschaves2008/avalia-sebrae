const PORTAL_ROOT_ID = "sebrae-portal-root";

/**
 * Mantém menus e modais fora do `body` compartilhado com extensões,
 * tradutores automáticos e agentes de segurança do navegador.
 */
export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.getElementById(PORTAL_ROOT_ID) ?? undefined;
}

export { PORTAL_ROOT_ID };