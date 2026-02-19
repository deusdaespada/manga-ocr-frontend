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
  FileText,
  X,
  Check,
} from "lucide-react";

import { api } from "../lib/api";
import type { Chapter, GenreOption, Project, ProjectMetadata, ProjectSettings } from "../lib/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import GenrePicker from "../components/GenrePicker";

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
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<ProjectMetadata>({
    description: "",
    title_uz: "",
    title_ru: "",
    title_en: "",
    title_ja: "",
    title_ko: "",
    tags: [],
  });
  const [allGenres, setAllGenres] = useState<GenreOption[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);

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
        if (data.metadata) {
          setMetaDraft({ ...data.metadata });
        }
      })
      .catch(() => setProject(null));
    api.getGenres().then(setAllGenres).catch(() => {});
  }, [manga]);

  const chapters = project?.chapters || [];
  const hasOcrDone = chapters.some((ch) => ch.status === "ocr_done");
  const hasTranslating = chapters.some((ch) => ch.status === "translating");

  async function handleSave() {
    if (!manga) return;
    setSaving(true);
    try {
      await api.saveProjectSettings(manga, settings);
      setEditingSettings(false);
    } finally {
      setTimeout(() => setSaving(false), 600);
    }
  }

  async function handleSaveMeta() {
    if (!manga) return;
    setSavingMeta(true);
    try {
      await api.updateProjectMetadata(manga, {
        description: metaDraft.description,
        title_uz: metaDraft.title_uz,
        title_ru: metaDraft.title_ru,
        title_en: metaDraft.title_en,
        title_ja: metaDraft.title_ja,
        title_ko: metaDraft.title_ko,
        tags: metaDraft.tags,
      });
      setEditingMeta(false);
      const updated = await api.getProject(manga);
      setProject(updated);
      if (updated.metadata) setMetaDraft({ ...updated.metadata });
    } finally {
      setSavingMeta(false);
    }
  }

  function genreLabel(val: string) {
    return allGenres.find((g) => g.value === val)?.label ?? val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

      {/* Content: Chapters (left) + Metadata (right) on xl */}
      <div className="flex flex-col-reverse gap-6 xl:flex-row xl:items-start">

      {/* Chapters */}
      <div className="min-w-0 xl:flex-1">
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

      {/* Metadata sidebar */}
      <div className="w-full shrink-0 xl:w-[420px]">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Ma'lumotlar</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                if (project?.metadata) setMetaDraft({ ...project.metadata });
                setEditingMeta(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setEditingSettings(true)}
            >
              <Settings2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {project?.metadata?.description ? (
              <p className="text-sm text-muted-foreground">{project.metadata.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">Tavsif yo'q</p>
            )}
            {project?.metadata && (
              <div className="space-y-1">
                {project.metadata.title_uz && (
                  <div className="text-xs"><span className="text-muted-foreground">UZ:</span> {project.metadata.title_uz}</div>
                )}
                {project.metadata.title_ru && (
                  <div className="text-xs"><span className="text-muted-foreground">RU:</span> {project.metadata.title_ru}</div>
                )}
                {project.metadata.title_en && (
                  <div className="text-xs"><span className="text-muted-foreground">EN:</span> {project.metadata.title_en}</div>
                )}
                {project.metadata.title_ja && (
                  <div className="text-xs"><span className="text-muted-foreground">JA:</span> {project.metadata.title_ja}</div>
                )}
                {project.metadata.title_ko && (
                  <div className="text-xs"><span className="text-muted-foreground">KO:</span> {project.metadata.title_ko}</div>
                )}
              </div>
            )}
            {project?.metadata?.tags && project.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {project.metadata.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {genreLabel(tag)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      </div>{/* end flex row */}

      {/* Edit metadata modal */}
      {editingMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingMeta(false)}>
          <div
            className="mx-4 w-full max-w-lg rounded-lg border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-sm font-medium">Ma'lumotlarni tahrirlash</span>
              <button onClick={() => setEditingMeta(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tavsif</label>
                  <Textarea
                    value={metaDraft.description}
                    onChange={(e) => setMetaDraft((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Manga haqida..."
                    className="min-h-[120px] text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">O'zbekcha</label>
                    <Input
                      value={metaDraft.title_uz}
                      onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_uz: e.target.value }))}
                      placeholder="O'zbek tilidagi nomi"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ruscha</label>
                    <Input
                      value={metaDraft.title_ru}
                      onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_ru: e.target.value }))}
                      placeholder="Русское название"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Inglizcha</label>
                    <Input
                      value={metaDraft.title_en}
                      onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_en: e.target.value }))}
                      placeholder="English title"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Yaponcha</label>
                    <Input
                      value={metaDraft.title_ja}
                      onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_ja: e.target.value }))}
                      placeholder="日本語タイトル"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Koreyscha</label>
                    <Input
                      value={metaDraft.title_ko}
                      onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_ko: e.target.value }))}
                      placeholder="한국어 제목"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Janrlar</label>
                  <GenrePicker
                    value={metaDraft.tags}
                    onChange={(genres) => setMetaDraft((prev) => ({ ...prev, tags: genres }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setEditingMeta(false)}>
                Bekor
              </Button>
              <Button size="sm" className="gap-1" disabled={savingMeta} onClick={handleSaveMeta}>
                {savingMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Saqlash
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {editingSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingSettings(false)}>
          <div
            className="mx-4 w-full max-w-md rounded-lg border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pipeline sozlamalari</span>
              </div>
              <button onClick={() => setEditingSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setEditingSettings(false)}>
                Bekor
              </Button>
              <Button size="sm" className="gap-1" disabled={saving} onClick={handleSave}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Saqlash
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
