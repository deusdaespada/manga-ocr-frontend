import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";

import type { Project } from "../../lib/types";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

function genreLabel(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

interface ProjectsTableProps {
  projects: Project[];
  error: string | null;
}

export default function ProjectsTable({ projects, error }: ProjectsTableProps) {
  const navigate = useNavigate();

  return (
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
                <TableHead className="w-[80px]">Auto</TableHead>
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
                    key={project.slug}
                    className="cursor-pointer"
                    onClick={() => navigate(`/project/${project.slug}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{project.display_name}</div>
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
                      {project.automation_avg != null && project.automation_avg > 0 ? (
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            project.automation_avg >= 80
                              ? "text-emerald-400"
                              : project.automation_avg >= 40
                                ? "text-amber-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {project.automation_avg.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
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
  );
}
