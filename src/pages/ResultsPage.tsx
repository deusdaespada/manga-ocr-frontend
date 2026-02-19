import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  X,
  Languages,
  BookOpen,
  Save,
} from "lucide-react";

import { api } from "../lib/api";
import type { Page, Region, ResultsData } from "../lib/types";
import { Button } from "../components/ui/button";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      let chunk = "";
      for (const ch of word) {
        const chunkTest = chunk + ch;
        if (ctx.measureText(chunkTest).width <= maxWidth) {
          chunk = chunkTest;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawTranslatedTexts(ctx: CanvasRenderingContext2D, regions: Region[]) {
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  regions.forEach((r) => {
    if (!r.uz_text) return;
    const text = r.uz_text.toUpperCase().trim();
    if (!text) return;

    const padding = 6;
    const boxWidth = Math.max(10, r.bbox.w);
    const boxHeight = Math.max(10, r.bbox.h);
    const maxWidth = Math.max(10, boxWidth - padding * 2);
    const maxHeight = Math.max(10, boxHeight - padding * 2);

    let fontSize = Math.floor(Math.min(32, Math.max(12, boxHeight * 0.55)));
    ctx.font = `700 ${fontSize}px 'Comic Neue'`;
    let lines = wrapText(ctx, text, maxWidth);
    let lineHeight = Math.floor(fontSize * 1.2);

    while (fontSize > 10 && lines.length * lineHeight > maxHeight) {
      fontSize -= 1;
      lineHeight = Math.floor(fontSize * 1.2);
      ctx.font = `700 ${fontSize}px 'Comic Neue'`;
      lines = wrapText(ctx, text, maxWidth);
    }

    const totalTextHeight = lines.length * lineHeight;
    const startY = r.bbox.y + padding + Math.max(0, (maxHeight - totalTextHeight) / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.bbox.x, r.bbox.y, boxWidth, boxHeight);
    ctx.clip();
    ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
    lines.forEach((line, idx) => {
      ctx.fillText(line, r.bbox.x + boxWidth / 2, startY + idx * lineHeight);
    });
    ctx.restore();
  });
}

function collectTexts(pages: Page[]) {
  const texts: { pageIdx: number; regionIdx: number; original_text: string; uz_text: string }[] = [];
  pages.forEach((page, pageIdx) => {
    (page.regions || []).forEach((r, regionIdx) => {
      if (r.original_text && r.original_text.trim()) {
        texts.push({ pageIdx, regionIdx, original_text: r.original_text, uz_text: r.uz_text || "" });
      }
    });
  });
  return texts;
}

function formatCost(data: ResultsData): string | null {
  const parts: string[] = [];
  if (data.ocr_usage?.estimated_cost_usd) {
    parts.push(`OCR $${data.ocr_usage.estimated_cost_usd.toFixed(4)}`);
  }
  if (data.translator_usage?.estimated_cost_usd) {
    parts.push(`Tarjima $${data.translator_usage.estimated_cost_usd.toFixed(4)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function ResultsPage() {
  const { manga, chapter } = useParams();
  const [data, setData] = useState<ResultsData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [drawingMode, setDrawingMode] = useState(false);
  const [status, setStatus] = useState<string>("Yuklanmoqda...");
  const [readingOpen, setReadingOpen] = useState(false);
  const [regionDrafts, setRegionDrafts] = useState<
    Record<string, { original: string; translation: string; status?: string }>
  >({});
  const [translating, setTranslating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [confirmTranslate, setConfirmTranslate] = useState(false);

  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanImgRef = useRef<HTMLImageElement | null>(null);
  const cleanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalWrapRef = useRef<HTMLDivElement | null>(null);
  const cleanWrapRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<"original" | "clean" | null>(null);
  const syncTimeoutRef = useRef<number>(0);
  const readingCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!manga || !chapter) return;
    api
      .getResults(manga, chapter)
      .then((res) => {
        setData(res);
        setStatus("");
        const drafts: Record<string, { original: string; translation: string }> = {};
        const page = res.pages[currentPage];
        if (page) {
          page.regions.forEach((r, idx) => {
            drafts[`${currentPage}-${idx}`] = {
              original: r.original_text || "",
              translation: r.uz_text || "",
            };
          });
        }
        setRegionDrafts(drafts);
      })
      .catch((err) => setStatus(`Xatolik: ${err.message}`));
  }, [manga, chapter]);

  const pages = data?.pages || [];
  const totalPages = pages.length + 1;
  const texts = useMemo(() => collectTexts(pages), [pages]);
  const costText = data ? formatCost(data) : null;

  const renderBboxes = useCallback(
    (img: HTMLImageElement, canvas: HTMLCanvasElement, regions: Region[]) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = `${img.clientWidth}px`;
      canvas.style.height = `${img.clientHeight}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      regions.forEach((r) => {
        ctx.strokeStyle = "rgba(62, 207, 142, 0.7)";
        ctx.lineWidth = 3;
        ctx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.w, r.bbox.h);
      });
    },
    []
  );

  const renderTextOverlay = useCallback(
    (img: HTMLImageElement, canvas: HTMLCanvasElement, regions: Region[]) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = `${img.clientWidth}px`;
      canvas.style.height = `${img.clientHeight}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTranslatedTexts(ctx, regions);
    },
    []
  );

  useEffect(() => {
    if (!data) return;
    const page = pages[currentPage];
    if (!page) return;
    const img = originalImgRef.current;
    const canvas = originalCanvasRef.current;
    if (img && canvas) {
      const handler = () => renderBboxes(img, canvas, page.regions || []);
      if (img.complete && img.naturalWidth > 0) handler();
      else img.onload = handler;
    }
    const cleanImg = cleanImgRef.current;
    const cleanCanvas = cleanCanvasRef.current;
    if (cleanImg && cleanCanvas) {
      const handler = () => renderTextOverlay(cleanImg, cleanCanvas, page.regions || []);
      if (cleanImg.complete && cleanImg.naturalWidth > 0) handler();
      else cleanImg.onload = handler;
    }
  }, [data, currentPage, pages, renderBboxes, renderTextOverlay]);

  useEffect(() => {
    if (!data) return;
    const drafts: Record<string, { original: string; translation: string }> = {};
    const page = data.pages[currentPage];
    if (page) {
      page.regions.forEach((r, idx) => {
        drafts[`${currentPage}-${idx}`] = {
          original: r.original_text || "",
          translation: r.uz_text || "",
        };
      });
    }
    setRegionDrafts(drafts);
    setConfirmingDelete(null);
  }, [data, currentPage]);

  useEffect(() => {
    if (!drawingMode) return;
    const cleanImg = cleanImgRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!cleanImg || !drawCanvas) return;
    const canvas = drawCanvas;
    canvas.width = cleanImg.naturalWidth;
    canvas.height = cleanImg.naturalHeight;
    canvas.style.width = `${cleanImg.clientWidth}px`;
    canvas.style.height = `${cleanImg.clientHeight}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let startX = 0;
    let startY = 0;
    let isDrawing = false;

    function getCoords(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    function onDown(e: MouseEvent) {
      e.preventDefault();
      const coords = getCoords(e);
      startX = coords.x;
      startY = coords.y;
      isDrawing = true;
    }

    function onMove(e: MouseEvent) {
      if (!isDrawing) return;
      const drawCtx = canvas.getContext("2d");
      if (!drawCtx) return;
      const coords = getCoords(e);
      drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      const x = Math.min(startX, coords.x);
      const y = Math.min(startY, coords.y);
      const w = Math.abs(coords.x - startX);
      const h = Math.abs(coords.y - startY);
      drawCtx.strokeStyle = "rgba(62, 207, 142, 0.8)";
      drawCtx.lineWidth = 3;
      drawCtx.setLineDash([8, 4]);
      drawCtx.strokeRect(x, y, w, h);
      drawCtx.fillStyle = "rgba(62, 207, 142, 0.1)";
      drawCtx.fillRect(x, y, w, h);
      drawCtx.setLineDash([]);
    }

    async function onUp(e: MouseEvent) {
      if (!isDrawing) return;
      isDrawing = false;
      const coords = getCoords(e);
      const x = Math.round(Math.min(startX, coords.x));
      const y = Math.round(Math.min(startY, coords.y));
      const w = Math.round(Math.abs(coords.x - startX));
      const h = Math.round(Math.abs(coords.y - startY));
      const drawCtx = canvas.getContext("2d");
      if (drawCtx) drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      if (w < 10 || h < 10) return;
      if (!manga || !chapter) return;
      await api.addRegion(manga, chapter, currentPage, {
        bbox: { x, y, w, h },
        original_text: "",
        uz_text: "",
      });
      const updated = await api.getResults(manga, chapter);
      setData(updated);
      setDrawingMode(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawingMode(false);
    }

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [drawingMode, manga, chapter, currentPage]);

  /* ── Scroll sync (percentage-based, robust) ── */
  useEffect(() => {
    const originalWrap = originalWrapRef.current;
    const cleanWrap = cleanWrapRef.current;
    if (!originalWrap || !cleanWrap) return;

    const syncScroll = (
      source: HTMLDivElement,
      target: HTMLDivElement,
      tag: "original" | "clean"
    ) => {
      if (syncingRef.current && syncingRef.current !== tag) return;
      syncingRef.current = tag;

      const sourceMax = source.scrollHeight - source.clientHeight;
      const targetMax = target.scrollHeight - target.clientHeight;

      if (sourceMax > 0 && targetMax > 0) {
        const ratio = source.scrollTop / sourceMax;
        target.scrollTop = Math.round(ratio * targetMax);
      } else {
        target.scrollTop = source.scrollTop;
      }
      target.scrollLeft = source.scrollLeft;

      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
        syncingRef.current = null;
      }, 30);
    };

    const onOriginal = () => syncScroll(originalWrap, cleanWrap, "original");
    const onClean = () => syncScroll(cleanWrap, originalWrap, "clean");

    originalWrap.addEventListener("scroll", onOriginal, { passive: true });
    cleanWrap.addEventListener("scroll", onClean, { passive: true });

    return () => {
      originalWrap.removeEventListener("scroll", onOriginal);
      cleanWrap.removeEventListener("scroll", onClean);
      clearTimeout(syncTimeoutRef.current);
    };
  }, [currentPage]);

  useEffect(() => {
    const originalWrap = originalWrapRef.current;
    const cleanWrap = cleanWrapRef.current;
    if (!originalWrap || !cleanWrap) return;
    originalWrap.scrollTop = 0;
    originalWrap.scrollLeft = 0;
    cleanWrap.scrollTop = 0;
    cleanWrap.scrollLeft = 0;
  }, [currentPage, data]);

  useEffect(() => {
    if (!readingOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReadingOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [readingOpen]);

  useEffect(() => {
    if (!readingOpen) return;
    const readingPages = pages.filter((p) => p.cleaned_image_url);
    readingPages.forEach((page, idx) => {
      const canvas = readingCanvasRefs.current[idx];
      if (!canvas || !page.cleaned_image_url) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        drawTranslatedTexts(ctx, page.regions || []);
      };
      img.src = page.cleaned_image_url;
    });
  }, [readingOpen, pages]);

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">{status}</div>;
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
        <p className="text-sm text-muted-foreground">Natijalar topilmadi</p>
      </div>
    );
  }

  /* Translation text view (last virtual page) */
  if (currentPage === pages.length) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tarjima matnlari</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(pages.length - 1)} className="gap-1.5">
            <ChevronLeft className="h-3.5 w-3.5" />
            Orqaga
          </Button>
        </div>
        <div className="space-y-2">
          {texts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Matn topilmadi.</div>
          ) : (
            texts.map((t, idx) => (
              <div key={`${t.pageIdx}-${t.regionIdx}-${idx}`} className="rounded-lg border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">Sahifa {t.pageIdx + 1}</div>
                <div className="mt-1 text-sm">{t.original_text}</div>
                <div className="mt-1.5 text-sm text-muted-foreground">
                  {t.uz_text ? t.uz_text.toUpperCase() : "— Tarjima yo'q"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const page = pages[currentPage];
  const regions = page.regions || [];

  return (
    <div className="animate-fade-in flex h-[calc(100vh-48px)] flex-col gap-3">
      {/* Compact toolbar — all actions in one row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Back */}
        <Link
          to={`/project/${manga}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{manga}/{chapter}</span>
        </Link>

        <div className="h-4 w-px bg-border" />

        {/* Pagination */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[48px] text-center text-xs tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCurrentPage(Math.min(pages.length, currentPage + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Translate action */}
        {confirmTranslate ? (
          <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1">
            <span className="text-[11px] text-muted-foreground">
              {data?.translated ? "Qayta tarjima?" : "Tarjima?"}
            </span>
            <button
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
              onClick={async () => {
                if (!manga || !chapter) return;
                setConfirmTranslate(false);
                setTranslating(true);
                try {
                  const res = await api.translateChapter({ manga, chapter, backend: "openai" });
                  if (res.job_id) {
                    window.location.hash = `#/jobs/${res.job_id}`;
                  } else {
                    const updated = await api.getResults(manga, chapter);
                    setData(updated);
                  }
                } catch (e) {
                  const err = e as Error;
                  setRegionDrafts((prev) => ({ ...prev, __error: { original: "", translation: "", status: err.message } }));
                } finally {
                  setTranslating(false);
                }
              }}
            >
              Ha
            </button>
            <button
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent"
              onClick={() => setConfirmTranslate(false)}
            >
              Yo'q
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant={data?.translated ? "outline" : "default"}
            className={`h-7 gap-1 text-xs ${data?.translated ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" : ""}`}
            disabled={translating}
            onClick={() => setConfirmTranslate(true)}
          >
            <Languages className="h-3 w-3" />
            {translating ? "..." : data?.translated ? "Qayta tarjima" : "Tarjima"}
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCurrentPage(pages.length)}>
          Matnlar
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setReadingOpen(true)}>
          <BookOpen className="h-3 w-3" />
          O'qish
        </Button>
        <Link to={`/edit/${manga}/${chapter}`}>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Pencil className="h-3 w-3" />
            Tahrir
          </Button>
        </Link>
        <Button
          variant={drawingMode ? "destructive" : "outline"}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setDrawingMode((prev) => !prev)}
        >
          {drawingMode ? (
            <><X className="h-3 w-3" />Bekor</>
          ) : (
            <><Plus className="h-3 w-3" />Region</>
          )}
        </Button>

        {/* Cost — right side */}
        {costText && (
          <>
            <div className="flex-1" />
            <span className="mono text-[11px] text-muted-foreground">{costText}</span>
          </>
        )}
      </div>

      {/* Three-column layout — fills remaining height */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_1fr_280px]">
        {/* Original image */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Original</div>
          <div
            ref={originalWrapRef}
            className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-card"
          >
            <img ref={originalImgRef} src={page.image_url} alt="Original" className="block w-full" />
            <canvas ref={originalCanvasRef} className="pointer-events-none absolute inset-0" />
          </div>
        </div>

        {/* Cleaned image */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tarjima</div>
          <div
            ref={cleanWrapRef}
            className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-card"
          >
            <img ref={cleanImgRef} src={page.cleaned_image_url} alt="Cleaned" className="block w-full" />
            <canvas ref={cleanCanvasRef} className="pointer-events-none absolute inset-0" />
            {drawingMode && (
              <>
                <canvas ref={drawCanvasRef} className="absolute inset-0 cursor-crosshair" />
                <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                  Matn joyini belgilang · Esc - bekor
                </div>
              </>
            )}
          </div>
        </div>

        {/* Text regions panel */}
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
                const isDirty =
                  draft.original !== (r.original_text || "") ||
                  draft.translation !== (r.uz_text || "");
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
                              if (!manga || !chapter) return;
                              setConfirmingDelete(null);
                              await api.deleteRegion(manga, chapter, currentPage, i);
                              const updated = await api.getResults(manga, chapter);
                              setData(updated);
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
                      {/* Save — only visible when dirty */}
                      {(isDirty || draft.status) && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {isDirty && (
                            <button
                              className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/25"
                              onClick={async () => {
                                if (!manga || !chapter) return;
                                setRegionDrafts((prev) => ({
                                  ...prev,
                                  [key]: { ...draft, status: "..." },
                                }));
                                try {
                                  await api.updateRegion(manga, chapter, currentPage, i, {
                                    original_text: draft.original,
                                    uz_text: draft.translation,
                                  });
                                  // Update the base data so isDirty resets
                                  const updated = await api.getResults(manga!, chapter!);
                                  setData(updated);
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
      </div>

      {/* Reading mode overlay */}
      {readingOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b bg-card px-6 py-3">
            <span className="text-sm font-medium">To'liq o'qish</span>
            <Button variant="ghost" size="sm" onClick={() => setReadingOpen(false)} className="gap-1.5">
              <X className="h-4 w-4" />
              Yopish
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
              {pages
                .filter((p) => p.cleaned_image_url)
                .map((_p, idx) => (
                  <div key={`reading-${idx}`} className="overflow-hidden rounded-lg border bg-card">
                    <canvas
                      ref={(el) => {
                        readingCanvasRefs.current[idx] = el;
                      }}
                      className="h-auto w-full"
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
