interface PrvdFooterProps {
  /** "onDark" for use over the blue brand panel; "onLight" for white backgrounds. */
  variant?: "onDark" | "onLight";
  className?: string;
}

/**
 * Small "Developed by PRVD." footer note, inspired by the atalaia.vc header
 * treatment. Kept intentionally compact so it can sit at the foot of the login
 * brand panel and the dashboard.
 */
export function PrvdFooter({ variant = "onLight", className }: PrvdFooterProps) {
  const onDark = variant === "onDark";
  const labelClass = onDark ? "text-white/60" : "text-muted-foreground";
  const dividerClass = onDark ? "bg-white/30" : "bg-foreground/30";
  const brandClass = onDark
    ? "text-white hover:text-secondary"
    : "text-foreground hover:text-primary";

  return (
    <div
      className={`flex items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] ${labelClass} ${className ?? ""}`}
    >
      <span>Desenvolvido por</span>
      <span className={`h-3 w-px ${dividerClass}`} aria-hidden />
      <a
        href="http://providence.solutions"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Providence Solutions — PRVD."
        className={`group inline-flex items-baseline gap-0.5 font-black tracking-[0.18em] transition-colors ${brandClass}`}
      >
        <span className="text-sm">PRVD</span>
        <span className="text-sm text-secondary">.</span>
      </a>
    </div>
  );
}
