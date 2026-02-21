import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "../lib/api";
import { drawTranslatedTexts } from "../lib/canvas";
import type { Page, ProjectSettings, Region, ResultsData } from "../lib/types";
import ResultsToolbar from "../components/results/ResultsToolbar";
import RunInfoPanel from "../components/results/RunInfoPanel";
import ImagePanel from "../components/results/ImagePanel";
import RegionPanel from "../components/results/RegionPanel";
import type { RegionDraft } from "../components/results/RegionPanel";
import TranslationTextsView from "../components/results/TranslationTextsView";
import ReadingOverlay from "../components/results/ReadingOverlay";
import RerunOcrModal from "../components/results/RerunOcrModal";

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

const DEFAULT_SETTINGS: ProjectSettings = {
  language: "ja",
  backend: "openai",
  ocr_backend: "auto",
  cleaner_backend: "pcleaner",
  translator_model: "",
  limit: 0,
};

export default function ResultsPage() {
  const { manga, chapter } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ResultsData | null>(null);
  const [currentPage, setCurrentPageRaw] = useState(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    return Number.isNaN(p) || p < 1 ? 0 : p - 1;
  });

  const setCurrentPage = useCallback(
    (page: number) => {
      setCurrentPageRaw(page);
      setSearchParams({ page: String(page + 1) }, { replace: true });
    },
    [setSearchParams],
  );
  const [drawingMode, setDrawingMode] = useState(false);
  const [cleanMode, setCleanMode] = useState(false);
  const [lineCleanMode, setLineCleanMode] = useState(false);
  const [bubbleMode, setBubbleMode] = useState<"rect" | "oval" | null>(null);
  const [pageHasClean, setPageHasClean] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [status, setStatus] = useState<string>("Yuklanmoqda...");
  const [readingOpen, setReadingOpen] = useState(false);
  const [regionDrafts, setRegionDrafts] = useState<Record<string, RegionDraft>>({});
  const [translating, setTranslating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [confirmTranslate, setConfirmTranslate] = useState(false);
  const [rerunModalOpen, setRerunModalOpen] = useState(false);
  const [rerunSettings, setRerunSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [rerunLoading, setRerunLoading] = useState(false);
  const [rerunSkipConfirm, setRerunSkipConfirm] = useState(false);
  const [rerunSkipClean, setRerunSkipClean] = useState(false);

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
              fontSize: r.font_size || 0,
              rotation: r.rotation || 0,
              fontWeight: r.font_weight || "bold",
              fontColor: r.font_color || "#111827",
              fontFamily: r.font_family || "Comic Neue",
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

  // regionDrafts dagi fontSize larni regions ga apply qilish
  const regionsWithDraftFontSize = useMemo(() => {
    if (!data) return [];
    const page = data.pages[currentPage];
    if (!page) return [];
    return (page.regions || []).map((r, idx) => {
      const draft = regionDrafts[`${currentPage}-${idx}`];
      if (!draft) return r;
      const patched = { ...r };
      if (draft.fontSize) patched.font_size = draft.fontSize;
      if (draft.rotation !== undefined) patched.rotation = draft.rotation;
      if (draft.fontWeight !== undefined) patched.font_weight = draft.fontWeight;
      if (draft.fontColor !== undefined) patched.font_color = draft.fontColor;
      if (draft.fontFamily !== undefined) patched.font_family = draft.fontFamily;
      return patched;
    });
  }, [data, currentPage, regionDrafts]);

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
      const handler = () => renderTextOverlay(cleanImg, cleanCanvas, regionsWithDraftFontSize);
      if (cleanImg.complete && cleanImg.naturalWidth > 0) handler();
      else cleanImg.onload = handler;
    }
  }, [data, currentPage, pages, regionsWithDraftFontSize, renderBboxes, renderTextOverlay]);

  useEffect(() => {
    if (!data) return;
    const page = data.pages[currentPage];
    if (!page) {
      setRegionDrafts({});
      setConfirmingDelete(null);
      return;
    }
    setRegionDrafts((prev) => {
      const next: Record<string, RegionDraft> = {};
      page.regions.forEach((r, idx) => {
        const key = `${currentPage}-${idx}`;
        const existing = prev[key];
        const serverOriginal = r.original_text || "";
        const serverTranslation = r.uz_text || "";
        const serverFontSize = r.font_size || 0;
        const serverRotation = r.rotation || 0;
        const serverFontWeight = r.font_weight || "bold";
        const serverFontColor = r.font_color || "#111827";
        const serverFontFamily = r.font_family || "Comic Neue";
        // Agar draft o'zgartirilgan bo'lsa — saqlab qolish
        if (
          existing &&
          (existing.original !== serverOriginal ||
            existing.translation !== serverTranslation ||
            (existing.fontSize ?? serverFontSize) !== serverFontSize ||
            (existing.rotation ?? serverRotation) !== serverRotation ||
            (existing.fontWeight ?? serverFontWeight) !== serverFontWeight ||
            (existing.fontColor ?? serverFontColor) !== serverFontColor ||
            (existing.fontFamily ?? serverFontFamily) !== serverFontFamily) &&
          !existing.status
        ) {
          next[key] = existing;
        } else {
          next[key] = {
            original: serverOriginal,
            translation: serverTranslation,
            fontSize: serverFontSize,
            rotation: serverRotation,
            fontWeight: serverFontWeight,
            fontColor: serverFontColor,
            fontFamily: serverFontFamily,
          };
        }
      });
      return next;
    });
    setConfirmingDelete(null);
    setPageHasClean(false);
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

  /* ── Line clean mode (rectangle inpaint) ── */
  useEffect(() => {
    if (!lineCleanMode) return;
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
      drawCtx.strokeStyle = "rgba(239, 68, 68, 0.8)";
      drawCtx.lineWidth = 3;
      drawCtx.setLineDash([8, 4]);
      drawCtx.strokeRect(x, y, w, h);
      drawCtx.fillStyle = "rgba(239, 68, 68, 0.1)";
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
      if (w < 5 || h < 5) return;
      if (!manga || !chapter) return;
      try {
        setStatus("Tozalanmoqda...");
        const res = await api.inpaintArea(manga, chapter, currentPage, { x, y, w, h });
        if (res.image_url) {
          setData((prev) => {
            if (!prev) return prev;
            const newPages = [...prev.pages];
            newPages[currentPage] = { ...newPages[currentPage], cleaned_image_url: res.image_url };
            return { ...prev, pages: newPages };
          });
          setPageHasClean(true);
        }
        setStatus("");
      } catch (err) {
        setStatus(`Tozalash xatolik: ${(err as Error).message}`);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLineCleanMode(false);
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
  }, [lineCleanMode, manga, chapter, currentPage]);

  /* ── Bubble mode (rect / oval white shape) ── */
  useEffect(() => {
    if (!bubbleMode) return;
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
    const shape = bubbleMode;

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
      // Oq to'ldirilgan shakl
      drawCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
      if (shape === "oval") {
        drawCtx.beginPath();
        drawCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        drawCtx.fill();
      } else {
        drawCtx.fillRect(x, y, w, h);
      }
      // Ko'k ramka
      drawCtx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      drawCtx.lineWidth = 2;
      drawCtx.setLineDash([6, 3]);
      if (shape === "oval") {
        drawCtx.beginPath();
        drawCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        drawCtx.stroke();
      } else {
        drawCtx.strokeRect(x, y, w, h);
      }
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
      if (w < 5 || h < 5) return;
      if (!manga || !chapter) return;
      try {
        setStatus("Chizilmoqda...");
        const res = await api.drawBubble(manga, chapter, currentPage, { x, y, w, h }, shape);
        if (res.image_url) {
          setData((prev) => {
            if (!prev) return prev;
            const newPages = [...prev.pages];
            newPages[currentPage] = { ...newPages[currentPage], cleaned_image_url: res.image_url };
            return { ...prev, pages: newPages };
          });
          setPageHasClean(true);
        }
        setStatus("");
      } catch (err) {
        setStatus(`Chizish xatolik: ${(err as Error).message}`);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setBubbleMode(null);
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
  }, [bubbleMode, manga, chapter, currentPage]);

  /* ── Clean (eraser brush) mode ── */
  useEffect(() => {
    if (!cleanMode) return;
    const cleanImg = cleanImgRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!cleanImg || !drawCanvas) return;
    const canvas = drawCanvas;
    canvas.width = cleanImg.naturalWidth;
    canvas.height = cleanImg.naturalHeight;
    canvas.style.width = `${cleanImg.clientWidth}px`;
    canvas.style.height = `${cleanImg.clientHeight}px`;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;

    // Mask canvas — faqat oq chiziqlar qora fonda (backend ga yuboriladigan)
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext("2d")!;
    maskCtx.fillStyle = "#000";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let hasPainted = false;

    function getCoords(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    function drawBrushStroke(fromX: number, fromY: number, toX: number, toY: number) {
      // Visible canvas — yarim-shaffof qizil
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Mask canvas — oq (inpaint sohasi)
      maskCtx.strokeStyle = "#fff";
      maskCtx.lineWidth = brushSize;
      maskCtx.lineCap = "round";
      maskCtx.lineJoin = "round";
      maskCtx.beginPath();
      maskCtx.moveTo(fromX, fromY);
      maskCtx.lineTo(toX, toY);
      maskCtx.stroke();
    }

    function onDown(e: MouseEvent) {
      e.preventDefault();
      isDrawing = true;
      const coords = getCoords(e);
      lastX = coords.x;
      lastY = coords.y;

      // Birinchi nuqta — doira chizish
      ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();

      maskCtx.fillStyle = "#fff";
      maskCtx.beginPath();
      maskCtx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      maskCtx.fill();

      hasPainted = true;
    }

    function onMove(e: MouseEvent) {
      // Brush cursor ko'rsatish (chizmasdan ham)
      if (!isDrawing) {
        const coords = getCoords(e);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Oldingi chizilgan narsalarni qayta chizish
        if (hasPainted) {
          ctx.globalAlpha = 1;
          // maskCanvas dan qizil overlay sifatida chizish
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.drawImage(maskCanvas, 0, 0);
          tempCtx.globalCompositeOperation = "source-in";
          tempCtx.fillStyle = "rgba(239, 68, 68, 0.5)";
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          ctx.drawImage(tempCanvas, 0, 0);
        }

        // Cursor doira
        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      const coords = getCoords(e);
      drawBrushStroke(lastX, lastY, coords.x, coords.y);
      lastX = coords.x;
      lastY = coords.y;
    }

    async function onUp() {
      if (!isDrawing) return;
      isDrawing = false;

      if (!hasPainted || !manga || !chapter) return;

      // Mask ni base64 PNG ga aylantirish
      const maskDataUrl = maskCanvas.toDataURL("image/png");
      const maskBase64 = maskDataUrl.split(",")[1];

      // Canvas ni tozalash
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        setStatus("Tozalanmoqda...");
        const res = await api.inpaintMask(manga, chapter, currentPage, maskBase64);
        if (res.image_url) {
          setData((prev) => {
            if (!prev) return prev;
            const newPages = [...prev.pages];
            newPages[currentPage] = { ...newPages[currentPage], cleaned_image_url: res.image_url };
            return { ...prev, pages: newPages };
          });
          setPageHasClean(true);
        }
        setStatus("");
      } catch (err) {
        setStatus(`Tozalash xatolik: ${(err as Error).message}`);
      }

      // Mask ni tozalash — yangi chizish uchun
      hasPainted = false;
      maskCtx.fillStyle = "#000";
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCleanMode(false);
    }

    // Mouse canvas dan chiqib ketsa ham inpaint qilish
    function onLeave() {
      if (isDrawing) {
        onUp();
      }
    }

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onLeave);
    document.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("keydown", onKey);
    };
  }, [cleanMode, manga, chapter, currentPage, brushSize]);

  /* ── Resize mode (default — no special mode active) ── */
  useEffect(() => {
    if (drawingMode || cleanMode || lineCleanMode || bubbleMode) return;
    const cleanImg = cleanImgRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!cleanImg || !drawCanvas) return;
    const canvas = drawCanvas;

    function syncSize() {
      canvas.width = cleanImg!.naturalWidth;
      canvas.height = cleanImg!.naturalHeight;
      canvas.style.width = `${cleanImg!.clientWidth}px`;
      canvas.style.height = `${cleanImg!.clientHeight}px`;
    }
    if (cleanImg.complete && cleanImg.naturalWidth > 0) syncSize();
    cleanImg.addEventListener("load", syncSize);

    const THRESHOLD = 10;
    let hoveredIdx = -1;
    let hoveredEdge = "";
    let isDragging = false;
    let startMouse = { x: 0, y: 0 };
    let origBbox = { x: 0, y: 0, w: 0, h: 0 };
    let curBbox = { x: 0, y: 0, w: 0, h: 0 };
    // Rotation handle state
    let isRotating = false;
    let rotatingIdx = -1;
    let startAngle = 0;
    let curRotation = 0;
    let origRotation = 0;
    const HANDLE_OFFSET = 25;

    function getCoords(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    }

    function scaledThreshold() {
      const rect = canvas.getBoundingClientRect();
      return rect.width > 0 ? THRESHOLD * (canvas.width / rect.width) : THRESHOLD;
    }

    function hitTest(mx: number, my: number) {
      const regs = pages[currentPage]?.regions || [];
      const t = scaledThreshold();
      for (let i = regs.length - 1; i >= 0; i--) {
        const { x, y, w, h } = regs[i].bbox;
        const r = x + w, b = y + h;
        const near = (px: number, py: number) => Math.abs(mx - px) < t && Math.abs(my - py) < t;
        // Rotation handle — circle above top-center
        if (near(x + w / 2, y - HANDLE_OFFSET)) return { idx: i, edge: "rotate" };
        if (near(x, y)) return { idx: i, edge: "nw" };
        if (near(r, y)) return { idx: i, edge: "ne" };
        if (near(x, b)) return { idx: i, edge: "sw" };
        if (near(r, b)) return { idx: i, edge: "se" };
        const onX = mx >= x - t && mx <= r + t;
        const onY = my >= y - t && my <= b + t;
        if (onX && Math.abs(my - y) < t) return { idx: i, edge: "n" };
        if (onX && Math.abs(my - b) < t) return { idx: i, edge: "s" };
        if (onY && Math.abs(mx - x) < t) return { idx: i, edge: "w" };
        if (onY && Math.abs(mx - r) < t) return { idx: i, edge: "e" };
      }
      return null;
    }

    function edgeCursor(edge: string) {
      if (edge === "rotate") return "grab";
      if (edge === "n" || edge === "s") return "ns-resize";
      if (edge === "e" || edge === "w") return "ew-resize";
      if (edge === "nw" || edge === "se") return "nwse-resize";
      if (edge === "ne" || edge === "sw") return "nesw-resize";
      return "";
    }

    function drawOutline(bbox: typeof curBbox) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
      const hs = 6;
      for (const [hx, hy] of [
        [bbox.x, bbox.y], [bbox.x + bbox.w, bbox.y],
        [bbox.x, bbox.y + bbox.h], [bbox.x + bbox.w, bbox.y + bbox.h],
      ]) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }
      // Rotation handle — line + circle above top-center
      const rcx = bbox.x + bbox.w / 2;
      const rhy = bbox.y - HANDLE_OFFSET;
      ctx.beginPath();
      ctx.moveTo(rcx, bbox.y);
      ctx.lineTo(rcx, rhy);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rcx, rhy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
      ctx.fill();
    }

    function onMove(e: MouseEvent) {
      if (isRotating) {
        const coords = getCoords(e);
        const regs = pages[currentPage]?.regions || [];
        const bbox = regs[rotatingIdx].bbox;
        const cx = bbox.x + bbox.w / 2;
        const cy = bbox.y + bbox.h / 2;
        const angle = Math.atan2(coords.x - cx, -(coords.y - cy)) * 180 / Math.PI;
        curRotation = Math.round((origRotation + (angle - startAngle)) / 2) * 2;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(curRotation * Math.PI / 180);
          ctx.translate(-cx, -cy);
          ctx.strokeStyle = "rgba(168, 85, 247, 0.8)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
          ctx.setLineDash([]);
          ctx.restore();
          ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${curRotation}°`, cx, bbox.y - 40);
        }
        return;
      }
      if (isDragging) {
        const coords = getCoords(e);
        const dx = coords.x - startMouse.x;
        const dy = coords.y - startMouse.y;
        let { x, y, w, h } = { ...origBbox };
        if (hoveredEdge.includes("n")) { y += dy; h -= dy; }
        if (hoveredEdge.includes("s")) { h += dy; }
        if (hoveredEdge.includes("w")) { x += dx; w -= dx; }
        if (hoveredEdge.includes("e")) { w += dx; }
        if (w < 10) { if (hoveredEdge.includes("w")) x = origBbox.x + origBbox.w - 10; w = 10; }
        if (h < 10) { if (hoveredEdge.includes("n")) y = origBbox.y + origBbox.h - 10; h = 10; }
        curBbox = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
        drawOutline(curBbox);
        return;
      }
      const coords = getCoords(e);
      const hit = hitTest(coords.x, coords.y);
      if (hit) {
        hoveredIdx = hit.idx;
        hoveredEdge = hit.edge;
        canvas.style.cursor = edgeCursor(hit.edge);
        const regs = pages[currentPage]?.regions || [];
        drawOutline(regs[hit.idx].bbox);
      } else {
        hoveredIdx = -1;
        hoveredEdge = "";
        canvas.style.cursor = "";
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    function onDown(e: MouseEvent) {
      if (hoveredIdx < 0) return;
      e.preventDefault();
      if (hoveredEdge === "rotate") {
        isRotating = true;
        rotatingIdx = hoveredIdx;
        const coords = getCoords(e);
        const regs = pages[currentPage]?.regions || [];
        const bbox = regs[hoveredIdx].bbox;
        const cx = bbox.x + bbox.w / 2;
        const cy = bbox.y + bbox.h / 2;
        startAngle = Math.atan2(coords.x - cx, -(coords.y - cy)) * 180 / Math.PI;
        origRotation = regs[hoveredIdx].rotation || 0;
        curRotation = origRotation;
        canvas.style.cursor = "grabbing";
        return;
      }
      isDragging = true;
      startMouse = getCoords(e);
      const regs = pages[currentPage]?.regions || [];
      origBbox = { ...regs[hoveredIdx].bbox };
      curBbox = { ...origBbox };
    }

    async function onUp() {
      if (isRotating) {
        isRotating = false;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.cursor = "";
        if (curRotation === origRotation) return;
        const key = `${currentPage}-${rotatingIdx}`;
        setRegionDrafts((prev) => ({
          ...prev,
          [key]: { ...prev[key], rotation: curRotation, status: undefined },
        }));
        if (!manga || !chapter) return;
        try {
          await api.updateRegion(manga, chapter, currentPage, rotatingIdx, { rotation: curRotation });
          const updated = await api.getResults(manga, chapter);
          setData(updated);
        } catch (err) {
          setStatus(`Rotation xatolik: ${(err as Error).message}`);
        }
        return;
      }
      if (!isDragging) return;
      isDragging = false;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.cursor = "";
      if (
        curBbox.x === origBbox.x && curBbox.y === origBbox.y &&
        curBbox.w === origBbox.w && curBbox.h === origBbox.h
      ) return;
      if (!manga || !chapter) return;
      try {
        await api.updateRegion(manga, chapter, currentPage, hoveredIdx, { bbox: curBbox });
        const updated = await api.getResults(manga, chapter);
        setData(updated);
      } catch (err) {
        setStatus(`Resize xatolik: ${(err as Error).message}`);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isRotating) {
          isRotating = false;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.style.cursor = "";
        }
        if (isDragging) {
          isDragging = false;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.style.cursor = "";
        }
      }
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKey);
      cleanImg.removeEventListener("load", syncSize);
      canvas.style.cursor = "";
    };
  }, [drawingMode, cleanMode, lineCleanMode, bubbleMode, manga, chapter, currentPage, pages, setRegionDrafts]);

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
  }, [currentPage]);

  /* ── Keyboard navigation: ArrowLeft/ArrowRight = sahifa o'tish ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (drawingMode || cleanMode || lineCleanMode || bubbleMode) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPage(Math.max(0, currentPage - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPage(Math.min(pages.length, currentPage + 1));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [currentPage, pages.length, drawingMode, cleanMode, lineCleanMode, bubbleMode, setCurrentPage]);

  const handleUndoClean = useCallback(async () => {
    if (!manga || !chapter) return;
    try {
      setStatus("Qaytarilmoqda...");
      const res = await api.undoClean(manga, chapter, currentPage);
      if (res.image_url) {
        setData((prev) => {
          if (!prev) return prev;
          const newPages = [...prev.pages];
          newPages[currentPage] = { ...newPages[currentPage], cleaned_image_url: res.image_url };
          return { ...prev, pages: newPages };
        });
        setPageHasClean(false);
      }
      setStatus("");
    } catch (err) {
      setStatus(`Qaytarish xatolik: ${(err as Error).message}`);
    }
  }, [manga, chapter, currentPage]);

  const executeRerunOcr = useCallback(async (settings: ProjectSettings) => {
    if (!manga || !chapter) return;
    setRerunLoading(true);
    try {
      await api.saveProjectSettings(manga, settings);
      const result = await api.startJob({
        manga,
        chapter,
        language: settings.language,
        backend: settings.backend,
        ocr_backend: settings.ocr_backend,
        cleaner_backend: settings.cleaner_backend,
        translator_model: settings.translator_model || undefined,
        skip_clean: rerunSkipClean,
        limit: settings.limit,
      });
      if (rerunSkipConfirm) {
        localStorage.setItem(`ocr-rerun-skip-confirm:${manga}`, "true");
      }
      setRerunModalOpen(false);
      navigate(`/job/${result.job_id}`);
    } catch (e) {
      const err = e as Error;
      setStatus(`Xatolik: ${err.message}`);
    } finally {
      setRerunLoading(false);
    }
  }, [manga, chapter, rerunSkipConfirm, rerunSkipClean, navigate]);

  const handleRerunOcr = useCallback(async () => {
    if (!manga || !chapter) return;
    try {
      const project = await api.getProject(manga);
      const settings = project.settings ?? DEFAULT_SETTINGS;
      setRerunSettings(settings);
      setRerunSkipConfirm(false);

      const skip = localStorage.getItem(`ocr-rerun-skip-confirm:${manga}`) === "true";
      if (skip) {
        await executeRerunOcr(settings);
      } else {
        setRerunModalOpen(true);
      }
    } catch (e) {
      const err = e as Error;
      setStatus(`Xatolik: ${err.message}`);
    }
  }, [manga, chapter, executeRerunOcr]);

  const handleTranslateConfirm = useCallback(async () => {
    if (!manga || !chapter) return;
    setConfirmTranslate(false);
    setTranslating(true);
    try {
      await api.retranslateRegions(manga, chapter, { all: true });
      const updated = await api.getResults(manga, chapter);
      setRegionDrafts({});
      setData(updated);
      toast.success("Tarjima muvaffaqiyatli tugadi");
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
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
        cleanMode={cleanMode}
        lineCleanMode={lineCleanMode}
        bubbleMode={bubbleMode}
        pageHasClean={pageHasClean}
        confirmTranslate={confirmTranslate}
        brushSize={brushSize}
        setCurrentPage={setCurrentPage}
        setTranslating={setTranslating}
        setDrawingMode={(v) => {
          const next = typeof v === "function" ? v(drawingMode) : v;
          setDrawingMode(next);
          if (next) { setCleanMode(false); setLineCleanMode(false); setBubbleMode(null); }
        }}
        setCleanMode={(v) => {
          const next = typeof v === "function" ? v(cleanMode) : v;
          setCleanMode(next);
          if (next) { setDrawingMode(false); setLineCleanMode(false); setBubbleMode(null); }
        }}
        setLineCleanMode={(v) => {
          const next = typeof v === "function" ? v(lineCleanMode) : v;
          setLineCleanMode(next);
          if (next) { setDrawingMode(false); setCleanMode(false); setBubbleMode(null); }
        }}
        setBubbleMode={(v) => {
          setBubbleMode(v);
          if (v) { setDrawingMode(false); setCleanMode(false); setLineCleanMode(false); }
        }}
        setBrushSize={setBrushSize}
        setConfirmTranslate={setConfirmTranslate}
        setReadingOpen={setReadingOpen}
        onTranslateConfirm={handleTranslateConfirm}
        onRerunOcr={handleRerunOcr}
        onUndoClean={handleUndoClean}
        pagesCount={pages.length}
      />

      <RunInfoPanel manga={manga!} chapter={chapter!} />

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
          <canvas
            ref={drawCanvasRef}
            className={`absolute inset-0 ${cleanMode ? "cursor-none" : drawingMode || lineCleanMode || bubbleMode ? "cursor-crosshair" : ""}`}
          />
          {(drawingMode || cleanMode || lineCleanMode || bubbleMode) && (
            <div className={`absolute bottom-2 left-2 rounded-md px-2.5 py-1 text-[11px] text-white backdrop-blur ${cleanMode || lineCleanMode ? "bg-red-900/80" : bubbleMode ? "bg-blue-900/80" : "bg-black/70"}`}>
              {cleanMode ? "Bosib turib chizing · Qo'yganingizda tozalanadi · Esc - bekor" : lineCleanMode ? "To'rtburchak chizib tozalang · Esc - bekor" : bubbleMode === "rect" ? "Oq to'rtburchak chizing · Esc - bekor" : bubbleMode === "oval" ? "Oq dumaloq chizing · Esc - bekor" : "Matn joyini belgilang · Esc - bekor"}
            </div>
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
      <RerunOcrModal
        open={rerunModalOpen}
        settings={rerunSettings}
        setSettings={setRerunSettings}
        skipConfirm={rerunSkipConfirm}
        setSkipConfirm={setRerunSkipConfirm}
        skipClean={rerunSkipClean}
        setSkipClean={setRerunSkipClean}
        loading={rerunLoading}
        onRun={() => executeRerunOcr(rerunSettings)}
        onClose={() => setRerunModalOpen(false)}
      />
    </div>
  );
}
