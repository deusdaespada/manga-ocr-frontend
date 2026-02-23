import { useEffect, useRef, useState } from "react";
import {
  BoxSelect,
  Circle,
  Eraser,
  Minus,
  Paintbrush,
  Pipette,
  Plus,
  ScanText,
  Square,
  Undo2,
} from "lucide-react";

interface ActionSidebarProps {
  drawingMode: boolean;
  cleanMode: boolean;
  lineCleanMode: boolean;
  ocrMode: boolean;
  penMode: boolean;
  eyeDropperMode: boolean;
  bubbleMode: "rect" | "oval" | null;
  pageHasClean: boolean;
  brushSize: number;
  brushColor: string;
  setDrawingMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setCleanMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLineCleanMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setOcrMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPenMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setEyeDropperMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setBubbleMode: (v: "rect" | "oval" | null) => void;
  setBrushSize: (v: number) => void;
  setBrushColor: (v: string) => void;
  onUndoClean: () => void;
}

function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleEyeDropper = async () => {
    if (!("EyeDropper" in window)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dropper = new (window as any).EyeDropper();
      const result = await dropper.open();
      onChange(result.sRGBHex);
      setOpen(false);
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-6 w-6 items-center justify-center rounded border border-muted-foreground/40 transition-colors hover:border-muted-foreground"
        style={{ backgroundColor: color }}
        onClick={() => setOpen((p) => !p)}
        title="Rang tanlash"
      />
      {open && (
        <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-lg border bg-popover p-2 shadow-lg">
          <div className="flex items-center gap-1.5">
            <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded border border-muted-foreground/30">
              <input
                type="color"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="h-5 w-5 rounded-sm" style={{ backgroundColor: color }} />
            </label>
            {"EyeDropper" in window && (
              <button
                title="Rasmdan rang olish"
                className="flex h-7 w-7 items-center justify-center rounded border border-muted-foreground/30 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={handleEyeDropper}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 22 1-1h3l9-9" />
                  <path d="M3 21v-3l9-9" />
                  <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3L15 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Separator = () => <div className="my-0.5 h-px w-5 bg-border" />;

type BtnDef = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass: string;
};

export default function ActionSidebar({
  drawingMode,
  cleanMode,
  lineCleanMode,
  ocrMode,
  penMode,
  eyeDropperMode,
  bubbleMode,
  pageHasClean,
  brushSize,
  brushColor,
  setDrawingMode,
  setCleanMode,
  setLineCleanMode,
  setOcrMode,
  setPenMode,
  setEyeDropperMode,
  setBubbleMode,
  setBrushSize,
  setBrushColor,
  onUndoClean,
}: ActionSidebarProps) {
  const analysisBtns: BtnDef[] = [
    {
      icon: <Plus className="h-3.5 w-3.5" />,
      label: "Region (N)",
      active: drawingMode,
      onClick: () => setDrawingMode((p: boolean) => !p),
      activeClass: "bg-emerald-600 text-white",
    },
    {
      icon: <ScanText className="h-3.5 w-3.5" />,
      label: "OCR (O)",
      active: ocrMode,
      onClick: () => setOcrMode((p: boolean) => !p),
      activeClass: "bg-amber-600 text-white",
    },
  ];

  const cleanBtns: BtnDef[] = [
    {
      icon: <Eraser className="h-3.5 w-3.5" />,
      label: "Tozalash (E)",
      active: cleanMode,
      onClick: () => setCleanMode((p: boolean) => !p),
      activeClass: "bg-red-600 text-white",
    },
    {
      icon: <BoxSelect className="h-3.5 w-3.5" />,
      label: "To'rtburchak tozalash (R)",
      active: lineCleanMode,
      onClick: () => setLineCleanMode((p: boolean) => !p),
      activeClass: "bg-red-600 text-white",
    },
  ];

  const drawBtns: BtnDef[] = [
    {
      icon: <Paintbrush className="h-3.5 w-3.5" />,
      label: "Qalam (B)",
      active: penMode,
      onClick: () => setPenMode((p: boolean) => !p),
      activeClass: "bg-blue-600 text-white",
    },
    {
      icon: <Square className="h-3.5 w-3.5" />,
      label: "To'rtburchak (U)",
      active: bubbleMode === "rect",
      onClick: () => setBubbleMode(bubbleMode === "rect" ? null : "rect"),
      activeClass: "bg-blue-600 text-white",
    },
    {
      icon: <Circle className="h-3.5 w-3.5" />,
      label: "Dumaloq (J)",
      active: bubbleMode === "oval",
      onClick: () => setBubbleMode(bubbleMode === "oval" ? null : "oval"),
      activeClass: "bg-blue-600 text-white",
    },
    {
      icon: <Pipette className="h-3.5 w-3.5" />,
      label: "Rang olish (I)",
      active: eyeDropperMode,
      onClick: () => setEyeDropperMode((p: boolean) => !p),
      activeClass: "bg-violet-600 text-white",
    },
  ];

  const renderBtn = (btn: BtnDef) => (
    <button
      key={btn.label}
      title={btn.label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        btn.active
          ? btn.activeClass
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      onClick={btn.onClick}
    >
      {btn.icon}
    </button>
  );

  const isDrawTool = penMode || !!bubbleMode;
  const isBrushTool = penMode || cleanMode;

  return (
    <div className="flex flex-col items-center gap-1 pt-5">
      {analysisBtns.map(renderBtn)}
      <Separator />
      {cleanBtns.map(renderBtn)}
      <Separator />
      {drawBtns.map(renderBtn)}

      {/* Color picker — chizish asboblari uchun */}
      {isDrawTool && (
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <Separator />
          <ColorPicker color={brushColor} onChange={setBrushColor} />
        </div>
      )}

      {/* Brush size — qalam yoki tozalash uchun */}
      {isBrushTool && (
        <div className="mt-0.5 flex flex-col items-center gap-0.5">
          {!isDrawTool && <Separator />}
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
          <Separator />
          <button
            title="Qaytarish (Z / Ctrl+Z)"
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
