import { TrendingUp } from "lucide-react";

import { Card, CardTitle, CardValue } from "@/components/ui/card";

export function MetricCard({
  title,
  value,
  delta,
}: {
  title: string;
  value: string;
  delta?: string;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardValue>{value}</CardValue>
      {delta ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
          <TrendingUp className="h-3.5 w-3.5" />
          {delta}
        </p>
      ) : null}
    </Card>
  );
}

