import { useState, useRef, useMemo } from "react";
import { ChevronLeft, Copy, ClipboardPaste, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { Button } from "../ui/button";

interface TranslationText {
  pageIdx: number;
  regionIdx: number;
  original_text: string;
  uz_text: string;
}

interface TranslationTextsViewProps {
  texts: TranslationText[];
  manga: string;
  chapter: string;
  onBack: () => void;
  onDataUpdate: React.Dispatch<React.SetStateAction<any>>;
}

/** Word-level diff: returns segments with type "same", "added", "removed" */
function diffWords(
  oldStr: string,
  newStr: string
): { text: string; type: "same" | "added" | "removed" }[] {
  if (oldStr === newStr) return [{ text: newStr, type: "same" }];
  if (!oldStr) return [{ text: newStr, type: "added" }];
  if (!newStr) return [{ text: oldStr, type: "removed" }];

  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  // Simple LCS-based diff
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

  // Backtrack
  const segments: { text: string; type: "same" | "added" | "removed" }[] = [];
  let i = m,
    j = n;
  const stack: { text: string; type: "same" | "added" | "removed" }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ text: oldWords[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ text: newWords[j - 1], type: "added" });
      j--;
    } else {
      stack.push({ text: oldWords[i - 1], type: "removed" });
      i--;
    }
  }

  stack.reverse();

  // Merge consecutive segments of same type
  for (const seg of stack) {
    if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
      segments[segments.length - 1].text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

export default function TranslationTextsView({
  texts,
  manga,
  chapter,
  onBack,
  onDataUpdate,
}: TranslationTextsViewProps) {
  const [localTexts, setLocalTexts] = useState<TranslationText[]>(texts);
  const [updating, setUpdating] = useState(false);
  const prevTextsRef = useRef(texts);

  // Sync when parent texts reference changes
  if (texts !== prevTextsRef.current) {
    prevTextsRef.current = texts;
    // Only reset local if there are no local changes
    if (!hasLocalChanges(texts, localTexts)) {
      setLocalTexts(texts);
    }
  }

  function hasLocalChanges(original: TranslationText[], local: TranslationText[]): boolean {
    if (original.length !== local.length) return true;
    return original.some(
      (t, i) => t.uz_text !== local[i].uz_text || t.original_text !== local[i].original_text
    );
  }

  const isDirty = hasLocalChanges(texts, localTexts);

  const changedCount = useMemo(
    () =>
      localTexts.filter((l, i) => {
        const o = texts[i];
        return o && (l.uz_text !== o.uz_text || l.original_text !== o.original_text);
      }).length,
    [localTexts, texts]
  );

  // Copy all texts as JSON
  const handleCopyAll = async () => {
    const json = JSON.stringify(
      localTexts.map((t) => ({
        pageIdx: t.pageIdx,
        regionIdx: t.regionIdx,
        original_text: t.original_text,
        uz_text: t.uz_text,
      })),
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Barcha matnlar JSON shaklda nusxalandi");
    } catch {
      toast.error("Nusxalashda xatolik");
    }
  };

  // Paste JSON from clipboard
  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      const parsed = JSON.parse(clipText);
      if (!Array.isArray(parsed)) {
        toast.error("JSON massiv bo'lishi kerak");
        return;
      }
      const valid = parsed.every(
        (item: any) =>
          typeof item.pageIdx === "number" &&
          typeof item.regionIdx === "number" &&
          typeof item.uz_text === "string"
      );
      if (!valid) {
        toast.error("JSON formati noto'g'ri: pageIdx, regionIdx, uz_text kerak");
        return;
      }
      const updated = localTexts.map((t) => {
        const match = parsed.find(
          (p: any) => p.pageIdx === t.pageIdx && p.regionIdx === t.regionIdx
        );
        if (match) {
          return {
            ...t,
            uz_text: match.uz_text,
            original_text: match.original_text ?? t.original_text,
          };
        }
        return t;
      });
      setLocalTexts(updated);
      const count = updated.filter((u, i) => {
        const o = texts[i];
        return o && (u.uz_text !== o.uz_text || u.original_text !== o.original_text);
      }).length;
      toast.success(`${count} ta o'zgarish aniqlandi`);
    } catch {
      toast.error("Clipboard'dan JSON o'qishda xatolik");
    }
  };

  // Send only changed texts to backend
  const handleUpdate = async () => {
    const changes = localTexts.filter((local, i) => {
      const orig = texts[i];
      return orig && (local.uz_text !== orig.uz_text || local.original_text !== orig.original_text);
    });

    if (changes.length === 0) {
      toast.info("O'zgarmagan");
      return;
    }

    setUpdating(true);
    try {
      await Promise.all(
        changes.map((item) =>
          api.updateRegion(manga, chapter, item.pageIdx, item.regionIdx, {
            original_text: item.original_text,
            uz_text: item.uz_text,
          })
        )
      );

      onDataUpdate((prev: any) => {
        if (!prev) return prev;
        const newPages = [...prev.pages];
        for (const item of changes) {
          const page = { ...newPages[item.pageIdx] };
          const newRegions = [...page.regions];
          newRegions[item.regionIdx] = {
            ...newRegions[item.regionIdx],
            original_text: item.original_text,
            uz_text: item.uz_text,
          };
          page.regions = newRegions;
          newPages[item.pageIdx] = page;
        }
        return { ...prev, pages: newPages };
      });

      toast.success(`${changes.length} ta region yangilandi`);
    } catch (e) {
      const err = e as Error;
      toast.error(`Xatolik: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleLocalChange = (idx: number, field: "uz_text" | "original_text", value: string) => {
    setLocalTexts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-3 h-[calc(100vh-48px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Tarjima matnlari</span>
          {isDirty && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-400">
              {changedCount} o'zgarish
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-1.5 h-7 text-xs"
            title="Barcha matnlarni JSON nusxalash"
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            className="gap-1.5 h-7 text-xs"
            title="JSON paste qilish"
          >
            <ClipboardPaste className="h-3 w-3" />
            Paste
          </Button>
          {isDirty && (
            <Button
              variant="default"
              size="sm"
              onClick={handleUpdate}
              disabled={updating}
              className="gap-1.5 h-7 text-xs"
            >
              {updating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Update ({changedCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 h-7 text-xs">
            <ChevronLeft className="h-3 w-3" />
            Orqaga
          </Button>
        </div>
      </div>

      {/* Texts list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {localTexts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Matn topilmadi.</div>
        ) : (
          localTexts.map((t, idx) => {
            const orig = texts[idx];
            const uzChanged = orig && t.uz_text !== orig.uz_text;
            const origChanged = orig && t.original_text !== orig.original_text;
            const isChanged = uzChanged || origChanged;

            return (
              <div
                key={`${t.pageIdx}-${t.regionIdx}-${idx}`}
                className={`rounded-lg border p-3 transition-all ${
                  isChanged
                    ? "border-amber-500/60 bg-amber-500/[0.03]"
                    : "border-border bg-card"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    S{t.pageIdx + 1} · R{t.regionIdx + 1}
                  </span>
                  {isChanged && (
                    <span className="text-[10px] font-medium text-amber-400">O'ZGARGAN</span>
                  )}
                </div>

                {/* Original text */}
                <div className="mb-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5 block">
                    Original
                  </label>
                  {origChanged ? (
                    <DiffDisplay oldText={orig.original_text} newText={t.original_text} />
                  ) : (
                    <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {t.original_text}
                    </div>
                  )}
                </div>

                {/* Translation input */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5 block">
                    Tarjima
                  </label>
                  <textarea
                    className={`w-full rounded-md border px-2.5 py-1.5 text-xs leading-relaxed bg-background resize-none transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                      uzChanged
                        ? "border-amber-500/50"
                        : "border-border"
                    }`}
                    rows={Math.max(1, Math.ceil(t.uz_text.length / 60))}
                    value={t.uz_text}
                    onChange={(e) => handleLocalChange(idx, "uz_text", e.target.value)}
                    placeholder="Tarjima yo'q..."
                  />
                  {/* Git-style diff for translation */}
                  {uzChanged && (
                    <DiffDisplay oldText={orig.uz_text} newText={t.uz_text} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Git-style inline diff display: red for removed, green for added */
function DiffDisplay({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = useMemo(() => diffWords(oldText, newText), [oldText, newText]);

  return (
    <div className="mt-1 rounded border border-border/50 bg-background/50 px-2 py-1.5 text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === "removed") {
          return (
            <span
              key={i}
              className="bg-red-500/20 text-red-400 line-through decoration-red-400/60"
            >
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
