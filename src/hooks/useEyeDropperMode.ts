import { useEffect } from "react";
import type { RefObject } from "react";
import { setupCanvas, getCanvasCoords } from "./canvasUtils";

interface Params {
  enabled: boolean;
  imgRef: RefObject<HTMLImageElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  setBrushColor: (color: string) => void;
  setEnabled: (v: boolean) => void;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
  );
}

export function useEyeDropperMode({
  enabled,
  imgRef,
  canvasRef,
  setBrushColor,
  setEnabled,
}: Params) {
  useEffect(() => {
    if (!enabled) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setupCanvas(canvas, img);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rasmdan piksel o'qish uchun yashirin canvas
    const pickCanvas = document.createElement("canvas");
    pickCanvas.width = img.naturalWidth;
    pickCanvas.height = img.naturalHeight;
    const pickCtx = pickCanvas.getContext("2d", { willReadFrequently: true })!;
    pickCtx.drawImage(img, 0, 0);

    let previewColor = "";

    function drawCursor(x: number, y: number, color: string) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Tashqi halqa (kontrast)
      ctx!.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx!.lineWidth = 3;
      ctx!.beginPath();
      ctx!.arc(x, y, 16, 0, Math.PI * 2);
      ctx!.stroke();

      // Rang ko'rsatuvchi halqa
      ctx!.strokeStyle = color || "#ffffff";
      ctx!.lineWidth = 4;
      ctx!.beginPath();
      ctx!.arc(x, y, 12, 0, Math.PI * 2);
      ctx!.stroke();

      // Ichki cross-hair
      ctx!.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(x - 5, y);
      ctx!.lineTo(x + 5, y);
      ctx!.moveTo(x, y - 5);
      ctx!.lineTo(x, y + 5);
      ctx!.stroke();
    }

    function getColorAt(x: number, y: number): string {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= pickCanvas.width || py >= pickCanvas.height) {
        return "#ffffff";
      }
      const data = pickCtx.getImageData(px, py, 1, 1).data;
      return rgbToHex(data[0], data[1], data[2]);
    }

    function onMove(e: MouseEvent) {
      const coords = getCanvasCoords(canvas!, e);
      previewColor = getColorAt(coords.x, coords.y);
      drawCursor(coords.x, coords.y, previewColor);
    }

    function onClick(e: MouseEvent) {
      e.preventDefault();
      const coords = getCanvasCoords(canvas!, e);
      const color = getColorAt(coords.x, coords.y);
      setBrushColor(color);
      // Mode ni o'chirmaymiz — bir nechta marta tanlab olish mumkin
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        setEnabled(false);
      }
    }

    function onLeave() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onLeave);
    document.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("keydown", onKey);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    };
  }, [enabled, imgRef, canvasRef, setBrushColor, setEnabled]);
}
