import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, value ?? 0));

  const spring = useSpring(clamped, { stiffness: 80, damping: 16, restDelta: 0.1 });
  const scaleX = useTransform(spring, [0, 100], [0, 1]);

  React.useEffect(() => {
    spring.set(clamped);
  }, [clamped, spring]);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-primary"
        style={{
          scaleX: reduceMotion ? clamped / 100 : scaleX,
          transformOrigin: "left",
        }}
      />
    </ProgressPrimitive.Root>
  );
});

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
