import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Scissors, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import type { PageInfo } from "../../lib/types";
import { Button } from "../ui/button";

type Anchor = "start" | "end";
type Side = "top" | "bottom";

interface ChapterPages {
  chapter: string;
  images: PageInfo[];
  error?: string;
}

/** Bobdagi mos rasm — anchor/offset asosida hisoblanadi. */
interface Resolved {
  chapter: string;
  image: PageInfo | null;
  index: number | null;
  total: number;
  error?: string;
}

interface BulkIndexTrimModalProps {
  open: boolean;
  manga: string;
  /** Joriy bobda tanlangan rasm indexi (0-based). */
  targetIndex: number;
  /** Joriy bobdagi rasmlar soni — offsetni hisoblash uchun. */
  currentTotal: number;
  onClose: () => void;
  /** Qirqish tugagach chaqiriladi — joriy sahifani qayta yuklash uchun. */
  onTrimmed: () => void;
}

/**
 * Tanlangan rasmga mos keladigan bitta rasmni har bobdan topib, tepa yoki
 * past chetidan bir xil px ni qirqadi.
 *
 * Boblardagi rasmlar soni har xil bo'lgani uchun moslik **chekkadan offset**
 * bo'yicha hisoblanadi (xuddi "barcha boblardan o'chirish" kabi). Har bir
 * mos rasm uchun qirqiladigan zona qizil bilan ko'rsatiladi (preview).
 */
export default function BulkIndexTrimModal({
  open,
  manga,
  targetIndex,
  currentTotal,
  onClose,
  onTrimmed,
}: BulkIndexTrimModalProps) {
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterPages[]>([]);
  const [anchor, setAnchor] = useState<Anchor>("end");
  const [side, setSide] = useState<Side>("top");
  const [pixels, setPixels] = useState<number>(100);
  // Belgilangan (qirqiladigan) bob nomlari
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [trimming, setTrimming] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Joriy bobdagi tanlovga asoslangan chekkadan offset.
  const offsetFromStart = targetIndex;
  const offsetFromEnd = Math.max(0, currentTotal - 1 - targetIndex);
  const offset = anchor === "end" ? offsetFromEnd : offsetFromStart;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setChapters([]);
      setChecked(new Set());
      setAnchor(offsetFromEnd <= offsetFromStart ? "end" : "start");
      try {
        const project = await api.getProject(manga);
        const published = new Set(project.published_chapters ?? []);
        const names = project.chapters
          .filter(
            (c) =>
              !published.has(c.name) && !c.remote && c.source !== "r2"
          )
          .map((c) => c.name);
        const results = await Promise.all(
          names.map(async (name): Promise<ChapterPages> => {
            try {
              const data = await api.getChapterPages(manga, name);
              return { chapter: name, images: data.images };
            } catch (e) {
              return { chapter: name, images: [], error: (e as Error).message };
            }
          })
        );
        if (cancelled) return;
        setChapters(results);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, manga, targetIndex, currentTotal]);

  // Har bob uchun mos rasmni hisoblash.
  const resolved = useMemo<Resolved[]>(() => {
    return chapters.map((cp) => {
      if (cp.error) {
        return { chapter: cp.chapter, image: null, index: null, total: 0, error: cp.error };
      }
      const total = cp.images.length;
      const idx = anchor === "end" ? total - 1 - offset : offset;
      const valid = idx >= 0 && idx < total;
      return {
        chapter: cp.chapter,
        image: valid ? cp.images[idx] : null,
        index: valid ? idx : null,
        total,
      };
    });
  }, [chapters, anchor, offset]);

  // Anchor yoki ma'lumot o'zgarsa — barcha mos topilgan boblar belgilanadi.
  useEffect(() => {
    setChecked(new Set(resolved.filter((r) => r.image).map((r) => r.chapter)));
  }, [resolved]);

  const checkedList = useMemo(
    () => resolved.filter((r) => r.image && checked.has(r.chapter)),
    [resolved, checked]
  );
  const matchedCount = useMemo(() => resolved.filter((r) => r.image).length, [resolved]);

  if (!open) return null;

  function toggle(chapter: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  }

  function selectAll() {
    setChecked(new Set(resolved.filter((r) => r.image).map((r) => r.chapter)));
  }

  function clearAll() {
    setChecked(new Set());
  }

  async function handleTrim() {
    const items = checkedList;
    if (items.length === 0 || pixels <= 0) return;
    if (
      !confirm(
        `${items.length} ta bobdagi rasm ${side === "top" ? "tepadan" : "pastdan"} ` +
          `${pixels}px qirqiladi. Bu amalni qaytarib bo'lmaydi. Davom etilsinmi?`
      )
    )
      return;

    setTrimming(true);
    setProgress({ done: 0, total: items.length });

    let okChapters = 0;
    let failChapters = 0;
    const failedNames: string[] = [];

    for (const r of items) {
      try {
        await api.trimImage(manga, r.chapter, r.image!.filename, side, pixels);
        okChapters++;
      } catch {
        failChapters++;
        failedNames.push(r.chapter);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setTrimming(false);

    if (failChapters === 0) {
      toast.success(`${okChapters} ta bobdagi rasm ${pixels}px qirqildi`);
    } else {
      toast.warning(
        `${okChapters} ta bobda qirqildi. ${failChapters} ta bobda xatolik: ${failedNames.join(", ")}`
      );
    }

    onTrimmed();
    onClose();
  }

  const anchorLabel =
    anchor === "end"
      ? offset === 0
        ? "oxirgi rasm"
        : `oxiridan ${offset + 1}-rasm`
      : offset === 0
        ? "birinchi rasm"
        : `boshidan ${offset + 1}-rasm`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={trimming ? undefined : onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              Barcha boblardan qirqish — {anchorLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              Faqat publish qilinmagan boblar. Har bobda chekkadan bir xil
              masofadagi rasm topildi — qizil zona qirqiladi.
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={trimming}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-2.5">
          {/* Anchor toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={anchor === "end" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setAnchor("end")}
              disabled={loading || trimming}
            >
              Oxiridan
            </Button>
            <Button
              variant={anchor === "start" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setAnchor("start")}
              disabled={loading || trimming}
            >
              Boshidan
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Side toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={side === "top" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setSide("top")}
              disabled={loading || trimming}
            >
              Tepadan
            </Button>
            <Button
              variant={side === "bottom" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setSide("bottom")}
              disabled={loading || trimming}
            >
              Pastdan
            </Button>
          </div>

          {/* Pixel input */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              value={pixels}
              onChange={(e) => setPixels(Math.max(0, parseInt(e.target.value) || 0))}
              disabled={loading || trimming}
              className="h-8 w-20 rounded-md border bg-background px-2 text-sm"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>

          <div className="h-6 w-px bg-border" />

          <Button variant="outline" size="sm" onClick={selectAll} disabled={loading || trimming}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Hammasini belgilash
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={loading || trimming}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Tozalash
          </Button>

          <div className="ml-auto text-xs text-muted-foreground">
            {matchedCount} ta bobda topildi · {checkedList.length} ta belgilandi
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Barcha boblar yuklanmoqda...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {resolved.map((r) => {
                const sel = checked.has(r.chapter);
                const missing = !r.image;
                // Preview uchun: qirqiladigan zona ulushini taxminiy ko'rsatish.
                // Rasm balandligi noma'lum bo'lishi mumkin (0) — bunda 15% deb olamiz.
                const h = r.image?.height ?? 0;
                const pct = h > 0 ? Math.min(100, (pixels / h) * 100) : 15;
                return (
                  <button
                    key={r.chapter}
                    type="button"
                    disabled={missing}
                    onClick={() => toggle(r.chapter)}
                    className={`relative overflow-hidden rounded-md border-2 text-left transition-all ${
                      missing
                        ? "cursor-not-allowed border-dashed border-muted bg-muted/30"
                        : sel
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/40"
                    }`}
                    title={r.image?.filename ?? r.chapter}
                  >
                    {r.image ? (
                      <div className="relative h-[170px] w-full">
                        <img
                          src={r.image.image_url}
                          alt={r.image.filename}
                          className="block h-[170px] w-full object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                        {/* Qirqiladigan zona overlay — faqat belgilangan boblarda */}
                        {sel && (
                          <div
                            className="absolute inset-x-0 flex items-center justify-center bg-red-500/45"
                            style={
                              side === "top"
                                ? { top: 0, height: `${pct}%` }
                                : { bottom: 0, height: `${pct}%` }
                            }
                          >
                            <span className="rounded bg-red-600 px-1 text-[9px] font-bold text-white shadow">
                              {pixels}px
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-[170px] w-full flex-col items-center justify-center px-2 text-center">
                        <span className="text-[11px] text-muted-foreground">
                          {r.error ? "Yuklab bo'lmadi" : "Mos rasm yo'q"}
                        </span>
                        <span className="mt-1 text-[10px] text-muted-foreground/70">
                          {r.total} rasm
                        </span>
                      </div>
                    )}

                    {/* Chapter label */}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-1.5 pb-3 pt-1">
                      <span className="text-[10px] font-bold text-white">
                        {r.chapter}-bob
                      </span>
                      {r.index != null && (
                        <span className="rounded bg-black/60 px-1 text-[9px] text-white/90">
                          #{r.index + 1}/{r.total}
                        </span>
                      )}
                    </div>

                    {/* Selected check */}
                    {sel && !missing && (
                      <div className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <div className="text-xs text-muted-foreground">
            {trimming
              ? `Qirqilmoqda... ${progress.done}/${progress.total} bob`
              : `${checkedList.length} ta bobdagi rasm ${side === "top" ? "tepadan" : "pastdan"} ${pixels}px qirqiladi`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={trimming}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleTrim}
              disabled={trimming || loading || checkedList.length === 0 || pixels <= 0}
            >
              {trimming ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scissors className="mr-1.5 h-3.5 w-3.5" />
              )}
              Qirqish ({checkedList.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
