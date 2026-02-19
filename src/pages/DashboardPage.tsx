import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Layers,
  CheckCircle2,
  Loader2,
  DollarSign,
  Plus,
  ArrowRight,
} from "lucide-react";

import { api } from "../lib/api";
import type { Project, Stats } from "../lib/types";

function genreLabel(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

function statusForProject(project: Project) {
  const statuses = project.chapters.map((ch) => ch.status);
  const doneCount = statuses.filter((s) => s === "done").length;
  const hasDone = statuses.includes("done");
  const hasProcessing = statuses.includes("processing") || statuses.includes("translating");
  const mainStatus = hasProcessing ? "processing" : hasDone ? "done" : "uploaded";
  return { doneCount, mainStatus };
}

const statusVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  done: "success",
  processing: "warning",
  translating: "warning",
  uploaded: "info",
  failed: "danger",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getStats(), api.getProjects()])
      .then(([statsData, projectsData]) => {
        if (!active) return;
        setStats(statsData);
        setProjects(projectsData);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Xatolik");
      });
    return () => {
      active = false;
    };
  }, []);

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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Pipeline holati va loyihalar statistikasi.</p>
        </div>
        <Link to="/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Yangi manga
          </Button>
        </Link>
      </div>

      {/* Stats */}
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

      {/* Projects table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mangalar</h2>
          <span className="text-xs text-muted-foreground">{projects.length} ta loyiha</span>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            Xatolik: {error}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-14 text-center">
            <BookOpen className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Hali manga yo'q</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              "Yangi yuklash" tugmasini bosib boshlang
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nomi</TableHead>
                  <TableHead className="w-[100px]">Chapterlar</TableHead>
                  <TableHead className="w-[120px]">Progress</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const { doneCount, mainStatus } = statusForProject(project);
                  const progress = project.chapter_count > 0
                    ? Math.round((doneCount / project.chapter_count) * 100)
                    : 0;
                  return (
                    <TableRow
                      key={project.name}
                      className="cursor-pointer"
                      onClick={() => navigate(`/project/${project.name}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{project.name}</div>
                        {project.metadata?.tags && project.metadata.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {project.metadata.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                {genreLabel(tag)}
                              </span>
                            ))}
                            {project.metadata.tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{project.metadata.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doneCount}/{project.chapter_count}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[mainStatus] || "info"}>
                          {mainStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
