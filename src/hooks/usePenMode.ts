import { useEffect } from "react";
import type { RefObject } from "react";
import { api } from "../lib/api";
import type { ResultsData } from "../lib/types";
import { setupCanvas, getCanvasCoords } from "./canvasUtils";

interface Params {
  enabled: boolean;
  imgRef: RefObject<HTMLImageElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  manga: string | undefined;
  chapter: string | undefined;
  currentPage: number;
  brushSize: number;
  brushColor: string;
  setData: React.Dispatch<React.SetStateAction<ResultsData | null>>;
  setStatus: (s: string) => void;
  setPageHasClean: (v: boolean) => void;
  setEnabled: (v: boolean) => void;
}

export function usePenMode({ enabled, imgRef, canvasRef, manga, chapter, currentPage, brushSize, brushColor, setData, setStatus, setPageHasClean, setEnabled }: Params) {
  useEffect(() => {
    if (!enabled) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setupCanvas(canvas, img);
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;

    const strokeCanvas = document.createElement("canvas");
    strokeCanvas.width = canvas.width;
    strokeCanvas.height = canvas.height;
    const strokeCtx = strokeCanvas.getContext("2d")!;

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let hasPainted = false;

    const r = parseInt(brushColor.slice(1, 3), 16);
    const g = parseInt(brushColor.slice(3, 5), 16);
    const b = parseInt(brushColor.slice(5, 7), 16);
    const previewColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const isLight = lum > 128;
    const cursorRing = `rgba(${r}, ${g}, ${b}, 0.9)`;
    const cursorRingOuter = isLight ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)";

    function drawStroke(fromX: number, fromY: number, toX: number, toY: number) {
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      strokeCtx.strokeStyle = brushColor;
      strokeCtx.lineWidth = brushSize;
      strokeCtx.lineCap = "round";
      strokeCtx.lineJoin = "round";
      strokeCtx.beginPath();
      strokeCtx.moveTo(fromX, fromY);
      strokeCtx.lineTo(toX, toY);
      strokeCtx.stroke();
    }

    function onDown(e: MouseEvent) {
      e.preventDefault();
      isDrawing = true;
      const coords = getCanvasCoords(canvas!, e);
      lastX = coords.x;
      lastY = coords.y;

      ctx.fillStyle = previewColor;
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();

      strokeCtx.fillStyle = brushColor;
      strokeCtx.beginPath();
      strokeCtx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      strokeCtx.fill();

      hasPainted = true;
    }

    function onMove(e: MouseEvent) {
      if (!isDrawing) {
        const coords = getCanvasCoords(canvas!, e);
        ctx.clearRect(0, 0, canvas!.width, canvas!.height);

        if (hasPainted) {
          ctx.globalAlpha = 0.7;
          ctx.drawImage(strokeCanvas, 0, 0);
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = cursorRingOuter;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = cursorRing;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      const coords = getCanvasCoords(canvas!, e);
      drawStroke(lastX, lastY, coords.x, coords.y);
      lastX = coords.x;
      lastY = coords.y;
    }

    async function onUp() {
      if (!isDrawing) return;
      isDrawing = false;

      if (!hasPainted || !manga || !chapter) return;

      const overlayDataUrl = strokeCanvas.toDataURL("image/png");
      const overlayBase64 = overlayDataUrl.split(",")[1];

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      try {
        setStatus("Chizilmoqda...");
        const res = await api.paintOverlay(manga, chapter, currentPage, overlayBase64);
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

      hasPainted = false;
      strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEnabled(false);
    }

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
  }, [enabled, manga, chapter, currentPage, brushSize, brushColor]);
}
