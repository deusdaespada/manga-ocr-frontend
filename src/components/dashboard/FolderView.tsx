import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  FolderPlus,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
  ArrowRight,
  BookOpen,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import type { Folder, Project } from "../../lib/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

// --- helpers ---

function statusForProject(project: Project) {
  const statuses = project.chapters.map((ch) => ch.status);
  const doneCount = statuses.filter((s) => s === "done").length;
  const hasDone = statuses.includes("done");
  const hasProcessing =
    statuses.includes("processing") || statuses.includes("translating");
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

function genreLabel(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Draggable manga card ---

function DraggableMangaCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.slug,
  });

  const { doneCount, mainStatus } = statusForProject(project);
  const progress =
    project.chapter_count > 0
      ? Math.round((doneCount / project.chapter_count) * 100)
      : 0;

  return (
    <div
      ref={setNodeRef}
      className={`group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all ${
        isDragging ? "opacity-30" : "hover:border-primary/30 hover:bg-muted/30"
      }`}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className="flex flex-1 cursor-pointer items-center gap-4"
        onClick={() => navigate(`/project/${project.slug}`)}
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{project.display_name}</div>
          {project.metadata?.tags && project.metadata.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {project.metadata.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                >
                  {genreLabel(tag)}
                </span>
              ))}
              {project.metadata.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{project.metadata.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          {doneCount}/{project.chapter_count}
        </span>

        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-8">
            {progress}%
          </span>
        </div>

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
          <span className="text-xs text-muted-foreground/50 w-8">—</span>
        )}

        <Badge variant={statusVariant[mainStatus] || "info"}>{mainStatus}</Badge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// --- Drag overlay (ghost card) ---

function DragOverlayCard({ project }: { project: Project }) {
  const { doneCount, mainStatus } = statusForProject(project);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-card px-4 py-3 shadow-lg scale-[1.02]">
      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      <div className="flex flex-1 items-center gap-4">
        <div className="font-medium text-sm">{project.display_name}</div>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{project.chapter_count}
        </span>
        <Badge variant={statusVariant[mainStatus] || "info"}>{mainStatus}</Badge>
      </div>
    </div>
  );
}

// --- Droppable folder section ---

function FolderSection({
  folderId,
  folderName,
  projects,
  onDelete,
}: {
  folderId: string;
  folderName: string;
  projects: Project[];
  onDelete?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: folderId });

  const isUncategorized = folderId === "__uncategorized__";

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <FolderOpen className="h-4 w-4 text-primary/70" />
        <span className="text-sm font-medium flex-1">{folderName}</span>
        <span className="text-xs text-muted-foreground">{projects.length} ta</span>
        {!isUncategorized && onDelete && (
          <span
            className="ml-2 rounded p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          collapsed ? "max-h-0 opacity-0" : "max-h-[5000px] opacity-100"
        }`}
      >
        {projects.length > 0 ? (
          <div className="space-y-1 px-3 pb-3">
            {projects.map((project) => (
              <DraggableMangaCard key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <div className="px-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground/50 py-4">
              Mangalarni shu yerga tashlang
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main FolderView ---

interface FolderViewProps {
  projects: Project[];
  error: string | null;
  onProjectsChange: (projects: Project[]) => void;
}

export default function FolderView({
  projects,
  error,
  onProjectsChange,
}: FolderViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Folderlarni API dan yuklash
  useEffect(() => {
    api.getFolders().then(setFolders).catch(() => {});
  }, []);

  // Group projects by folder
  const grouped = useMemo(() => {
    const map: Record<string, Project[]> = { __uncategorized__: [] };
    for (const f of folders) {
      map[f.name] = [];
    }
    for (const p of projects) {
      const key = p.folder || "__uncategorized__";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [projects, folders]);

  const activeProject = activeId
    ? projects.find((p) => p.slug === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const slug = active.id as string;
    const targetFolder = over.id as string;
    const newFolder = targetFolder === "__uncategorized__" ? "" : targetFolder;

    const project = projects.find((p) => p.slug === slug);
    if (!project) return;

    const currentFolder = project.folder || "";
    if (currentFolder === newFolder) return;

    // Optimistic update
    const updated = projects.map((p) =>
      p.slug === slug ? { ...p, folder: newFolder } : p
    );
    onProjectsChange(updated);

    try {
      await api.updateProjectFolder(slug, newFolder);
    } catch (e) {
      toast.error((e as Error).message);
      onProjectsChange(projects);
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.some((f) => f.name === name)) {
      toast.error("Bu nomli folder allaqachon mavjud");
      return;
    }

    try {
      const created = await api.createFolder(name);
      setFolders((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setDialogOpen(false);
      setNewFolderName("");
      toast.success(`"${name}" folder yaratildi`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDeleteFolder(folderName: string) {
    if (!confirm(`"${folderName}" folderni o'chirmoqchimisiz? Ichidagi mangalar "Barchasi"ga ko'chadi.`)) {
      return;
    }

    // Optimistic update
    const prevFolders = folders;
    const prevProjects = projects;
    setFolders((prev) => prev.filter((f) => f.name !== folderName));
    onProjectsChange(
      projects.map((p) => (p.folder === folderName ? { ...p, folder: "" } : p))
    );

    try {
      await api.deleteFolder(folderName);
    } catch (e) {
      toast.error((e as Error).message);
      setFolders(prevFolders);
      onProjectsChange(prevProjects);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Xatolik: {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-14 text-center">
        <BookOpen className="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Hali manga yo'q</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          "Yangi yuklash" tugmasini bosib boshlang
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Mangalar</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {projects.length} ta loyiha
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Folder
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-3">
          {/* Named folders */}
          {folders.map((folder) => (
            <FolderSection
              key={folder.name}
              folderId={folder.name}
              folderName={folder.name}
              projects={grouped[folder.name] || []}
              onDelete={() => handleDeleteFolder(folder.name)}
            />
          ))}

          {/* Uncategorized */}
          <FolderSection
            folderId="__uncategorized__"
            folderName="Barchasi"
            projects={grouped.__uncategorized__ || []}
          />
        </div>

        <DragOverlay>
          {activeProject ? <DragOverlayCard project={activeProject} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Create folder dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi folder</DialogTitle>
            <DialogDescription>
              Mangalarni guruhlash uchun folder yarating.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateFolder();
            }}
          >
            <Input
              autoFocus
              placeholder="Folder nomi"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Bekor
              </Button>
              <Button type="submit" size="sm" disabled={!newFolderName.trim()}>
                Yaratish
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
