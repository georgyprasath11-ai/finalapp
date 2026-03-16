import { ReactNode, useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  numericValue?: number;
  formatValue?: (value: number) => string;
  hint?: string;
  icon?: ReactNode;
  accentClassName?: string;
}

export function StatCard({ title, value, numericValue, formatValue, hint, icon, accentClassName }: StatCardProps) {
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const motionValue = useMotionValue(0);
  const formattedValue = useTransform(motionValue, (latest) =>
    formatValue ? formatValue(latest) : `${Math.round(latest)}`,
  );

  useEffect(() => {
    if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
      setDisplayValue(value);
      return;
    }

    const unsubscribe = formattedValue.on("change", (latest) => setDisplayValue(latest));
    const controls = animate(motionValue, numericValue, {
      duration: reduceMotion ? 0 : 0.6,
      ease: "easeOut",
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [formattedValue, formatValue, motionValue, numericValue, reduceMotion, value]);

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
    >
      <Card className="dashboard-surface h-full rounded-[20px] border-border/60 bg-card/90">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</CardTitle>
          {icon ? <span className="rounded-xl border border-border/60 bg-background/60 p-2 text-muted-foreground">{icon}</span> : null}
        </CardHeader>
        <CardContent className="space-y-1 pb-5 pt-0">
          <p className={cn("font-display text-[1.8rem] leading-none tracking-tight tabular-nums", accentClassName)}>{displayValue}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

