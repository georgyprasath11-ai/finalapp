import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { clampPercent, goalPercent } from "@/lib/goals";
import { progressColor } from "@/lib/progress-color";
import { cn } from "@/lib/utils";
import { percentLabel } from "@/utils/format";

interface GoalProgressBarProps {
  label: string;
  completedHours: number;
  goalHours: number;
  className?: string;
  /** Stagger delay in seconds - lets parent space out multiple bars */
  delay?: number;
}

const formatHours = (hours: number): string => {
  const rounded = Number(hours.toFixed(2));
  const trimmed = Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toString().replace(/0+$/, "").replace(/\.$/, "");
  return `${trimmed}h`;
};

export function GoalProgressBar({
  label,
  completedHours,
  goalHours,
  className,
  delay = 0,
}: GoalProgressBarProps) {
  const reduceMotion = useReducedMotion();
  const percent = goalPercent(completedHours, goalHours);
  const cappedPercent = clampPercent(percent);
  const target = cappedPercent / 100;

  // When reduceMotion is true, snap immediately using a plain motion value.
  // When false, use a spring that eases in from 0.
  // Bug fix: useSpring with stiffness:0 never settles - we avoid that entirely.
  const snap = useMotionValue(reduceMotion ? target : 0);
  const spring = useSpring(0, { stiffness: 55, damping: 13, restDelta: 0.001 });

  const scaleX = reduceMotion ? snap : spring;

  useEffect(() => {
    if (reduceMotion) {
      snap.set(target);
    } else {
      // Delay lets parent stagger multiple bars for a cascade effect
      const timeout = delay > 0
        ? window.setTimeout(() => spring.set(target), delay * 1000)
        : (spring.set(target), undefined);
      return () => {
        if (timeout !== undefined) window.clearTimeout(timeout);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion, delay]);

  const dynamicColor = progressColor(percent); // uses raw percent, not capped

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatHours(completedHours)} / {formatHours(goalHours)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {/* Track */}
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-secondary/70">
          {/* Fill - Bug fix: absolute inset-0 gives it 100% width to scale from */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              scaleX,
              transformOrigin: "left",
              backgroundColor: dynamicColor,
              transition: "background-color 0.3s ease",
            }}
            // Bug fix: no `initial` prop - conflicts with the style scaleX
          />
          {/* Shimmer overlay that runs while bar is filling */}
          {!reduceMotion && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / 0.18) 50%, transparent 100%)",
                scaleX,
                transformOrigin: "left",
              }}
              animate={{ backgroundPosition: ["200% center", "-200% center"] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "linear",
                delay,
              }}
            />
          )}
        </div>
        <motion.span
          className="min-w-14 text-right text-xs font-semibold text-primary"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : delay + 0.3, duration: 0.3 }}
        >
          {percentLabel(percent)}
        </motion.span>
      </div>
    </div>
  );
}
