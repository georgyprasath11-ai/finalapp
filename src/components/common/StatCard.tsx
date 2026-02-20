import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
  accentClassName?: string;
}

export function StatCard({ title, value, hint, accentClassName }: StatCardProps) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tracking-tight", accentClassName)}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
