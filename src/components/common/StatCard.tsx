import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accentClassName?: string;
}

export function StatCard({ title, value, hint, icon, accentClassName }: StatCardProps) {
  return (
    <Card className="dashboard-surface h-full rounded-[20px] border-border/60 bg-card/90">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</CardTitle>
        {icon ? <span className="rounded-xl border border-border/60 bg-background/60 p-2 text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent className="space-y-1 pb-5 pt-0">
        <p className={cn("font-display text-[1.8rem] leading-none tracking-tight tabular-nums", accentClassName)}>{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

