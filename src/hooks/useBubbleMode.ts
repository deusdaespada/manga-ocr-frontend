import { useEffect } from "react";
import type { RefObject } from "react";
import { api } from "../lib/api";
import type { ResultsData } from "../lib/types";
import { setupCanvas, getCanvasCoords } from "./canvasUtils";

interface Params {
  bubbleMode: "rect" | "oval" | null;
  imgRef: RefObject<HTMLImageElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  manga: string | undefined;
  chapter: string | undefined;
  currentPage: number;
  setData: React.Dispatch<React.SetStateAction<ResultsData | null>>;
  setStatus: (s: string) => void;
  setPageHasClean: (v: boolean) => void;
  setBubbleMode: (v: "rect" | "oval" | null) => void;
  brushColor: string;
}

export function useBubbleMode({ bubbleMode, imgRef, canvasRef, manga, chapter, currentPage, setData, setStatus, setPageHasClean, setBubbleMode, brushColor }: Params) {
  useEffect(() => {
    if (!bubbleMode) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setupCanvas(canvas, img);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let startX = 0;
    let startY = 0;
    let isDrawing = false;
    const shape = bubbleMode;

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
      const cr = parseInt(brushColor.slice(1, 3), 16);
      const cg = parseInt(brushColor.slice(3, 5), 16);
      const cb = parseInt(brushColor.slice(5, 7), 16);
      drawCtx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.7)`;
      if (shape === "oval") {
        drawCtx.beginPath();
        drawCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        drawCtx.fill();
      } else {
        drawCtx.fillRect(x, y, w, h);
      }
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
        setStatus("Chizilmoqda...");
        const res = await api.drawBubble(manga, chapter, currentPage, { x, y, w, h }, shape, brushColor);
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
  }, [bubbleMode, manga, chapter, currentPage, brushColor]);
}
