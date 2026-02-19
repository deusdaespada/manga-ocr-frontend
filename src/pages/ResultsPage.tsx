import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../lib/api";
import { drawTranslatedTexts } from "../lib/canvas";
import type { Page, Region, ResultsData } from "../lib/types";
import ResultsToolbar from "../components/results/ResultsToolbar";
import ImagePanel from "../components/results/ImagePanel";
import RegionPanel from "../components/results/RegionPanel";
import type { RegionDraft } from "../components/results/RegionPanel";
import TranslationTextsView from "../components/results/TranslationTextsView";
import ReadingOverlay from "../components/results/ReadingOverlay";

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

export default function ResultsPage() {
  const { manga, chapter } = useParams();
  const [data, setData] = useState<ResultsData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [drawingMode, setDrawingMode] = useState(false);
  const [status, setStatus] = useState<string>("Yuklanmoqda...");
  const [readingOpen, setReadingOpen] = useState(false);
  const [regionDrafts, setRegionDrafts] = useState<Record<string, RegionDraft>>({});
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

  useEffect(() => {
    if (!manga || !chapter) return;
    api
      .getResults(manga, chapter)
      .then((res) => {
        setData(res);
        setStatus("");
        const drafts: Record<string, RegionDraft> = {};
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
    const drafts: Record<string, RegionDraft> = {};
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

  /* ── Drawing mode ── */
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

  /* ── Scroll sync ── */
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

  const handleTranslateConfirm = useCallback(async () => {
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
  }, [manga, chapter]);

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
      <TranslationTextsView
        texts={texts}
        onBack={() => setCurrentPage(pages.length - 1)}
      />
    );
  }

  const page = pages[currentPage];
  const regions = page.regions || [];

  return (
    <div className="animate-fade-in flex h-[calc(100vh-48px)] flex-col gap-3">
      <ResultsToolbar
        manga={manga!}
        chapter={chapter!}
        data={data}
        currentPage={currentPage}
        totalPages={totalPages}
        translating={translating}
        drawingMode={drawingMode}
        confirmTranslate={confirmTranslate}
        setCurrentPage={setCurrentPage}
        setTranslating={setTranslating}
        setDrawingMode={setDrawingMode}
        setConfirmTranslate={setConfirmTranslate}
        setReadingOpen={setReadingOpen}
        onTranslateConfirm={handleTranslateConfirm}
        pagesCount={pages.length}
      />

      {/* Three-column layout */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_1fr_280px]">
        <ImagePanel
          label="Original"
          imgRef={originalImgRef}
          canvasRef={originalCanvasRef}
          wrapRef={originalWrapRef}
          imgSrc={page.image_url}
          imgAlt="Original"
        />

        <ImagePanel
          label="Tarjima"
          imgRef={cleanImgRef}
          canvasRef={cleanCanvasRef}
          wrapRef={cleanWrapRef}
          imgSrc={page.cleaned_image_url}
          imgAlt="Cleaned"
        >
          {drawingMode && (
            <>
              <canvas ref={drawCanvasRef} className="absolute inset-0 cursor-crosshair" />
              <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                Matn joyini belgilang · Esc - bekor
              </div>
            </>
          )}
        </ImagePanel>

        <RegionPanel
          regions={regions}
          currentPage={currentPage}
          regionDrafts={regionDrafts}
          setRegionDrafts={setRegionDrafts}
          confirmingDelete={confirmingDelete}
          setConfirmingDelete={setConfirmingDelete}
          manga={manga!}
          chapter={chapter!}
          onDataUpdate={setData}
        />
      </div>

      <ReadingOverlay pages={pages} open={readingOpen} onClose={() => setReadingOpen(false)} />
    </div>
  );
}
