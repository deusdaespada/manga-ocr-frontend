import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";

import { api } from "../lib/api";
import type { JobInfo } from "../lib/types";
import { formatTime } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

const statusVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  done: "success",
  running: "warning",
  failed: "danger",
  cancelled: "info",
};

export default function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getJobs()
      .then((data) => setJobs(data.reverse()))
      .catch((err) => setError(err.message || "Xatolik"));
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Job tarixi</h1>
        <p className="page-description">Pipeline ishga tushgan barcha jarayonlar.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Xatolik: {error}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Hali job yo'q</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Pipeline ishga tushirganingizda bu yerda ko'rinadi.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Manga / Chapter</TableHead>
                <TableHead>Sozlamalar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Xarajat</TableHead>
                <TableHead className="w-[140px]">Vaqt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/job/${job.id}`)}
                >
                  <TableCell className="mono text-xs text-muted-foreground">{job.id}</TableCell>
                  <TableCell className="font-medium">
                    {job.manga}
                    <span className="text-muted-foreground"> / {job.chapter || "—"}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.language?.toUpperCase()} · {job.backend}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[job.status] || "info"}>{job.status}</Badge>
                  </TableCell>
                  <TableCell className="mono text-xs">
                    {job.cost_usd ? `$${parseFloat(job.cost_usd).toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTime(job.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
