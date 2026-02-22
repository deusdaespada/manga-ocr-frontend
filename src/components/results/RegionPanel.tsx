import { useState } from "react";
import { X, Save, Minus, Plus, RotateCcw, RotateCw, Languages, Eye } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";
import type { Region, ResultsData } from "../../lib/types";
import { getFontsByCategory, getFontEntry } from "../../lib/fonts";

export type RegionDraft = {
  original: string;
  translation: string;
  fontSize?: number;
  rotation?: number;
  fontWeight?: string;
  fontStyle?: string;
  fontColor?: string;
  fontFamily?: string;
  status?: string;
};

interface RegionPanelProps {
  regions: Region[];
  currentPage: number;
  regionDrafts: Record<string, RegionDraft>;
  setRegionDrafts: React.Dispatch<React.SetStateAction<Record<string, RegionDraft>>>;
  confirmingDelete: string | null;
  setConfirmingDelete: (v: string | null) => void;
  manga: string;
  chapter: string;
  onDataUpdate: (data: ResultsData) => void;
}

const fontsByCategory = getFontsByCategory();

export default function RegionPanel({
  regions,
  currentPage,
  regionDrafts,
  setRegionDrafts,
  confirmingDelete,
  setConfirmingDelete,
  manga,
  chapter,
  onDataUpdate,
}: RegionPanelProps) {
  const [retranslatingPage, setRetranslatingPage] = useState(false);
  const [retranslatingRegion, setRetranslatingRegion] = useState<number | null>(null);
  const [reocrPage, setReocrPage] = useState(false);
  const [reocrRegionIdx, setReocrRegionIdx] = useState<number | null>(null);

  const handleReocrPage = async () => {
    setReocrPage(true);
    try {
      await api.reocrPage(manga, chapter, currentPage);
      const updated = await api.getResults(manga, chapter);
      setRegionDrafts({});
      onDataUpdate(updated);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setReocrPage(false);
    }
  };

  const handleReocrRegion = async (regionIdx: number) => {
    setReocrRegionIdx(regionIdx);
    try {
      await api.reocrRegion(manga, chapter, currentPage, regionIdx);
      const updated = await api.getResults(manga, chapter);
      const key = `${currentPage}-${regionIdx}`;
      setRegionDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      onDataUpdate(updated);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setReocrRegionIdx(null);
    }
  };

  const handleRetranslatePage = async () => {
    setRetranslatingPage(true);
    try {
      const pageRegions = regions
        .map((r, i) => ({ page_idx: currentPage, region_idx: i, has_text: !!r.original_text?.trim() }))
        .filter((r) => r.has_text);
      if (pageRegions.length === 0) return;
      await api.retranslateRegions(manga, chapter, {
        regions: pageRegions.map(({ page_idx, region_idx }) => ({ page_idx, region_idx })),
      });
      const updated = await api.getResults(manga, chapter);
      setRegionDrafts({});
      onDataUpdate(updated);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setRetranslatingPage(false);
    }
  };

  const handleRetranslateRegion = async (regionIdx: number) => {
    setRetranslatingRegion(regionIdx);
    try {
      await api.retranslateRegions(manga, chapter, {
        regions: [{ page_idx: currentPage, region_idx: regionIdx }],
      });
      const updated = await api.getResults(manga, chapter);
      const key = `${currentPage}-${regionIdx}`;
      setRegionDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      onDataUpdate(updated);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setRetranslatingRegion(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Matnlar ({regions.length})
        </div>
        {regions.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-500/10 disabled:opacity-50"
              disabled={reocrPage}
              onClick={handleReocrPage}
              title="Sahifadagi barcha regionlarni qayta OCR qilish"
            >
              <Eye className="h-2.5 w-2.5" />
              {reocrPage ? "..." : "OCR"}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              disabled={retranslatingPage}
              onClick={handleRetranslatePage}
              title="Sahifadagi barcha matnlarni qayta tarjima qilish"
            >
              <Languages className="h-2.5 w-2.5" />
              {retranslatingPage ? "..." : "Tarjima"}
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {regions.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-4 text-center text-xs text-muted-foreground">
            Matn topilmadi
          </div>
        ) : (
          regions.map((r, i) => {
            const key = `${currentPage}-${i}`;
            const draft = regionDrafts[key] || { original: "", translation: "" };
            const serverFontSize = r.font_size || 0;
            const draftFontSize = draft.fontSize ?? serverFontSize;
            const serverRotation = r.rotation || 0;
            const draftRotation = draft.rotation ?? serverRotation;
            const serverFontWeight = r.font_weight || "bold";
            const draftFontWeight = draft.fontWeight ?? serverFontWeight;
            const serverFontStyle = r.font_style || "normal";
            const draftFontStyle = draft.fontStyle ?? serverFontStyle;
            const serverFontColor = r.font_color || "#111827";
            const draftFontColor = draft.fontColor ?? serverFontColor;
            const serverFontFamily = r.font_family || "Comic Neue";
            const draftFontFamily = draft.fontFamily ?? serverFontFamily;
            const fontInfo = getFontEntry(draftFontFamily);
            const isDirty =
              draft.original !== (r.original_text || "") ||
              draft.translation !== (r.uz_text || "") ||
              draftFontSize !== serverFontSize ||
              draftRotation !== serverRotation ||
              draftFontWeight !== serverFontWeight ||
              draftFontStyle !== serverFontStyle ||
              draftFontColor !== serverFontColor ||
              draftFontFamily !== serverFontFamily;
            return (
              <div key={key} className="group rounded-lg border bg-card">
                {/* Header: number + delete */}
                <div className="flex items-center justify-between px-2.5 pt-2">
                  <span className="text-[11px] font-medium text-muted-foreground">{i + 1}</span>
                  {confirmingDelete === key ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">O'chirish?</span>
                      <button
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/15"
                        onClick={async () => {
                          setConfirmingDelete(null);
                          await api.deleteRegion(manga, chapter, currentPage, i);
                          const updated = await api.getResults(manga, chapter);
                          onDataUpdate(updated);
                        }}
                      >
                        Ha
                      </button>
                      <button
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent"
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Yo'q
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="text-muted-foreground hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Qayta OCR"
                        disabled={reocrRegionIdx === i}
                        onClick={() => handleReocrRegion(i)}
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        className="text-muted-foreground hover:text-amber-400 transition-colors disabled:opacity-50"
                        title="Qayta tarjima"
                        disabled={retranslatingRegion === i}
                        onClick={() => handleRetranslateRegion(i)}
                      >
                        <Languages className="h-3 w-3" />
                      </button>
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => setConfirmingDelete(key)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                {/* Textareas */}
                <div className="space-y-1 px-2.5 pb-2.5 pt-1">
                  <textarea
                    placeholder="Original"
                    className="min-h-[28px] w-full resize-none rounded-md border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={draft.original}
                    onChange={(e) =>
                      setRegionDrafts((prev) => ({
                        ...prev,
                        [key]: { ...draft, original: e.target.value, status: undefined },
                      }))
                    }
                  />
                  <textarea
                    placeholder="Tarjima"
                    className="min-h-[28px] w-full resize-none rounded-md border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={draft.translation}
                    onChange={(e) =>
                      setRegionDrafts((prev) => ({
                        ...prev,
                        [key]: { ...draft, translation: e.target.value, status: undefined },
                      }))
                    }
                  />
                  {/* Font size + Rotation — bitta qatorda */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground w-4">Aa</span>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() =>
                        setRegionDrafts((prev) => {
                          const cur = prev[key]?.fontSize ?? draftFontSize;
                          const base = cur || Math.floor(Math.min(32, Math.max(12, r.bbox.h * 0.55)));
                          return { ...prev, [key]: { ...draft, fontSize: Math.max(6, base - 1), status: undefined } };
                        })
                      }
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[24px] text-center text-[10px] tabular-nums">
                      {draftFontSize || "auto"}
                    </span>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() =>
                        setRegionDrafts((prev) => {
                          const cur = prev[key]?.fontSize ?? draftFontSize;
                          const base = cur || Math.floor(Math.min(32, Math.max(12, r.bbox.h * 0.55)));
                          return { ...prev, [key]: { ...draft, fontSize: Math.min(120, base + 1), status: undefined } };
                        })
                      }
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                    {draftFontSize > 0 && (
                      <button
                        className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                        title="Auto"
                        onClick={() =>
                          setRegionDrafts((prev) => ({
                            ...prev,
                            [key]: { ...draft, fontSize: 0, status: undefined },
                          }))
                        }
                      >
                        <RotateCcw className="h-2 w-2" />
                      </button>
                    )}

                    <div className="mx-0.5 h-3 w-px bg-border" />

                    <RotateCw className="h-2.5 w-2.5 text-muted-foreground" />
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() =>
                        setRegionDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, rotation: draftRotation - 15, status: undefined },
                        }))
                      }
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[22px] text-center text-[10px] tabular-nums">
                      {draftRotation}°
                    </span>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() =>
                        setRegionDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, rotation: draftRotation + 15, status: undefined },
                        }))
                      }
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                    {draftRotation !== 0 && (
                      <button
                        className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                        title="0°"
                        onClick={() =>
                          setRegionDrafts((prev) => ({
                            ...prev,
                            [key]: { ...draft, rotation: 0, status: undefined },
                          }))
                        }
                      >
                        <RotateCcw className="h-2 w-2" />
                      </button>
                    )}
                  </div>
                  {/* Font formatting controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      className={`h-5 rounded border px-1.5 text-[10px] font-bold transition-colors ${draftFontWeight === "bold" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}
                      title={draftFontWeight === "bold" ? "Oddiy qilish" : "Qalin qilish"}
                      onClick={() =>
                        setRegionDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, fontWeight: draftFontWeight === "bold" ? "normal" : "bold", status: undefined },
                        }))
                      }
                    >
                      B
                    </button>
                    <button
                      className={`h-5 rounded border px-1.5 text-[10px] transition-colors ${draftFontStyle === "italic" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"} ${fontInfo && !fontInfo.hasItalic ? "opacity-40 cursor-not-allowed" : ""}`}
                      title={draftFontStyle === "italic" ? "Oddiy qilish" : "Kursiv qilish"}
                      style={{ fontStyle: "italic" }}
                      onClick={() => {
                        if (fontInfo && !fontInfo.hasItalic) return;
                        setRegionDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, fontStyle: draftFontStyle === "italic" ? "normal" : "italic", status: undefined },
                        }));
                      }}
                    >
                      I
                    </button>
                    <input
                      type="color"
                      className="h-5 w-5 cursor-pointer rounded border bg-background p-0"
                      value={draftFontColor}
                      onChange={(e) =>
                        setRegionDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, fontColor: e.target.value, status: undefined },
                        }))
                      }
                    />
                    <select
                      className="h-5 max-w-[120px] flex-1 rounded border bg-background px-1 text-[10px] text-foreground"
                      value={draftFontFamily}
                      onChange={(e) =>
                        setRegionDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, fontFamily: e.target.value, status: undefined },
                        }))
                      }
                    >
                      {Object.entries(fontsByCategory).map(([category, fonts]) => (
                        <optgroup key={category} label={category}>
                          {fonts.map((f) => (
                            <option key={f.family} value={f.family}>
                              {f.family}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {/* Save — only visible when dirty */}
                  {(isDirty || draft.status) && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {isDirty && (
                        <button
                          className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/25"
                          onClick={async () => {
                            setRegionDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, status: "..." },
                            }));
                            try {
                              const payload: Record<string, unknown> = {
                                original_text: draft.original,
                                uz_text: draft.translation,
                              };
                              if (draftFontSize !== serverFontSize) {
                                payload.font_size = draftFontSize || 0;
                              }
                              if (draftRotation !== serverRotation) {
                                payload.rotation = draftRotation;
                              }
                              if (draftFontWeight !== serverFontWeight) {
                                payload.font_weight = draftFontWeight;
                              }
                              if (draftFontStyle !== serverFontStyle) {
                                payload.font_style = draftFontStyle;
                              }
                              if (draftFontColor !== serverFontColor) {
                                payload.font_color = draftFontColor;
                              }
                              if (draftFontFamily !== serverFontFamily) {
                                payload.font_family = draftFontFamily;
                              }
                              await api.updateRegion(manga, chapter, currentPage, i, payload);
                              const updated = await api.getResults(manga, chapter);
                              onDataUpdate(updated);
                            } catch (e) {
                              const err = e as Error;
                              setRegionDrafts((prev) => ({
                                ...prev,
                                [key]: { ...draft, status: err.message },
                              }));
                            }
                          }}
                        >
                          <Save className="h-2.5 w-2.5" />
                          Saqlash
                        </button>
                      )}
                      {draft.status && (
                        <span className="text-[10px] text-muted-foreground">{draft.status}</span>
                      )}
                    </div>
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
