import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import type { Page } from "../../lib/types";
import { drawTranslatedTexts } from "../../lib/canvas";
import { Button } from "../ui/button";

interface ReadingOverlayProps {
  pages: Page[];
  open: boolean;
  onClose: () => void;
}

export default function ReadingOverlay({ pages, open, onClose }: ReadingOverlayProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    async function render() {
      // Fontlar yuklangandan keyin chizish
      await document.fonts.ready;

      const readingPages = pages.filter((p) => p.cleaned_image_url);
      readingPages.forEach((page, idx) => {
        const canvas = canvasRefs.current[idx];
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
    }

    render();
  }, [open, pages]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <span className="text-sm font-medium">To'liq o'qish</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
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
                    canvasRefs.current[idx] = el;
                  }}
                  className="h-auto w-full"
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
