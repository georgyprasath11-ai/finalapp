import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const COLOURS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#60a5fa",
];

interface Props {
  trigger: boolean;
  onComplete?: () => void;
}

export function ConfettiBurst({ trigger, onComplete }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    color: string;
    size: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    if (!trigger) {
      return;
    }

    if (shouldReduceMotion) {
      onComplete?.();
      return;
    }

    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 48,
      color: COLOURS[i % COLOURS.length],
      size: 5 + Math.random() * 5,
      delay: i * 0.04,
    }));
    setParticles(newParticles);
    const timer = window.setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [onComplete, shouldReduceMotion, trigger]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{ width: p.size, height: p.size, backgroundColor: p.color }}
            initial={{ y: 0, x: 0, opacity: 1, scale: 1 }}
            animate={{ y: -56, x: p.x, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
