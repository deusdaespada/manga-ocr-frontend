import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Settings2, X } from "lucide-react";

import { api } from "../../lib/api";
import type { RunEntry, RunInfo } from "../../lib/types";


function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function StepRow({ name, elapsed, detail }: { name: string; elapsed: number; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{name}</span>
      <span className="tabular-nums">
        {formatDuration(elapsed)}
        {detail && <span className="ml-1 text-muted-foreground">({detail})</span>}
      </span>
    </div>
  );
}

function RunSection({ label, entry }: { label: string; entry: RunEntry }) {
  const [open, setOpen] = useState(true);
  const steps = entry.steps || {};
  const cfg = entry.config || {};

  const configParts: string[] = [];
  if (cfg.ocr_backend) configParts.push(`OCR: ${cfg.ocr_backend}`);
  if (cfg.cleaner_backend) configParts.push(`Cleaner: ${cfg.cleaner_backend}`);
  if (cfg.translator_backend) configParts.push(`${cfg.translator_backend}`);
  if (cfg.translator_model) configParts.push(cfg.translator_model);
  if (cfg.language) configParts.push(`Til: ${cfg.language}`);

  return (
    <div>
      <button
        className="flex w-full items-center gap-1 text-left text-xs font-medium hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{label}</span>
        <span className="ml-auto tabular-nums text-[11px] text-muted-foreground">
          {formatDuration(entry.total_sec)}
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 pl-4">
          {configParts.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Settings2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{configParts.join(" | ")}</span>
            </div>
          )}
          {Object.entries(steps).map(([name, timing]) => {
            const detail: string[] = [];
            if (timing.segments !== undefined) detail.push(`${timing.segments} seg`);
            if (timing.masks !== undefined) detail.push(`${timing.masks} mask`);
            if (timing.regions !== undefined) detail.push(`${timing.regions} region`);
            if (timing.texts !== undefined) detail.push(`${timing.texts} matn`);
            if (timing.skipped) detail.push("o'tkazildi");
            return (
              <StepRow
                key={name}
                name={name}
                elapsed={timing.elapsed_sec}
                detail={detail.length > 0 ? detail.join(", ") : undefined}
              />
            );
          })}
          {entry.pages !== undefined && (
            <div className="text-[11px] text-muted-foreground">
              {entry.pages} sahifa, {entry.regions ?? 0} region
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RunInfoPanelProps {
  manga: string;
  chapter: string;
}

export function useRunInfo(manga: string, chapter: string) {
  const [info, setInfo] = useState<RunInfo | null>(null);

  useEffect(() => {
    api.getRunInfo(manga, chapter).then(setInfo).catch(() => setInfo(null));
  }, [manga, chapter]);

  return info;
}

export function RunInfoModal({ info, onClose }: { info: RunInfo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="flex justify-center pt-12">
        <div
          className="relative w-full max-w-sm rounded-lg border bg-card p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Run Info
          </div>
          <div className="space-y-2">
            {info.ocr_run && <RunSection label="OCR" entry={info.ocr_run} />}
            {info.translate_run && <RunSection label="Tarjima" entry={info.translate_run} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy export — endi ishlatilmaydi, lekin backward compat uchun
export default function RunInfoPanel({ manga, chapter }: RunInfoPanelProps) {
  const info = useRunInfo(manga, chapter);

  if (!info) return null;
  if (!info.ocr_run && !info.translate_run) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card/50 px-3 py-2">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 space-y-1">
        {info.ocr_run && <RunSection label="OCR" entry={info.ocr_run} />}
        {info.translate_run && <RunSection label="Tarjima" entry={info.translate_run} />}
      </div>
    </div>
  );
}
