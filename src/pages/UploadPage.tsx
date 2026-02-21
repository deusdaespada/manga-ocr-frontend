import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CloudUpload, X, Image as ImageIcon } from "lucide-react";

import { api } from "../lib/api";
import type { Project } from "../lib/types";
import { Button } from "../components/ui/button";

export default function UploadPage() {
  const { manga } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>("");
  const [mangaSlug, setMangaSlug] = useState(manga || "");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api
      .getProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (manga) setMangaSlug(manga);
  }, [manga]);

  const existing = projects.find((p) => p.slug === mangaSlug);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const images: File[] = [];
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) images.push(f);
    }
    setSelectedFiles((prev) => [...prev, ...images]);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!mangaSlug.trim()) {
      setStatus("Manga tanlang");
      return;
    }
    if (selectedFiles.length === 0) {
      setStatus("Rasm fayllarini tanlang");
      return;
    }
    setStatus("Yuklanmoqda...");
    try {
      const result = await api.uploadFiles(mangaSlug.trim(), selectedFiles);
      setStatus(`${result.saved} rasm yuklandi! (${result.chapter}-bob yaratildi)`);
      setSelectedFiles([]);
      setTimeout(() => navigate(`/project/${result.manga}`), 700);
    } catch (e) {
      const err = e as Error;
      setStatus(`Xatolik: ${err.message}`);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Rasm yuklash</h1>
        <p className="page-description">
          Mavjud mangaga yangi chapter qo'shish. Bob raqami avtomatik beriladi.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Manga select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Manga</label>
          <select
            value={mangaSlug}
            onChange={(e) => setMangaSlug(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Manga tanlang...</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.display_name}
              </option>
            ))}
          </select>
          {existing && (
            <p className="text-xs text-muted-foreground">
              {existing.chapter_count} chapter bor. Yangi chapter avtomatik raqamlanadi.
            </p>
          )}
        </div>

        {/* Drop zone */}
        <div
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
        >
          <CloudUpload className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Rasmlarni bu yerga tashlang yoki bosing</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPG, JPEG, WebP, BMP (max 50MB, 200 ta gacha)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedFiles.length} ta fayl tanlandi</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
                Hammasini tozalash
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedFiles.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs">{f.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload button */}
        <div className="flex items-center gap-3">
          <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || !mangaSlug} className="gap-2">
            <CloudUpload className="h-4 w-4" />
            Yuklash
          </Button>
          {status && <span className="text-sm text-muted-foreground">{status}</span>}
        </div>
      </div>
    </div>
  );
}
