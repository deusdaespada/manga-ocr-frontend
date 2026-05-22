import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, Download, BookDown } from "lucide-react";
import { toast } from "sonner";

import { api } from "../lib/api";
import type {
  MangaDexChapter,
  MangaDexManga,
  Project,
} from "../lib/types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const FEED_PAGE_SIZE = 100;
const AUTO_TARGET = "__auto__";

export default function MangaDexDetailPage() {
  const { mangaId } = useParams<{ mangaId: string }>();
  const navigate = useNavigate();

  const [manga, setManga] = useState<MangaDexManga | null>(null);
  const [chapters, setChapters] = useState<MangaDexChapter[]>([]);
  const [feedTotal, setFeedTotal] = useState(0);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [mangaError, setMangaError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [target, setTarget] = useState<string>(AUTO_TARGET);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Manga detail
  useEffect(() => {
    if (!mangaId) return;
    let cancelled = false;
    api
      .getMangaDexManga(mangaId)
      .then((data) => {
        if (cancelled) return;
        setManga(data);
        if (data.local_match_slug) {
          setTarget(data.local_match_slug);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setMangaError(err.message || "MangaDex xato");
      });
    return () => {
      cancelled = true;
    };
  }, [mangaId]);

  // Local projects (attach-target uchun)
  useEffect(() => {
    api
      .getProjects()
      .then((data) =>
        setProjects(
          [...data].sort((a, b) =>
            (a.metadata?.title_en || a.display_name).localeCompare(
              b.metadata?.title_en || b.display_name,
            ),
          ),
        ),
      )
      .catch(() => setProjects([]));
  }, []);

  const loadFeed = useCallback(
    async (offset: number, append: boolean) => {
      if (!mangaId) return;
      setFeedLoading(true);
      setFeedError(null);
      try {
        const data = await api.getMangaDexFeed(mangaId, offset, FEED_PAGE_SIZE);
        setFeedTotal(data.total);
        setFeedOffset(offset);
        setChapters((prev) => (append ? [...prev, ...data.results] : data.results));
      } catch (err) {
        setFeedError((err as Error).message || "Feed yuklanmadi");
      } finally {
        setFeedLoading(false);
      }
    },
    [mangaId],
  );

  useEffect(() => {
    loadFeed(0, false);
  }, [loadFeed]);

  async function handleImport(chapter: MangaDexChapter) {
    if (!mangaId) return;
    if (chapter.kind !== "available") {
      toast.error("Bu chapter import qilib bo'lmaydi");
      return;
    }

    // Confirmation: agar tanlangan target boshqa mangadex_id bilan bog'liq bo'lsa
    if (target !== AUTO_TARGET) {
      const targetProject = projects.find((p) => p.slug === target);
      const targetMangaDexId = (targetProject as any)?.metadata?.mangadex_id;
      if (targetMangaDexId && targetMangaDexId !== mangaId) {
        const ok = window.confirm(
          `Bu manga avval boshqa MangaDex ID bilan bog'langan. Davom ettirilsinmi?`,
        );
        if (!ok) return;
      }
    }

    setImportingId(chapter.id);
    try {
      const res = await api.importMangaDexChapter({
        mangadex_manga_id: mangaId,
        mangadex_chapter_id: chapter.id,
        target_slug: target === AUTO_TARGET ? null : target,
      });
      if (res.status === "exists") {
        toast.info(res.detail || "Chapter avval import qilingan");
        await loadFeed(0, false);
        return;
      }
      toast.success(`Import boshlandi`);
      // Job batafsil sahifasiga o'tish — progressni ko'rish uchun
      if (res.job_id) navigate(`/job/${res.job_id}`);
    } catch (err) {
      toast.error((err as Error).message || "Import xato");
    } finally {
      setImportingId(null);
    }
  }

  async function handleImportFullManga() {
    if (!mangaId || !manga) return;
    const importable = chapters.filter((c) => c.kind === "available" && !c.imported);
    if (importable.length === 0) {
      toast.info("Import qilinadigan chapter yo'q (yoki barchasi import qilingan)");
      return;
    }
    const ok = window.confirm(
      `${importable.length} ta chapter import qilinadi. Davom etsinmi?`,
    );
    if (!ok) return;
    try {
      const res = await api.importMangaDexManga(
        mangaId,
        target === AUTO_TARGET ? null : target,
      );
      toast.success(`${res.total} ta import jobi navbatga qo'yildi`);
    } catch (err) {
      toast.error((err as Error).message || "Import xato");
    }
  }

  if (mangaError) {
    return (
      <div className="animate-fade-in">
        <Link to="/mangadex" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Search Manga'ga qaytish
        </Link>
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{mangaError}</div>
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="animate-fade-in">
        <Link to="/mangadex" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Search Manga'ga qaytish
        </Link>
        <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Yuklanmoqda...
        </div>
      </div>
    );
  }

  const fallback = "Not provided";
  const hasMore = feedOffset + FEED_PAGE_SIZE < feedTotal;
  const allImportable = chapters.some((c) => c.kind === "available" && !c.imported);

  return (
    <div className="animate-fade-in">
      <Link
        to="/mangadex"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Search Manga'ga qaytish
      </Link>

      {/* Header card */}
      <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 md:grid-cols-[200px_1fr]">
        <div className="aspect-[3/4] overflow-hidden rounded-md bg-muted">
          {manga.cover_url && (
            <img
              src={manga.cover_url}
              alt={manga.title_en}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold">{manga.title_en || fallback}</h1>
            {manga.alt_titles[0] && (
              <p className="text-sm text-muted-foreground">{manga.alt_titles[0]}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {manga.description_en || fallback}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="info">Status: {manga.status || fallback}</Badge>
            <Badge variant="info">Year: {manga.year ?? fallback}</Badge>
            <Badge variant="info">Rating: {manga.content_rating || fallback}</Badge>
            {manga.authors.length > 0 && (
              <Badge variant="info">Author: {manga.authors[0]}</Badge>
            )}
            {manga.local_match_slug && (
              <Badge variant="success">imported as {manga.local_match_slug}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {manga.tags.slice(0, 12).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag.name}
              </span>
            ))}
          </div>

          {/* Attach target */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Mavjud manga'ga biriktirish:</span>
            <div className="min-w-[240px]">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_TARGET}>None (auto-create)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {(p.metadata?.title_en || p.display_name)} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={handleImportFullManga}
              disabled={!allImportable || feedLoading}
            >
              <BookDown className="h-4 w-4" />
              Import full manga
            </Button>
          </div>
        </div>
      </div>

      {/* Chapter feed */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-medium">
          <span>Chapters ({feedTotal})</span>
          {feedLoading && (
            <span className="text-xs text-muted-foreground">Yuklanmoqda...</span>
          )}
        </div>

        {feedError && (
          <div className="border-b border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{feedError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => loadFeed(feedOffset, false)}
            >
              Qayta urinish
            </Button>
          </div>
        )}

        <ul className="divide-y">
          {chapters.map((ch) => (
            <li
              key={ch.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    Ch. {ch.chapter || "?"}
                  </span>
                  {ch.title && (
                    <span className="truncate text-muted-foreground">— {ch.title}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{ch.pages} pages</span>
                  {ch.scanlation_group && <span>· {ch.scanlation_group}</span>}
                  {ch.kind === "external" && (
                    <Badge variant="warning" className="text-[10px]">External</Badge>
                  )}
                  {ch.kind === "empty" && (
                    <Badge variant="warning" className="text-[10px]">Empty</Badge>
                  )}
                  {ch.imported ? (
                    <Badge variant="success" className="text-[10px]">Imported</Badge>
                  ) : (
                    <Badge variant="info" className="text-[10px]">Not imported</Badge>
                  )}
                </div>
              </div>

              {ch.kind === "available" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(importingId) || ch.imported}
                  onClick={() => handleImport(ch)}
                  title={
                    ch.imported ? "Chapter avval import qilingan" : "Importni boshlash"
                  }
                >
                  <Download className="h-4 w-4" />
                  {importingId === ch.id ? "Boshlanmoqda..." : "Import"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title={
                    ch.kind === "external"
                      ? "MangaDex bu chapterni hostlamaydi"
                      : "Chapter bo'sh"
                  }
                >
                  <Download className="h-4 w-4" />
                  Import
                </Button>
              )}
            </li>
          ))}
        </ul>

        {hasMore && (
          <div className="border-t p-3 text-center">
            <Button
              variant="outline"
              size="sm"
              disabled={feedLoading}
              onClick={() => loadFeed(feedOffset + FEED_PAGE_SIZE, true)}
            >
              Yana yuklash ({feedTotal - feedOffset - FEED_PAGE_SIZE} qoldi)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
