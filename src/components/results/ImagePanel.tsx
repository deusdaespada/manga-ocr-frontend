import type { ReactNode, Ref } from "react";

interface ImagePanelProps {
  label: string;
  imgRef: Ref<HTMLImageElement>;
  canvasRef: Ref<HTMLCanvasElement>;
  wrapRef: Ref<HTMLDivElement>;
  imgSrc?: string;
  imgAlt?: string;
  children?: ReactNode;
}

export default function ImagePanel({
  label,
  imgRef,
  canvasRef,
  wrapRef,
  imgSrc,
  imgAlt,
  children,
}: ImagePanelProps) {
  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-card"
      >
        <img ref={imgRef} src={imgSrc} alt={imgAlt || label} className="block w-full" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
        {children}
      </div>
    </div>
  );
}
