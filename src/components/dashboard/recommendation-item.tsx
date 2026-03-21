import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function RecommendationItem({
  title,
  reason,
  impact,
  priority,
  confidence,
}: {
  title: string;
  reason: string;
  impact: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
}) {
  const variant =
    priority === "CRITICAL" ? "danger" : priority === "HIGH" ? "warn" : priority === "MEDIUM" ? "neutral" : "good";

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
        <Badge variant={variant}>{priority}</Badge>
      </div>
      <p className="text-sm text-zinc-300">{reason}</p>
      <p className="text-xs text-zinc-400">Impacto esperado: {impact}</p>
      <p className="text-xs text-cyan-300">Confiança: {Math.round(confidence * 100)}%</p>
    </Card>
  );
}

