import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../lib/api";
import type { GenreOption, Project, ProjectMetadata, ProjectSettings } from "../lib/types";
import ProjectHeader from "../components/project/ProjectHeader";
import ChapterList from "../components/project/ChapterList";
import MetadataSidebar from "../components/project/MetadataSidebar";
import EditMetadataModal from "../components/project/EditMetadataModal";
import SettingsModal from "../components/project/SettingsModal";

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

  async function handleDeleteProject() {
    if (!manga) return;
    if (!confirm(`"${manga}" ni o'chirmoqchimisiz? Barcha fayllar o'chadi!`)) return;
    await api.deleteProject(manga);
    navigate("/");
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
      <ProjectHeader
        manga={manga!}
        hasOcrDone={hasOcrDone}
        hasTranslating={hasTranslating}
        onTranslate={handleTranslateManga}
        onDelete={handleDeleteProject}
      />

      <div className="flex flex-col-reverse gap-6 xl:flex-row xl:items-start">
        <ChapterList
          chapters={chapters}
          projectName={manga!}
          settings={settings}
          onProjectUpdate={setProject}
        />

        {project && (
          <MetadataSidebar
            project={project}
            allGenres={allGenres}
            onEditMeta={() => {
              if (project.metadata) setMetaDraft({ ...project.metadata });
              setEditingMeta(true);
            }}
            onEditSettings={() => setEditingSettings(true)}
          />
        )}
      </div>

      <EditMetadataModal
        open={editingMeta}
        metaDraft={metaDraft}
        setMetaDraft={setMetaDraft}
        saving={savingMeta}
        onSave={handleSaveMeta}
        onClose={() => setEditingMeta(false)}
      />

      <SettingsModal
        open={editingSettings}
        settings={settings}
        setSettings={setSettings}
        saving={saving}
        onSave={handleSave}
        onClose={() => setEditingSettings(false)}
      />
    </div>
  );
}
