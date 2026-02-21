import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Save, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import type { ResultsData } from "../lib/types";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

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

export default function EditorPage() {
  const { manga, chapter } = useParams();
  const [data, setData] = useState<ResultsData | null>(null);
  const [status, setStatus] = useState("Yuklanmoqda...");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    if (!manga || !chapter) return;
    api
      .getResults(manga, chapter)
      .then((res) => {
        setData(res);
        setStatus("");
        setDrafts(buildDrafts(res));
      })
      .catch((err) => setStatus(`Xatolik: ${err.message}`));
  }, [manga, chapter]);

  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">{status}</div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
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
        <Link to={`/results/${manga}/${chapter}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Natijalar
          </Button>
        </Link>
      </div>

      {/* Pages */}
      <div className="space-y-4">
        {data.pages.map((page, pageIdx) => (
          <div key={`page-${pageIdx}`} className="rounded-lg border bg-card">
            <div className="border-b px-5 py-3">
              <span className="text-sm font-medium">Sahifa {pageIdx + 1}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {page.regions.length} region
              </span>
            </div>
            {page.regions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Bu sahifada matn regionlari topilmadi.
              </div>
            ) : (
              <div className="divide-y">
                {page.regions.map((region, regionIdx) => {
                  const key = `${pageIdx}-${regionIdx}`;
                  const draft = drafts[key] || { original: "", translation: "" };
                  return (
                    <div key={key} className="px-5 py-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Region {regionIdx + 1}
                          <span className="mono ml-2">
                            [{region.bbox.x}, {region.bbox.y}, {region.bbox.w}, {region.bbox.h}]
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={async () => {
                            if (!manga || !chapter) return;
                            if (!confirm("Bu regionni o'chirmoqchimisiz?")) return;
                            await api.deleteRegion(manga, chapter, pageIdx, regionIdx);
                            const updated = await api.getResults(manga, chapter);
                            setData(updated);
                            setDrafts(buildDrafts(updated));
                          }}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          O'chirish
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            OCR matn (original)
                          </label>
                          <Textarea
                            value={draft.original}
                            className="min-h-[80px] text-sm"
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [key]: { ...draft, original: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Tarjima (uz)
                          </label>
                          <Textarea
                            value={draft.translation}
                            className="min-h-[80px] text-sm"
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [key]: { ...draft, translation: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={async () => {
                            if (!manga || !chapter) return;
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, status: "Saqlanmoqda..." },
                            }));
                            try {
                              await api.updateRegion(manga, chapter, pageIdx, regionIdx, {
                                original_text: draft.original,
                                uz_text: draft.translation,
                              });
                              setDrafts((prev) => ({
                                ...prev,
                                [key]: { ...draft, status: "Saqlandi!" },
                              }));
                            } catch (e) {
                              const err = e as Error;
                              setDrafts((prev) => ({
                                ...prev,
                                [key]: { ...draft, status: `Xatolik: ${err.message}` },
                              }));
                            }
                          }}
                        >
                          <Save className="h-3.5 w-3.5" />
                          Saqlash
                        </Button>
                        {draft.status && (
                          <span className="text-xs text-muted-foreground">{draft.status}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
