import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Languages,
  Trash2,
  Play,
  Eye,
  Pencil,
  Loader2,
  Save,
  Settings2,
} from "lucide-react";

import { api } from "../lib/api";
import type { Chapter, Project, ProjectSettings } from "../lib/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const statusVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  done: "success",
  ocr_done: "info",
  translating: "warning",
  processing: "warning",
  uploaded: "info",
  failed: "danger",
};

const statusLabel: Record<string, string> = {
  done: "Tayyor",
  ocr_done: "OCR tayyor",
  translating: "Tarjima...",
  processing: "Jarayonda",
  uploaded: "Yuklangan",
  failed: "Xatolik",
};

export default function ProjectPage() {
  const { manga } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<ProjectSettings>({
    language: "ja",
    backend: "openai",
    ocr_backend: "auto",
    limit: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!manga) return;
    api
      .getProject(manga)
      .then((data) => {
        setProject(data);
        if (data.settings) {
          setSettings({
            language: data.settings.language,
            backend: data.settings.backend,
            ocr_backend: data.settings.ocr_backend,
            limit: data.settings.limit || 0,
          });
        }
      })
      .catch(() => setProject(null));
  }, [manga]);

  const chapters = project?.chapters || [];
  const hasOcrDone = chapters.some((ch) => ch.status === "ocr_done");
  const hasTranslating = chapters.some((ch) => ch.status === "translating");

  async function handleSave() {
    if (!manga) return;
    setSaving(true);
    try {
      await api.saveProjectSettings(manga, settings);
    } finally {
      setTimeout(() => setSaving(false), 600);
    }
  }

  async function handleDeleteProject() {
    if (!manga) return;
    if (!confirm(`"${manga}" ni o'chirmoqchimisiz? Barcha fayllar o'chadi!`)) return;
    await api.deleteProject(manga);
    navigate("/");
  }

  async function handleStartJob(chapter: Chapter) {
    if (!manga) return;
    const result = await api.startJob({
      manga,
      chapter: chapter.name,
      language: settings.language,
      backend: settings.backend,
      ocr_backend: settings.ocr_backend,
      limit: settings.limit,
    });
    navigate(`/job/${result.job_id}`);
  }

  async function handleTranslateManga() {
    if (!manga) return;
    if (!confirm(`Butun "${manga}" mangasini tarjima qilmoqchimisiz?`)) return;
    const result = await api.translateManga({
      manga,
      language: settings.language,
      backend: settings.backend,
    });
    navigate(`/job/${result.job_id}`);
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <h1 className="page-title">{manga}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/upload/${manga}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Bob qo'shish
            </Button>
          </Link>
          {hasTranslating ? (
            <Button variant="secondary" size="sm" disabled className="gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Tarjima jarayonda
            </Button>
          ) : hasOcrDone ? (
            <Button size="sm" onClick={handleTranslateManga} className="gap-1.5">
              <Languages className="h-3.5 w-3.5" />
              Tarjima qilish
            </Button>
          ) : null}
          <Button variant="destructive" size="sm" onClick={handleDeleteProject} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            O'chirish
          </Button>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-3">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Sozlamalar</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Manba tili</label>
            <Select
              value={settings.language}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, language: value as ProjectSettings["language"] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Til" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">Yaponcha (JA)</SelectItem>
                <SelectItem value="ko">Koreyscha (KO)</SelectItem>
                <SelectItem value="ru">Ruscha (RU)</SelectItem>
                <SelectItem value="en">Inglizcha (EN)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tarjima backend</label>
            <Select
              value={settings.backend}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, backend: value as ProjectSettings["backend"] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Backend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">OCR backend</label>
            <Select
              value={settings.ocr_backend}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  ocr_backend: value as ProjectSettings["ocr_backend"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="OCR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Local (Auto)</SelectItem>
                <SelectItem value="openai">OpenAI Vision</SelectItem>
                <SelectItem value="ollama">Ollama Vision</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Rasm limiti</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={settings.limit}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    limit: Number.parseInt(e.target.value || "0", 10),
                  }))
                }
              />
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="shrink-0 gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saving ? "..." : "Saqlash"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-sm font-medium">Chapterlar</span>
          <span className="text-xs text-muted-foreground">{chapters.length} ta</span>
        </div>

        {chapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-sm text-muted-foreground">Chapter topilmadi</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Yuklash sahifasidan rasm qo'shing.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {chapters.map((chapter) => {
              const isClickable = chapter.status === "done" || chapter.status === "ocr_done";
              return (
                <div
                  key={chapter.name}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    isClickable ? "cursor-pointer transition-colors hover:bg-muted/50" : ""
                  }`}
                  onClick={() => {
                    if (!project?.name || !isClickable) return;
                    navigate(`/results/${project.name}/${chapter.name}`);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-medium">{chapter.name}</div>
                      <div className="text-xs text-muted-foreground">{chapter.image_count} rasm</div>
                    </div>
                    <Badge variant={statusVariant[chapter.status] || "info"}>
                      {statusLabel[chapter.status] || chapter.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(chapter.status === "done" || chapter.status === "ocr_done") && (
                      <>
                        <Link
                          to={`/results/${project?.name}/${chapter.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                            <Eye className="h-3.5 w-3.5" />
                            Ko'rish
                          </Button>
                        </Link>
                        <Link
                          to={`/edit/${project?.name}/${chapter.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                            <Pencil className="h-3.5 w-3.5" />
                            Tahrir
                          </Button>
                        </Link>
                      </>
                    )}
                    {(chapter.status === "processing" || chapter.status === "translating") &&
                      chapter.job_id && (
                        <Link
                          to={`/job/${chapter.job_id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Progress
                          </Button>
                        </Link>
                      )}
                    {(chapter.status === "uploaded" || chapter.status === "failed") && (
                      <Button
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartJob(chapter);
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        OCR
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!manga) return;
                        if (!confirm(`"${chapter.name}" bobni o'chirmoqchimisiz?`)) return;
                        await api.deleteChapter(manga, chapter.name);
                        const updated = await api.getProject(manga);
                        setProject(updated);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
