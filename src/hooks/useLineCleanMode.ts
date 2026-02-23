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
  setData: React.Dispatch<React.SetStateAction<ResultsData | null>>;
  setStatus: (s: string) => void;
  setPageHasClean: (v: boolean) => void;
  setEnabled: (v: boolean) => void;
}

export function useLineCleanMode({ enabled, imgRef, canvasRef, manga, chapter, currentPage, setData, setStatus, setPageHasClean, setEnabled }: Params) {
  useEffect(() => {
    if (!enabled) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setupCanvas(canvas, img);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let startX = 0;
    let startY = 0;
    let isDrawing = false;

    function onDown(e: MouseEvent) {
      e.preventDefault();
      const coords = getCanvasCoords(canvas!, e);
      startX = coords.x;
      startY = coords.y;
      isDrawing = true;
    }

    function onMove(e: MouseEvent) {
      if (!isDrawing) return;
      const drawCtx = canvas!.getContext("2d");
      if (!drawCtx) return;
      const coords = getCanvasCoords(canvas!, e);
      drawCtx.clearRect(0, 0, canvas!.width, canvas!.height);
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
      const coords = getCanvasCoords(canvas!, e);
      const x = Math.round(Math.min(startX, coords.x));
      const y = Math.round(Math.min(startY, coords.y));
      const w = Math.round(Math.abs(coords.x - startX));
      const h = Math.round(Math.abs(coords.y - startY));
      const drawCtx = canvas!.getContext("2d");
      if (drawCtx) drawCtx.clearRect(0, 0, canvas!.width, canvas!.height);
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
      if (e.key === "Escape") setEnabled(false);
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
  }, [enabled, manga, chapter, currentPage]);
}
