import sebraeLogoAsset from "@/assets/sebrae-logo.svg.asset.json";
import sebraeLogoWhite from "@/assets/sebrae-logo-white.png";

interface SebraeLogoProps {
  className?: string;
  /**
   * "onDark" renders the white official logo without a plate for dark/blue
   * backgrounds. "onLight" renders the blue logo for white/light surfaces.
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
      src={variant === "onDark" ? sebraeLogoWhite : sebraeLogoAsset.url}
      alt="SEBRAE — Educação Empreendedora"
      style={{ height, width: "auto" }}
      className="block"
    />
  );

  if (variant === "onLight") {
    return <div className={className}>{img}</div>;
  }

  return <div className={className}>{img}</div>;
}
