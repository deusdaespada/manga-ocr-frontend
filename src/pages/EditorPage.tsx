import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ClipboardPaste, Copy, ExternalLink, Eye, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "../lib/api";
import type { ResultsData } from "../lib/types";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

type Draft = { original: string; translation: string; status?: string };

function buildDrafts(res: ResultsData) {
  const nextDrafts: Record<string, Draft> = {};
  res.pages.forEach((page, pageIdx) => {
    page.regions.forEach((region, regionIdx) => {
      nextDrafts[`${pageIdx}-${regionIdx}`] = {
        original: region.original_text || "",
        translation: region.uz_text || "",
      };
    });
  });
  return nextDrafts;
}

function isUntranslated(translation: string): boolean {
  return !translation || !translation.trim();
}

/** Word-level diff: qizil = o'chirilgan, yashil = qo'shilgan */
function diffWords(
  oldStr: string,
  newStr: string
): { text: string; type: "same" | "added" | "removed" }[] {
  if (oldStr === newStr) return [{ text: newStr, type: "same" }];
  if (!oldStr) return [{ text: newStr, type: "added" }];
  if (!newStr) return [{ text: oldStr, type: "removed" }];

  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const stack: { text: string; type: "same" | "added" | "removed" }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ text: oldWords[i - 1], type: "same" });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ text: newWords[j - 1], type: "added" });
      j--;
    } else {
      stack.push({ text: oldWords[i - 1], type: "removed" });
      i--;
    }
  }
  stack.reverse();

  // Merge consecutive same-type segments
  const segments: { text: string; type: "same" | "added" | "removed" }[] = [];
  for (const seg of stack) {
    if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
      segments[segments.length - 1].text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }
  return segments;
}

/** Matn uzunligiga qarab balandligi avtomatik o'sadigan textarea */
function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

function DiffDisplay({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = useMemo(() => diffWords(oldText, newText), [oldText, newText]);
  if (oldText === newText) return null;
  return (
    <div className="mt-1.5 rounded border border-border/50 bg-background/50 px-2.5 py-1.5 text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === "removed") {
          return (
            <span key={i} className="bg-red-500/20 text-red-400 line-through decoration-red-400/60">
              {seg.text}
            </span>
          );
        }
        if (seg.type === "added") {
          return (
            <span key={i} className="bg-emerald-500/20 text-emerald-400">
              {seg.text}
            </span>
          );
        }
        return <span key={i} className="text-muted-foreground">{seg.text}</span>;
      })}
    </div>
  );
}

export default function EditorPage() {
  const { manga, chapter } = useParams();
  const [data, setData] = useState<ResultsData | null>(null);
  const [status, setStatus] = useState("Yuklanmoqda...");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // serverDrafts — oxirgi saqlangan holat (paste/edit diff uchun)
  const [serverDrafts, setServerDrafts] = useState<Record<string, Draft>>({});
  const [onlyUntranslated, setOnlyUntranslated] = useState(false);
  const [frozenMissingKeys, setFrozenMissingKeys] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  // Paste modal
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");

  useEffect(() => {
    if (!manga || !chapter) return;
    api
      .getResults(manga, chapter)
      .then((res) => {
        setData(res);
        setStatus("");
        const d = buildDrafts(res);
        setDrafts(d);
        setServerDrafts(d);
      })
      .catch((err) => setStatus(`Xatolik: ${err.message}`));
  }, [manga, chapter]);

  // Nechta region o'zgargan
  const changedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const key of Object.keys(drafts)) {
      const srv = serverDrafts[key];
      const loc = drafts[key];
      if (!srv || !loc) continue;
      if (loc.translation !== srv.translation || loc.original !== srv.original) {
        keys.push(key);
      }
    }
    return keys;
  }, [drafts, serverDrafts]);

  const { totalRegions, missingCount } = useMemo(() => {
    if (!data) return { totalRegions: 0, missingCount: 0 };
    let total = 0;
    let missing = 0;
    data.pages.forEach((page, pageIdx) => {
      page.regions.forEach((region, regionIdx) => {
        const key = `${pageIdx}-${regionIdx}`;
        const draft = drafts[key];
        const translation = draft ? draft.translation : region.uz_text || "";
        const original = draft ? draft.original : region.original_text || "";
        if (!original.trim()) return;
        total += 1;
        if (isUntranslated(translation)) missing += 1;
      });
    });
    return { totalRegions: total, missingCount: missing };
  }, [data, drafts]);

  function toggleOnlyUntranslated() {
    setOnlyUntranslated((prev) => {
      const next = !prev;
      if (next && data) {
        const keys = new Set<string>();
        data.pages.forEach((page, pageIdx) => {
          page.regions.forEach((region, regionIdx) => {
            const key = `${pageIdx}-${regionIdx}`;
            const draft = drafts[key];
            const translation = draft ? draft.translation : region.uz_text || "";
            const original = draft ? draft.original : region.original_text || "";
            if (original.trim() && isUntranslated(translation)) keys.add(key);
          });
        });
        setFrozenMissingKeys(keys);
      }
      return next;
    });
  }

  // ── Copy All as JSON ──
  const handleCopyAll = async () => {
    if (!data) return;
    const items: any[] = [];
    data.pages.forEach((page, pageIdx) => {
      page.regions.forEach((region, regionIdx) => {
        const key = `${pageIdx}-${regionIdx}`;
        const draft = drafts[key];
        const original = draft ? draft.original : region.original_text || "";
        if (!original.trim()) return;
        items.push({
          pageIdx,
          regionIdx,
          original_text: draft ? draft.original : region.original_text || "",
          uz_text: draft ? draft.translation : region.uz_text || "",
        });
      });
    });
    const json = JSON.stringify(items, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast.success(`${items.length} ta matn JSON nusxalandi`);
    } catch {
      toast.error("Nusxalashda xatolik");
    }
  };

  // ── Paste JSON — modaldagi matnni qo'llash ──
  const applyPasteJson = () => {
    setPasteError("");
    let parsed: any;
    try {
      parsed = JSON.parse(pasteText.trim());
    } catch {
      setPasteError("JSON formati noto'g'ri — sintaksis xatosi");
      return;
    }
    if (!Array.isArray(parsed)) {
      setPasteError("JSON massiv (array) bo'lishi kerak: [ {...}, {...} ]");
      return;
    }
    const valid = parsed.every(
      (item: any) =>
        item &&
        typeof item.pageIdx === "number" &&
        typeof item.regionIdx === "number" &&
        typeof item.uz_text === "string"
    );
    if (!valid) {
      setPasteError("Har bir element pageIdx, regionIdx va uz_text maydonlariga ega bo'lishi kerak");
      return;
    }

    let count = 0;
    let notFound = 0;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const item of parsed) {
        const key = `${item.pageIdx}-${item.regionIdx}`;
        if (next[key]) {
          const newOriginal = item.original_text ?? next[key].original;
          const newTranslation = item.uz_text;
          if (newOriginal !== next[key].original || newTranslation !== next[key].translation) {
            count++;
          }
          next[key] = {
            ...next[key],
            original: newOriginal,
            translation: newTranslation,
            status: undefined,
          };
        } else {
          notFound++;
        }
      }
      return next;
    });

    setPasteOpen(false);
    setPasteText("");
    if (count > 0) {
      toast.success(
        `${count} ta o'zgarish aniqlandi${notFound > 0 ? ` · ${notFound} ta region topilmadi` : ""}`
      );
    } else {
      toast.info("Hech qanday o'zgarish topilmadi");
    }
  };

  // Modal ochilganda clipboard'dan avtomatik o'qishga harakat qilamiz
  const openPasteModal = async () => {
    setPasteError("");
    setPasteText("");
    setPasteOpen(true);
    try {
      const clip = await navigator.clipboard.readText();
      if (clip && clip.trim().startsWith("[")) {
        setPasteText(clip);
      }
    } catch {
      // clipboard ruxsati yo'q — foydalanuvchi qo'lda paste qiladi
    }
  };

  // ── Bulk Update — faqat o'zgarganlarni backendga yuborish ──
  const handleBulkUpdate = async () => {
    if (!manga || !chapter || changedKeys.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        changedKeys.map((key) => {
          const [pStr, rStr] = key.split("-");
          const pageIdx = parseInt(pStr);
          const regionIdx = parseInt(rStr);
          const draft = drafts[key];
          return api.updateRegion(manga, chapter, pageIdx, regionIdx, {
            original_text: draft.original,
            uz_text: draft.translation,
          });
        })
      );
      // serverDrafts yangilash — endi diff yo'qoladi
      setServerDrafts({ ...drafts });
      // data ham yangilash
      setData((prev) => {
        if (!prev) return prev;
        const newPages = [...prev.pages];
        for (const key of changedKeys) {
          const [pStr, rStr] = key.split("-");
          const pageIdx = parseInt(pStr);
          const regionIdx = parseInt(rStr);
          const draft = drafts[key];
          const page = { ...newPages[pageIdx] };
          const newRegions = [...page.regions];
          newRegions[regionIdx] = {
            ...newRegions[regionIdx],
            original_text: draft.original,
            uz_text: draft.translation,
          };
          page.regions = newRegions;
          newPages[pageIdx] = page;
        }
        return { ...prev, pages: newPages };
      });
      toast.success(`${changedKeys.length} ta region yangilandi`);
    } catch (e) {
      const err = e as Error;
      toast.error(`Xatolik: ${err.message}`);
    } finally {
      setBulkSaving(false);
    }
  };

  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">{status}</div>;
  }

  return (
    <div className="animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={`/results/${manga}/${chapter}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {manga} / {chapter}-bob
          </Link>
          <h1 className="page-title">OCR va tarjima tahrirlash</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Copy / Paste / Update */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handleCopyAll}
            title="Barcha matnlarni JSON nusxalash"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={openPasteModal}
            title="JSON ni paste qilish"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste
          </Button>
          {changedKeys.length > 0 && (
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handleBulkUpdate}
              disabled={bulkSaving}
            >
              {bulkSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Update ({changedKeys.length})
            </Button>
          )}

          <div className="h-5 w-px bg-border" />

          <Button
            variant={onlyUntranslated ? "default" : "outline"}
            size="sm"
            className={`gap-1.5 h-8 text-xs ${
              onlyUntranslated
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : missingCount > 0
                  ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
                  : ""
            }`}
            onClick={toggleOnlyUntranslated}
            disabled={missingCount === 0 && !onlyUntranslated}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {onlyUntranslated ? "Filterni olib tashlash" : "Tarjimasizlar"}
            <span
              className={`ml-1 rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                onlyUntranslated ? "bg-white/20" : missingCount > 0 ? "bg-red-500/20" : "bg-muted"
              }`}
            >
              {missingCount}/{totalRegions}
            </span>
          </Button>
          <Link to={`/results/${manga}/${chapter}`}>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Natijalar
            </Button>
          </Link>
        </div>
      </div>

      {/* O'zgarishlar banner */}
      {changedKeys.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-300">
            <strong>{changedKeys.length}</strong> ta region o'zgargan — diff pastda ko'rsatilgan
          </span>
          <Button
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={handleBulkUpdate}
            disabled={bulkSaving}
          >
            {bulkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Hammasini saqlash
          </Button>
        </div>
      )}

      {onlyUntranslated && missingCount === 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300">
          Hamma regionlar tarjima qilingan. Filterni olib tashlashingiz mumkin.
        </div>
      )}

      {/* Pages */}
      <div className="space-y-2.5">
        {data.pages.map((page, pageIdx) => {
          const visibleRegions = page.regions
            .map((region, regionIdx) => ({ region, regionIdx }))
            .filter(({ regionIdx }) => {
              if (!onlyUntranslated) return true;
              return frozenMissingKeys.has(`${pageIdx}-${regionIdx}`);
            });

          if (onlyUntranslated && visibleRegions.length === 0) return null;

          return (
            <div key={`page-${pageIdx}`} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Sahifa {pageIdx + 1}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {onlyUntranslated
                      ? `${visibleRegions.length} tarjimasiz / ${page.regions.length}`
                      : `${page.regions.length} region`}
                  </span>
                </div>
                <Link to={`/results/${manga}/${chapter}?page=${pageIdx + 1}`}>
                  <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px]">
                    <ExternalLink className="h-3 w-3" />
                    Rasm
                  </Button>
                </Link>
              </div>
              {visibleRegions.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Bu sahifada matn regionlari topilmadi.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {visibleRegions.map(({ regionIdx }) => {
                    const key = `${pageIdx}-${regionIdx}`;
                    const draft = drafts[key] || { original: "", translation: "" };
                    const srv = serverDrafts[key] || { original: "", translation: "" };
                    const missing = Boolean(draft.original.trim()) && isUntranslated(draft.translation);
                    const isChanged = draft.translation !== srv.translation || draft.original !== srv.original;
                    const translationChanged = draft.translation !== srv.translation;
                    const originalChanged = draft.original !== srv.original;

                    return (
                      <div
                        key={key}
                        className={`group flex items-start gap-2 px-3 py-1.5 transition-colors ${
                          isChanged
                            ? "border-l-2 border-l-amber-500/70 bg-amber-500/[0.03]"
                            : missing
                              ? "border-l-2 border-l-red-500/60 bg-red-500/[0.03]"
                              : "border-l-2 border-l-transparent"
                        }`}
                      >
                        {/* Region raqami */}
                        <div className="flex w-7 flex-shrink-0 flex-col items-center pt-1.5">
                          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                            {regionIdx + 1}
                          </span>
                          {missing && !isChanged && (
                            <AlertTriangle className="mt-0.5 h-3 w-3 text-red-400" />
                          )}
                          {isChanged && (
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" title="O'zgargan" />
                          )}
                        </div>

                        {/* Original + Tarjima yonma-yon */}
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                          <div className="min-w-0">
                            <AutoTextarea
                              value={draft.original}
                              placeholder="OCR matn"
                              className={`min-h-0 resize-none py-1.5 text-sm leading-snug ${
                                originalChanged ? "border-amber-500/50 focus-visible:ring-amber-500/40" : ""
                              }`}
                              onChange={(v) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: { ...draft, original: v, status: undefined },
                                }))
                              }
                            />
                            {originalChanged && (
                              <DiffDisplay oldText={srv.original} newText={draft.original} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <AutoTextarea
                              value={draft.translation}
                              placeholder="Tarjima (uz)"
                              className={`min-h-0 resize-none py-1.5 text-sm leading-snug ${
                                translationChanged
                                  ? "border-amber-500/50 focus-visible:ring-amber-500/40"
                                  : missing
                                    ? "border-red-500/40 focus-visible:ring-red-500/40"
                                    : ""
                              }`}
                              onChange={(v) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: { ...draft, translation: v, status: undefined },
                                }))
                              }
                            />
                            {translationChanged && (
                              <DiffDisplay oldText={srv.translation} newText={draft.translation} />
                            )}
                          </div>
                        </div>

                        {/* Amallar — faqat kerak bo'lganda yoki hoverda */}
                        <div className="flex flex-shrink-0 items-center gap-0.5 pt-1">
                          {isChanged ? (
                            <button
                              title="Saqlash"
                              className="flex h-7 w-7 items-center justify-center rounded text-primary transition-colors hover:bg-primary/15"
                              onClick={async () => {
                                if (!manga || !chapter) return;
                                setDrafts((prev) => ({ ...prev, [key]: { ...draft, status: "..." } }));
                                try {
                                  await api.updateRegion(manga, chapter, pageIdx, regionIdx, {
                                    original_text: draft.original,
                                    uz_text: draft.translation,
                                  });
                                  setServerDrafts((prev) => ({
                                    ...prev,
                                    [key]: { original: draft.original, translation: draft.translation },
                                  }));
                                  setDrafts((prev) => ({ ...prev, [key]: { ...draft, status: undefined } }));
                                } catch (e) {
                                  const err = e as Error;
                                  toast.error(`Xatolik: ${err.message}`);
                                  setDrafts((prev) => ({ ...prev, [key]: { ...draft, status: undefined } }));
                                }
                              }}
                            >
                              {draft.status === "..." ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="block h-7 w-7" />
                          )}
                          <button
                            title="O'chirish"
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            onClick={async () => {
                              if (!manga || !chapter) return;
                              if (!confirm("Bu regionni o'chirmoqchimisiz?")) return;
                              await api.deleteRegion(manga, chapter, pageIdx, regionIdx);
                              const updated = await api.getResults(manga, chapter);
                              setData(updated);
                              const d = buildDrafts(updated);
                              setDrafts(d);
                              setServerDrafts(d);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paste JSON modal */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>JSON paste qilish</DialogTitle>
            <DialogDescription>
              Grammatik tekshirilgan JSON ni quyiga joylang. <code>pageIdx</code> va{" "}
              <code>regionIdx</code> bo'yicha mos regionlar yangilanadi, o'zgarganlari git
              uslubida belgilanadi.
            </DialogDescription>
          </DialogHeader>
          <textarea
            autoFocus
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              if (pasteError) setPasteError("");
            }}
            placeholder='[{"pageIdx": 0, "regionIdx": 0, "original_text": "...", "uz_text": "..."}]'
            className="min-h-[280px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/50"
            spellCheck={false}
          />
          {pasteError && (
            <p className="text-xs text-red-400">{pasteError}</p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasteOpen(false)}>
              Bekor qilish
            </Button>
            <Button size="sm" onClick={applyPasteJson} disabled={!pasteText.trim()} className="gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" />
              Qo'llash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
