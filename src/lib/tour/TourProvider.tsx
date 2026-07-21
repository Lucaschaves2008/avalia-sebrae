import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";

import { getTour, type TourConfig, type TourStep } from "./tours";

// -------- Storage helpers --------

const STORAGE_PREFIX = "sebrae:tour:v1";

function storageKey(userId: string, pageKey: string) {
  return `${STORAGE_PREFIX}:${userId}:${pageKey}`;
}

function isTourDone(userId: string | null, pageKey: string): boolean {
  if (!userId || typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey(userId, pageKey)) === "done";
  } catch {
    return true;
  }
}

function markTourDone(userId: string | null, pageKey: string) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId, pageKey), "done");
  } catch {
    /* ignore quota */
  }
}

// -------- Context --------

type StartOptions = { onlyIfFirstAccess?: boolean };

type TourContextValue = {
  isActive: boolean;
  currentPageKey: string | null;
  startTour: (pageKey: string, options?: StartOptions) => void;
  stopTour: () => void;
  setUserId: (id: string | null) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour deve ser usado dentro de <TourProvider>");
  }
  return ctx;
}

// -------- Provider --------

export function TourProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTour, setActiveTour] = useState<TourConfig | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const stopTour = useCallback(() => {
    if (activeTour) markTourDone(userId, activeTour.key);
    setActiveTour(null);
    setStepIndex(0);
  }, [activeTour, userId]);

  const startTour = useCallback(
    (pageKey: string, options?: StartOptions) => {
      const cfg = getTour(pageKey);
      if (!cfg || cfg.steps.length === 0) return;
      if (options?.onlyIfFirstAccess && isTourDone(userId, cfg.key)) return;
      setActiveTour(cfg);
      setStepIndex(0);
    },
    [userId],
  );

  const value = useMemo<TourContextValue>(
    () => ({
      isActive: !!activeTour,
      currentPageKey: activeTour?.key ?? null,
      startTour,
      stopTour,
      setUserId,
    }),
    [activeTour, startTour, stopTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour ? (
        <TourOverlay
          tour={activeTour}
          stepIndex={stepIndex}
          onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (stepIndex >= activeTour.steps.length - 1) stopTour();
            else setStepIndex((i) => i + 1);
          }}
          onSkip={stopTour}
        />
      ) : null}
    </TourContext.Provider>
  );
}

// -------- Auto-start helper (mount inside a page) --------

/**
 * Coloque este componente em uma página para iniciar automaticamente o tour
 * daquela página no primeiro acesso do usuário.
 *
 * <TourAutoStart pageKey="dashboard" userId={user.id} />
 */
export function TourAutoStart({
  pageKey,
  userId,
  delayMs = 600,
}: {
  pageKey: string;
  userId: string | null | undefined;
  delayMs?: number;
}) {
  const { startTour, setUserId } = useTour();
  const startedRef = useRef(false);

  useEffect(() => {
    setUserId(userId ?? null);
  }, [userId, setUserId]);

  useEffect(() => {
    if (startedRef.current) return;
    if (!userId) return;
    startedRef.current = true;
    const t = window.setTimeout(() => {
      startTour(pageKey, { onlyIfFirstAccess: true });
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [pageKey, userId, startTour, delayMs]);

  return null;
}

// -------- Overlay + Spotlight + Card --------

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;
const CARD_WIDTH = 340;
const CARD_GAP = 14;

function useTargetRect(step: TourStep): { rect: Rect | null; missing: boolean } {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  useLayoutEffect(() => {
    if (step.target === "__none__") {
      setMissing(true);
      setRect(null);
      return;
    }
    let raf = 0;
    let cancelled = false;

    const measure = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) {
        setMissing(true);
        setRect(null);
        return;
      }
      setMissing(false);
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
    };

    const tick = () => {
      if (cancelled) return;
      measure();
      raf = window.requestAnimationFrame(tick);
    };

    // Scroll o elemento até uma posição confortável antes de medir.
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch {
        el.scrollIntoView();
      }
    }

    const startTimer = window.setTimeout(() => {
      tick();
    }, 250);

    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [step.target]);

  return { rect, missing };
}

function computeCardPosition(
  rect: Rect | null,
  placement: TourStep["placement"] = "auto",
): { top: number; left: number; centered: boolean } {
  if (typeof window === "undefined") {
    return { top: 0, left: 0, centered: true };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  if (!rect) {
    return {
      top: scrollY + vh / 2 - 120,
      left: scrollX + vw / 2 - CARD_WIDTH / 2,
      centered: true,
    };
  }

  const spaceBelow = vh - (rect.top - scrollY + rect.height);
  const spaceAbove = rect.top - scrollY;
  const spaceRight = vw - (rect.left - scrollX + rect.width);
  const spaceLeft = rect.left - scrollX;

  let choice = placement;
  if (choice === "auto" || !choice) {
    if (spaceBelow > 240) choice = "bottom";
    else if (spaceAbove > 240) choice = "top";
    else if (spaceRight > CARD_WIDTH + 40) choice = "right";
    else if (spaceLeft > CARD_WIDTH + 40) choice = "left";
    else choice = "bottom";
  }

  let top = rect.top + rect.height + CARD_GAP;
  let left = rect.left + rect.width / 2 - CARD_WIDTH / 2;

  if (choice === "top") {
    top = rect.top - CARD_GAP - 200; // estimativa; será clampada
    left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  } else if (choice === "right") {
    top = rect.top + rect.height / 2 - 100;
    left = rect.left + rect.width + CARD_GAP;
  } else if (choice === "left") {
    top = rect.top + rect.height / 2 - 100;
    left = rect.left - CARD_GAP - CARD_WIDTH;
  }

  // Clampa dentro do viewport
  const minLeft = scrollX + 12;
  const maxLeft = scrollX + vw - CARD_WIDTH - 12;
  left = Math.max(minLeft, Math.min(maxLeft, left));

  const minTop = scrollY + 12;
  const maxTop = scrollY + vh - 220;
  top = Math.max(minTop, Math.min(maxTop, top));

  return { top, left, centered: false };
}

function TourOverlay({
  tour,
  stepIndex,
  onPrev,
  onNext,
  onSkip,
}: {
  tour: TourConfig;
  stepIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = tour.steps[stepIndex];
  const { rect, missing } = useTargetRect(step);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ESC = pular
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip, onNext, onPrev]);

  if (!mounted || typeof document === "undefined") return null;

  const showSpotlight = !!rect && !missing;
  const centeredFallback = missing && !!step.centeredIfMissing;
  const { top: cardTop, left: cardLeft, centered } = computeCardPosition(
    showSpotlight ? rect : null,
    step.placement,
  );

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tour.steps.length - 1;

  const spotlight = showSpotlight
    ? {
        top: rect!.top - PADDING,
        left: rect!.left - PADDING,
        width: rect!.width + PADDING * 2,
        height: rect!.height + PADDING * 2,
      }
    : null;

  const overlay = (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none"
      aria-live="polite"
    >
      {/* Backdrop escuro. Um único elemento com box-shadow gigante gera
          o "recorte" ao redor do alvo, sem precisar de SVG. */}
      {spotlight ? (
        <div
          className="pointer-events-auto fixed transition-all duration-300 ease-out"
          style={{
            top: spotlight.top - window.scrollY,
            left: spotlight.left - window.scrollX,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
            outline: "2px solid rgba(255, 255, 255, 0.35)",
            outlineOffset: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="pointer-events-auto fixed inset-0 animate-fade-in"
          style={{ background: "rgba(15, 23, 42, 0.72)" }}
        />
      )}

      {/* Card */}
      {(showSpotlight || centeredFallback) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
          className="pointer-events-auto fixed w-[340px] max-w-[calc(100vw-24px)] rounded-xl border border-border bg-background p-5 shadow-2xl animate-scale-in"
          style={{
            top: centered ? "50%" : cardTop - window.scrollY,
            left: centered ? "50%" : cardLeft - window.scrollX,
            transform: centered ? "translate(-50%, -50%)" : undefined,
            transition:
              "top 200ms ease-out, left 200ms ease-out, transform 200ms ease-out",
          }}
        >
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                Passo {stepIndex + 1} de {tour.steps.length}
              </div>
              <h3 className="text-base font-bold leading-snug text-foreground">
                {step.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Pular tour"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {tour.steps.map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === stepIndex
                    ? "w-6 bg-primary"
                    : i < stepIndex
                      ? "w-1.5 bg-primary/60"
                      : "w-1.5 bg-muted-foreground/30")
                }
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Pular
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={isFirst}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={onNext}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                {isLast ? (
                  <>
                    Concluir
                    <Check className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
