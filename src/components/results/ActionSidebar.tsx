import {
  Circle,
  Eraser,
  Minus,
  Plus,
  RectangleHorizontal,
  ScanText,
  Square,
  Undo2,
} from "lucide-react";

interface ActionSidebarProps {
  drawingMode: boolean;
  cleanMode: boolean;
  lineCleanMode: boolean;
  ocrMode: boolean;
  bubbleMode: "rect" | "oval" | null;
  pageHasClean: boolean;
  brushSize: number;
  setDrawingMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setCleanMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLineCleanMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setOcrMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setBubbleMode: (v: "rect" | "oval" | null) => void;
  setBrushSize: (v: number) => void;
  onUndoClean: () => void;
}

type SideBtn = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
};

export default function ActionSidebar({
  drawingMode,
  cleanMode,
  lineCleanMode,
  ocrMode,
  bubbleMode,
  pageHasClean,
  brushSize,
  setDrawingMode,
  setCleanMode,
  setLineCleanMode,
  setOcrMode,
  setBubbleMode,
  setBrushSize,
  onUndoClean,
}: ActionSidebarProps) {
  const buttons: SideBtn[] = [
    {
      icon: <Plus className="h-3.5 w-3.5" />,
      label: "Region",
      active: drawingMode,
      onClick: () => setDrawingMode((p: boolean) => !p),
    },
    {
      icon: <ScanText className="h-3.5 w-3.5" />,
      label: "OCR",
      active: ocrMode,
      onClick: () => setOcrMode((p: boolean) => !p),
      color: "amber",
    },
    {
      icon: <Eraser className="h-3.5 w-3.5" />,
      label: "Tozalash",
      active: cleanMode,
      onClick: () => setCleanMode((p: boolean) => !p),
      color: "red",
    },
    {
      icon: <RectangleHorizontal className="h-3.5 w-3.5" />,
      label: "Chiziq",
      active: lineCleanMode,
      onClick: () => setLineCleanMode((p: boolean) => !p),
      color: "red",
    },
    {
      icon: <Square className="h-3.5 w-3.5" />,
      label: "To'rtburchak",
      active: bubbleMode === "rect",
      onClick: () => setBubbleMode(bubbleMode === "rect" ? null : "rect"),
      color: "blue",
    },
    {
      icon: <Circle className="h-3.5 w-3.5" />,
      label: "Dumaloq",
      active: bubbleMode === "oval",
      onClick: () => setBubbleMode(bubbleMode === "oval" ? null : "oval"),
      color: "blue",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-1 pt-5">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          title={btn.label}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            btn.active
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          onClick={btn.onClick}
        >
          {btn.icon}
        </button>
      ))}

      {/* Brush size — faqat cleanMode da */}
      {cleanMode && (
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <div className="h-px w-5 bg-border" />
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
          <span className="text-[9px] tabular-nums text-muted-foreground">{brushSize}</span>
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
        </div>
      )}

      {/* Undo */}
      {pageHasClean && (
        <>
          <div className="mt-1 h-px w-5 bg-border" />
          <button
            title="Qaytarish"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-400 transition-colors hover:bg-amber-500/10"
            onClick={onUndoClean}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
