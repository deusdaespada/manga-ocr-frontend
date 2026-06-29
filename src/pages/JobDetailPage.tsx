import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw, Square, Eye, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { api } from "../lib/api";
import type { JobInfo, WsMessage } from "../lib/types";
import { useJobWebSocket } from "../lib/ws";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import JobProgressCard from "../components/job/JobProgressCard";
import JobLogs from "../components/job/JobLogs";

function phaseForProgress(progress: number) {
  if (progress <= 8) return "Preparando...";
  if (progress <= 25) return "Gerando máscaras...";
  if (progress <= 65) return "OCR — reconhecendo texto...";
  if (progress <= 78) return "Traduzindo...";
  if (progress <= 92) return "Limpando imagens...";
  return "Finalizando...";
}

const statusVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  done: "success",
  running: "warning",
  failed: "danger",
  cancelled: "info",
};

const statusLabel: Record<string, string> = {
  done: "Concluído",
  running: "Executando",
  failed: "Erro",
  cancelled: "Cancelado",
  idle: "Aguardando",
};

export default function JobDetailPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Aguardando...");
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"running" | "done" | "failed" | "cancelled" | "idle">("idle");
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [meta, setMeta] = useState<string>("");

  useEffect(() => {
    if (!jobId) return;
    api
      .getJob(jobId)
      .then((data) => {
        setJob(data);
        setStatus(data.status === "running" ? "running" : data.status);
        if (data.cost_usd) setCostUsd(parseFloat(data.cost_usd));
        if (data.status === "done") {
          setProgress(100);
          setPhase("Concluído!");
        } else if (data.status === "cancelled") {
          setProgress(0);
          setPhase("Cancelado");
        } else if (data.status === "failed") {
          setProgress(0);
          setPhase("Erro!");
        }
      })
      .catch(() => setStatus("failed"));
  }, [jobId]);

  const handleMessage = useCallback((data: WsMessage) => {
    if (data.type === "log") {
      const clean = data.message.replace(/\[PROGRESS:\d+]\s*/g, "");
      if (clean.trim()) setLogs((prev) => [...prev, clean]);
      if (typeof data.progress === "number") {
        setProgress((prev) => Math.max(prev, data.progress));
        setPhase(phaseForProgress(data.progress));
      }
    }
    if (data.type === "done") {
      setProgress(100);
      setPhase("Concluído!");
      setStatus("done");
      if (data.cost_usd) setCostUsd(data.cost_usd);
      if (data.pages || data.regions || data.chapters) {
        const stats: string[] = [];
        if (data.pages) stats.push(`${data.pages} página${data.pages !== 1 ? "s" : ""}`);
        if (data.regions) stats.push(`${data.regions} região${data.regions !== 1 ? "s" : ""}`);
        if (data.chapters) stats.push(`${data.chapters} capítulo${data.chapters !== 1 ? "s" : ""}`);
        setMeta(stats.join(", "));
      }
    }
    if (data.type === "cancelled") {
      setStatus("cancelled");
      setPhase("Cancelado");
    }
    if (data.type === "error") {
      setStatus("failed");
      setPhase("Erro!");
      if (data.message) setLogs((prev) => [...prev, `ERRO: ${data.message}`]);
    }
  }, []);

  useJobWebSocket(status === "running" ? jobId : undefined, handleMessage);

  async function handleRetry() {
    if (!jobId) return;
    try {
      await api.retryJob(jobId);
      toast.success("Tarefa reiniciada");
      setProgress(0);
      setPhase("Aguardando...");
      setLogs([]);
      setStatus("running");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCancel() {
    if (!jobId) return;
    try {
      await api.cancelJob(jobId);
      toast.info("Tarefa cancelada");
      setStatus("cancelled");
      setPhase("Cancelado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const canRetry = status === "failed" || status === "cancelled";
  const canCancel = status === "running";

  return (
    <div className="animate-fade-in space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">
                Tarefa{" "}
                <span className="mono text-sm text-muted-foreground">{jobId}</span>
              </h1>
              <Badge variant={statusVariant[status] || "info"}>
                {statusLabel[status] ?? status}
              </Badge>
            </div>
            {job && (
              <p className="text-sm text-muted-foreground">
                {job.manga}
                {job.chapter ? ` / Cap. ${job.chapter}` : ""}
                {job.language ? ` · ${job.language.toUpperCase()}` : ""}
                {job.backend ? ` · ${job.backend}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {costUsd !== null && (
            <div className="flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-xs">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="mono">${costUsd.toFixed(4)}</span>
            </div>
          )}
          {job?.chapter && status === "done" && (
            <Link to={`/results/${job.manga}/${job.chapter}`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Ver resultado
              </Button>
            </Link>
          )}
          {canRetry && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRetry}>
              <RotateCcw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleCancel}>
              <Square className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Progresso */}
      <JobProgressCard progress={progress} phase={phase} meta={meta} />

      {/* Logs */}
      <JobLogs logs={logs} />
    </div>
  );
}
