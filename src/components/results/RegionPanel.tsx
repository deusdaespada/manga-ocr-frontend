import { X, Save, Minus, Plus, RotateCcw } from "lucide-react";

import { api } from "../../lib/api";
import type { Region, ResultsData } from "../../lib/types";

export type RegionDraft = {
  original: string;
  translation: string;
  fontSize?: number;
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
  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Matnlar ({regions.length})
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
            const isDirty =
              draft.original !== (r.original_text || "") ||
              draft.translation !== (r.uz_text || "") ||
              draftFontSize !== serverFontSize;
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
                    <button
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmingDelete(key)}
                    >
                      <X className="h-3 w-3" />
                    </button>
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
                  {/* Font size control */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground w-6">Aa</span>
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
                    <span className="min-w-[28px] text-center text-[11px] tabular-nums">
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
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                        title="Auto"
                        onClick={() =>
                          setRegionDrafts((prev) => ({
                            ...prev,
                            [key]: { ...draft, fontSize: 0, status: undefined },
                          }))
                        }
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                      </button>
                    )}
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
