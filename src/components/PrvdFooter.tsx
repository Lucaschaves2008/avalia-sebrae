interface PrvdFooterProps {
  /** "onDark" for use over the blue brand panel; "onLight" for white backgrounds. */
  variant?: "onDark" | "onLight";
  className?: string;
}

/**
 * "Developed by PRVD." footer note. The PRVD. brandmark is rendered
 * following the official identity: Space Grotesk Bold uppercase, tight
 * tracking, ink lettering with an orange terminating dot, on a paper
 * background chip.
 */
export function PrvdFooter({ variant = "onLight", className }: PrvdFooterProps) {
  const onDark = variant === "onDark";
  const labelClass = onDark ? "text-white/60" : "text-muted-foreground";
  const dividerClass = onDark ? "bg-white/30" : "bg-foreground/30";

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
        className="group inline-flex items-center rounded-[4px] px-2 py-1 transition-transform hover:scale-[1.03]"
        style={{ backgroundColor: "#F7F4EE" }}
      >
        <span
          className="inline-flex items-baseline leading-none"
          style={{
            fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "-0.02em",
            color: "#0F0F0F",
          }}
        >
          PRVD<span style={{ color: "#FF5A1F" }}>.</span>
        </span>
      </a>
    </div>
  );
}
