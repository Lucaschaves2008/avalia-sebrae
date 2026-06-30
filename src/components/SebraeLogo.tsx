import sebraeLogoAsset from "@/assets/sebrae-logo.svg.asset.json";

interface SebraeLogoProps {
  className?: string;
  /**
   * "onDark" wraps the blue official logo in a white rounded plate so it stays
   * visible over dark/blue backgrounds. "onLight" renders the bare logo for
   * use over white/light surfaces.
   */
  variant?: "onDark" | "onLight";
  /** Height of the logo in pixels. Width auto-scales to preserve ratio. */
  height?: number;
}

export function SebraeLogo({
  className,
  variant = "onDark",
  height = 40,
}: SebraeLogoProps) {
  const img = (
    <img
      src={sebraeLogoAsset.url}
      alt="SEBRAE — Educação Empreendedora"
      style={{ height, width: "auto" }}
      className="block"
    />
  );

  if (variant === "onLight") {
    return <div className={className}>{img}</div>;
  }

  return (
    <div className={className}>
      <div className="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-white/30">
        {img}
      </div>
    </div>
  );
}
