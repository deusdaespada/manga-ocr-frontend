import type { ReactNode } from "react";
import { Progress } from "../ui/progress";

interface JobProgressCardProps {
  status: string;
  progress: number;
  phase: string;
  meta: string;
  statusBadge: ReactNode;
}

export default function JobProgressCard({
  status,
  progress,
  phase,
  meta,
  statusBadge,
}: JobProgressCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        {statusBadge}
        {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
      </div>
      <div className="mt-4">
        <Progress value={progress} className={status === "failed" ? "bg-red-100" : undefined} />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>{phase}</span>
        <span className="mono text-xs">{progress}%</span>
      </div>
    </div>
  );
}
