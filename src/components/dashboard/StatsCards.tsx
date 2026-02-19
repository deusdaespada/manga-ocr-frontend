import {
  BookOpen,
  Layers,
  CheckCircle2,
  Loader2,
  DollarSign,
} from "lucide-react";

import type { Stats } from "../../lib/types";

interface StatsCardsProps {
  stats: Stats | null;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const statCards = stats
    ? [
        { label: "Jami manga", value: stats.total_projects, icon: BookOpen, color: "text-indigo-400 bg-indigo-500/10" },
        { label: "Jami chapter", value: stats.total_chapters, icon: Layers, color: "text-blue-400 bg-blue-500/10" },
        { label: "Tayyor", value: stats.done_chapters, icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10" },
        { label: "Jarayonda", value: stats.processing_chapters, icon: Loader2, color: "text-amber-400 bg-amber-500/10" },
        {
          label: "API xarajat",
          value: stats.total_cost_usd > 0 ? `$${stats.total_cost_usd.toFixed(4)}` : "$0",
          icon: DollarSign,
          color: "text-violet-400 bg-violet-500/10",
          mono: true,
        },
      ]
    : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {statCards ? (
        statCards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-lg border bg-card p-3.5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${item.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">{item.label}</div>
                <div className={`text-lg font-semibold ${item.mono ? "mono" : ""}`}>{item.value}</div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="col-span-full rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Statistikalar yuklanmoqda...
        </div>
      )}
    </div>
  );
}
