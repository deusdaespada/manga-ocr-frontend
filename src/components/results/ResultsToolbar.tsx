import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  Minus,
  Pencil,
  Plus,
  Square,
  X,
  Languages,
  BookOpen,
  RotateCcw,
  RectangleHorizontal,
  Undo2,
} from "lucide-react";

import type { ResultsData } from "../../lib/types";
import { Button } from "../ui/button";

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

interface ResultsToolbarProps {
  manga: string;
  chapter: string;
  data: ResultsData;
  currentPage: number;
  totalPages: number;
  translating: boolean;
  drawingMode: boolean;
  cleanMode: boolean;
  lineCleanMode: boolean;
  bubbleMode: "rect" | "oval" | null;
  pageHasClean: boolean;
  confirmTranslate: boolean;
  brushSize: number;
  setCurrentPage: (page: number) => void;
  setTranslating: (v: boolean) => void;
  setDrawingMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setCleanMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLineCleanMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setBubbleMode: (v: "rect" | "oval" | null) => void;
  setBrushSize: (v: number) => void;
  setConfirmTranslate: (v: boolean) => void;
  setReadingOpen: (v: boolean) => void;
  onTranslateConfirm: () => void;
  onRerunOcr: () => void;
  onUndoClean: () => void;
  pagesCount: number;
}

export default function ResultsToolbar({
  manga,
  chapter,
  data,
  currentPage,
  totalPages,
  translating,
  drawingMode,
  cleanMode,
  lineCleanMode,
  bubbleMode,
  pageHasClean,
  confirmTranslate,
  setCurrentPage,
  brushSize,
  setDrawingMode,
  setCleanMode,
  setLineCleanMode,
  setBubbleMode,
  setBrushSize,
  setConfirmTranslate,
  setReadingOpen,
  onTranslateConfirm,
  onRerunOcr,
  onUndoClean,
  pagesCount,
}: ResultsToolbarProps) {
  const costText = formatCost(data);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Back */}
      <Link
        to={`/project/${manga}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{manga} / {chapter}-bob</span>
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
          onClick={() => setCurrentPage(Math.min(pagesCount, currentPage + 1))}
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
            onClick={onTranslateConfirm}
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
      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onRerunOcr}>
        <RotateCcw className="h-3 w-3" />
        Qayta OCR
      </Button>
      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCurrentPage(pagesCount)}>
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
        onClick={() => setDrawingMode((prev: boolean) => !prev)}
      >
        {drawingMode ? (
          <><X className="h-3 w-3" />Bekor</>
        ) : (
          <><Plus className="h-3 w-3" />Region</>
        )}
      </Button>
      <Button
        variant={cleanMode ? "destructive" : "outline"}
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => setCleanMode((prev: boolean) => !prev)}
      >
        {cleanMode ? (
          <><X className="h-3 w-3" />Bekor</>
        ) : (
          <><Eraser className="h-3 w-3" />Tozalash</>
        )}
      </Button>
      <Button
        variant={lineCleanMode ? "destructive" : "outline"}
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => setLineCleanMode((prev: boolean) => !prev)}
      >
        {lineCleanMode ? (
          <><X className="h-3 w-3" />Bekor</>
        ) : (
          <><RectangleHorizontal className="h-3 w-3" />Chiziq</>
        )}
      </Button>
      <Button
        variant={bubbleMode === "rect" ? "destructive" : "outline"}
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => setBubbleMode(bubbleMode === "rect" ? null : "rect")}
      >
        {bubbleMode === "rect" ? (
          <><X className="h-3 w-3" />Bekor</>
        ) : (
          <><Square className="h-3 w-3" />To'rtburchak</>
        )}
      </Button>
      <Button
        variant={bubbleMode === "oval" ? "destructive" : "outline"}
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => setBubbleMode(bubbleMode === "oval" ? null : "oval")}
      >
        {bubbleMode === "oval" ? (
          <><X className="h-3 w-3" />Bekor</>
        ) : (
          <><Circle className="h-3 w-3" />Dumaloq</>
        )}
      </Button>
      {cleanMode && (
        <div className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5">
          <button
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-[32px] text-center text-[11px] tabular-nums">{brushSize}px</span>
          <button
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
      {pageHasClean && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          onClick={onUndoClean}
        >
          <Undo2 className="h-3 w-3" />
          Qaytarish
        </Button>
      )}

      {/* Cost — right side */}
      {costText && (
        <>
          <div className="flex-1" />
          <span className="mono text-[11px] text-muted-foreground">{costText}</span>
        </>
      )}
    </div>
  );
}
