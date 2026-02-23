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
  setData: React.Dispatch<React.SetStateAction<ResultsData | null>>;
  setStatus: (s: string) => void;
  setPageHasClean: (v: boolean) => void;
  setEnabled: (v: boolean) => void;
}

export function useCleanMode({ enabled, imgRef, canvasRef, manga, chapter, currentPage, brushSize, setData, setStatus, setPageHasClean, setEnabled }: Params) {
  useEffect(() => {
    if (!enabled) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setupCanvas(canvas, img);
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;

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

    function drawBrushStroke(fromX: number, fromY: number, toX: number, toY: number) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

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
      const coords = getCanvasCoords(canvas!, e);
      lastX = coords.x;
      lastY = coords.y;

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
      if (!isDrawing) {
        const coords = getCanvasCoords(canvas!, e);
        ctx.clearRect(0, 0, canvas!.width, canvas!.height);

        if (hasPainted) {
          ctx.globalAlpha = 1;
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = canvas!.width;
          tempCanvas.height = canvas!.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCtx.drawImage(maskCanvas, 0, 0);
          tempCtx.globalCompositeOperation = "source-in";
          tempCtx.fillStyle = "rgba(239, 68, 68, 0.5)";
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          ctx.drawImage(tempCanvas, 0, 0);
        }

        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      const coords = getCanvasCoords(canvas!, e);
      drawBrushStroke(lastX, lastY, coords.x, coords.y);
      lastX = coords.x;
      lastY = coords.y;
    }

    async function onUp() {
      if (!isDrawing) return;
      isDrawing = false;

      if (!hasPainted || !manga || !chapter) return;

      const maskDataUrl = maskCanvas.toDataURL("image/png");
      const maskBase64 = maskDataUrl.split(",")[1];

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

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

      hasPainted = false;
      maskCtx.fillStyle = "#000";
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
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
  }, [enabled, manga, chapter, currentPage, brushSize]);
}
