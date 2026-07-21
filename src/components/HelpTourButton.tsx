import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTour } from "@/lib/tour/TourProvider";

/**
 * Botão "Fazer Tour" — reinicia manualmente o tour da página atual.
 * Colocar dentro do header de cada página, passando `pageKey`.
 */
export function HelpTourButton({
  pageKey,
  variant = "onDark",
  label = "Ajuda",
}: {
  pageKey: string;
  variant?: "onDark" | "default";
  label?: string;
}) {
  const { startTour } = useTour();
  const onDark = variant === "onDark";
  return (
    <Button
      variant="outline"
      size="sm"
      data-tour="help-btn"
      onClick={() => startTour(pageKey)}
      className={
        onDark
          ? "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          : ""
      }
    >
      <HelpCircle className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
