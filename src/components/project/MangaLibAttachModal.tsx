import { useEffect, useState } from "react";
import { X, Link2, Loader2, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import type { MangaLibSeries } from "../../lib/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

interface MangaLibAttachModalProps {
  open: boolean;
  manga: string;
  onClose: () => void;
  onAttached: () => void;
}

export default function MangaLibAttachModal({
  open,
  manga,
  onClose,
  onAttached,
}: MangaLibAttachModalProps) {
  const [urlOrSlug, setUrlOrSlug] = useState("");
  const [resolving, setResolving] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [preview, setPreview] = useState<MangaLibSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setLanguageRu, setSetLanguageRu] = useState(true);

  useEffect(() => {
    if (open) {
      setUrlOrSlug("");
      setPreview(null);
      setError(null);
      setResolving(false);
      setAttaching(false);
      setSetLanguageRu(true);
    }
  }, [open]);

  if (!open) return null;

  async function handleResolve() {
    const value = urlOrSlug.trim();
    if (!value) return;
    setResolving(true);
    setError(null);
    setPreview(null);
    try {
      const series = await api.resolveMangaLib(value);
      setPreview(series);
    } catch (e) {
      setError((e as Error).message || "Tekshirib bo'lmadi");
    } finally {
      setResolving(false);
    }
  }

  async function handleAttach() {
    const value = urlOrSlug.trim();
    if (!value) return;
    setAttaching(true);
    setError(null);
    try {
      await api.attachMangaLib(manga, value, setLanguageRu);
      toast.success("MangaLib link biriktirildi");
      onAttached();
    } catch (e) {
      const msg = (e as Error).message || "Biriktirib bo'lmadi";
      // 409 — slug allaqachon boshqa loyihaga biriktirilgan
      if (/already|409|biriktirilgan|attached/i.test(msg)) {
        setError("Bu slug allaqachon boshqa loyihaga biriktirilgan");
      } else {
        setError(msg);
      }
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">MangaLib link biriktirish</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            disabled={attaching}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              MangaLib URL yoki slug
            </label>
            <div className="flex gap-2">
              <Input
                value={urlOrSlug}
                onChange={(e) => setUrlOrSlug(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleResolve();
                }}
                placeholder="https://mangalib.me/ru/manga/114307--..."
                disabled={attaching}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleResolve}
                disabled={resolving || attaching || !urlOrSlug.trim()}
                className="shrink-0 gap-1.5"
              >
                {resolving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Tekshir
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {preview && (
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-md border bg-muted/40 p-3">
              <div className="aspect-[3/4] overflow-hidden rounded-md bg-muted">
                {preview.cover_url && (
                  <img
                    src={preview.cover_url}
                    alt={preview.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 space-y-1.5">
                <h3 className="text-sm font-semibold leading-tight">
                  {preview.title || preview.rus_name || preview.eng_name || preview.slug}
                </h3>
                {preview.eng_name && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {preview.eng_name}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="info">{preview.chapter_count} bob</Badge>
                  {preview.status && <Badge variant="secondary">{preview.status}</Badge>}
                  {preview.year != null && (
                    <Badge variant="secondary">{preview.year}</Badge>
                  )}
                  {preview.age_rating && (
                    <Badge variant="warning">{preview.age_rating}</Badge>
                  )}
                </div>
                {preview.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {preview.summary}
                  </p>
                )}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={setLanguageRu}
              onChange={(e) => setSetLanguageRu(e.target.checked)}
              disabled={attaching}
            />
            <span>Loyiha tilini ruscha (RU) ga sozlash — RU→UZ tarjima uchun</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={attaching}>
            Bekor qilish
          </Button>
          <Button
            size="sm"
            onClick={handleAttach}
            disabled={attaching || resolving || !urlOrSlug.trim()}
            className="gap-1.5"
          >
            {attaching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Biriktirish
          </Button>
        </div>
      </div>
    </div>
  );
}
