import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Trash2, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import type { PageInfo } from "../../lib/types";
import { Button } from "../ui/button";

type Anchor = "start" | "end";

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

interface BulkIndexDeleteModalProps {
  open: boolean;
  manga: string;
  /** Joriy bobda tanlangan rasm indexi (0-based). */
  targetIndex: number;
  /** Joriy bobdagi rasmlar soni — offsetni hisoblash uchun. */
  currentTotal: number;
  onClose: () => void;
  /** O'chirish tugagach chaqiriladi — joriy sahifani qayta yuklash uchun. */
  onDeleted: () => void;
}

/**
 * Tanlangan rasmga mos keladigan bitta rasmni har bobdan topib o'chirish.
 *
 * Boblardagi rasmlar soni har xil bo'lgani uchun moslik **chekkadan offset**
 * bo'yicha hisoblanadi. Standart holatda oxiridan sanaladi (reklama/banner
 * odatda oxirda bo'ladi), lekin boshidan sanashga ham o'tish mumkin.
 *
 * Har bobda faqat shu bitta mos rasm ko'rsatiladi — qolganlari yashiriladi.
 */
export default function BulkIndexDeleteModal({
  open,
  manga,
  targetIndex,
  currentTotal,
  onClose,
  onDeleted,
}: BulkIndexDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterPages[]>([]);
  const [anchor, setAnchor] = useState<Anchor>("end");
  // Belgilangan (o'chiriladigan) bob nomlari
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
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
      // Joriy bobdagi tanlov oxirgi rasmga yaqinroqmi yoki boshigami —
      // shunga qarab standart anchor tanlanadi.
      setAnchor(offsetFromEnd <= offsetFromStart ? "end" : "start");
      try {
        const project = await api.getProject(manga);
        const published = new Set(project.published_chapters ?? []);
        // Faqat publish qilinmagan lokal boblar — published va remote/R2
        // boblar o'tkazib yuboriladi.
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

  async function handleDelete() {
    const items = checkedList;
    if (items.length === 0) return;
    if (
      !confirm(
        `${items.length} ta bobdan bittadan rasm o'chiriladi. ` +
          `Bu amalni qaytarib bo'lmaydi. Davom etilsinmi?`
      )
    )
      return;

    setDeleting(true);
    setProgress({ done: 0, total: items.length });

    let okChapters = 0;
    let failChapters = 0;
    let deletedTotal = 0;
    const failedNames: string[] = [];

    for (const r of items) {
      try {
        const res = await api.deletePages(manga, r.chapter, [r.image!.filename]);
        deletedTotal += res.deleted;
        okChapters++;
      } catch {
        failChapters++;
        failedNames.push(r.chapter);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setDeleting(false);

    if (failChapters === 0) {
      toast.success(`${deletedTotal} ta rasm ${okChapters} ta bobdan o'chirildi`);
    } else {
      toast.warning(
        `${deletedTotal} ta rasm o'chirildi. ${failChapters} ta bobda xatolik: ${failedNames.join(", ")}`
      );
    }

    onDeleted();
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
      onClick={deleting ? undefined : onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              Barcha boblardan o'chirish — {anchorLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              Faqat publish qilinmagan boblar. Har bobda chekkadan bir xil
              masofadagi rasm topildi — mos kelmaganini bosib bekor qiling.
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
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
              disabled={loading || deleting}
            >
              Oxiridan
            </Button>
            <Button
              variant={anchor === "start" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setAnchor("start")}
              disabled={loading || deleting}
            >
              Boshidan
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          <Button variant="outline" size="sm" onClick={selectAll} disabled={loading || deleting}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Hammasini belgilash
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={loading || deleting}>
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
                          ? "border-destructive ring-2 ring-destructive/30"
                          : "border-transparent hover:border-muted-foreground/40"
                    }`}
                    title={r.image?.filename ?? r.chapter}
                  >
                    {r.image ? (
                      <img
                        src={r.image.image_url}
                        alt={r.image.filename}
                        className="block h-[170px] w-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
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
                      <div className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow">
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
            {deleting
              ? `O'chirilmoqda... ${progress.done}/${progress.total} bob`
              : `${checkedList.length} ta rasm o'chiriladi`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || loading || checkedList.length === 0}
            >
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              O'chirish ({checkedList.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
