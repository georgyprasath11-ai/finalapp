import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BIBLE_VERSES } from "@/lib/bible-verses";
import { cn } from "@/lib/utils";

const AUTO_ROTATE_MS = 8000;
const SWIPE_THRESHOLD = 42;
const TRANSITION_MS = 380;

export function VerseCarousel() {
  const verses = useMemo(() => BIBLE_VERSES, []);
  const [index, setIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const lastIndex = Math.max(0, verses.length - 1);

  const moveTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex > lastIndex || nextIndex === index || isTransitioning) {
        return;
      }

      setIsTransitioning(true);
      setIndex(nextIndex);
      if (prefersReducedMotion) {
        setIsTransitioning(false);
        return;
      }

      const timeout = window.setTimeout(() => setIsTransitioning(false), TRANSITION_MS + 30);
      return () => window.clearTimeout(timeout);
    },
    [index, isTransitioning, lastIndex, prefersReducedMotion],
  );

  const goPrevious = useCallback(() => {
    moveTo(index - 1);
  }, [index, moveTo]);

  const goNext = useCallback(() => {
    moveTo(index + 1);
  }, [index, moveTo]);

  useEffect(() => {
    if (verses.length <= 1 || isHovering || isTransitioning) {
      return;
    }

    const interval = window.setInterval(() => {
      setIndex((previous) => (previous >= lastIndex ? 0 : previous + 1));
    }, AUTO_ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [isHovering, isTransitioning, lastIndex, verses.length]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch || touchStartX.current === null || touchStartY.current === null) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
      return;
    }

    if (deltaX < 0) {
      goNext();
      return;
    }

    goPrevious();
  };

  if (verses.length === 0) {
    return null;
  }

  return (
    <section className="relative">
      <div
        className="relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {index > 0 ? (
          <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2 sm:left-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Previous verse"
              className="h-11 w-11 rounded-full border border-border/60 bg-background/75 text-foreground shadow-soft backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={goPrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        ) : null}

        <div
          role="region"
          aria-label="Motivational Bible verses"
          tabIndex={0}
          className="relative overflow-hidden rounded-[22px]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              goPrevious();
              return;
            }

            if (event.key === "ArrowRight") {
              event.preventDefault();
              goNext();
            }
          }}
        >
          <div
            className={cn("flex will-change-transform")}
            style={{
              transform: `translate3d(-${index * 100}%, 0, 0)`,
              transition: prefersReducedMotion ? undefined : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {verses.map((verse) => (
              <div key={verse.id} className="w-full shrink-0 px-0.5">
                <Card className="dashboard-surface relative overflow-hidden rounded-[22px] border-border/60 bg-card/90 px-8 py-7 text-center sm:px-12 sm:py-10">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_62%)]" />
                  <div className="relative mx-auto max-w-4xl space-y-4">
                    <p className="font-display text-lg leading-relaxed text-foreground sm:text-2xl">{verse.text}</p>
                    <p className="text-sm font-semibold tracking-[0.08em] text-primary sm:text-base">{verse.reference}</p>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {index < lastIndex ? (
          <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2 sm:right-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Next verse"
              className="h-11 w-11 rounded-full border border-border/60 bg-background/75 text-foreground shadow-soft backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={goNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
