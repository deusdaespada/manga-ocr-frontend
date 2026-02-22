import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Pencil,
  Languages,
  BookOpen,
  RotateCcw,
} from "lucide-react";

import type { ResultsData, RunInfo } from "../../lib/types";
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
  confirmTranslate: boolean;
  runInfo: RunInfo | null;
  setCurrentPage: (page: number) => void;
  setTranslating: (v: boolean) => void;
  setConfirmTranslate: (v: boolean) => void;
  setReadingOpen: (v: boolean) => void;
  onTranslateConfirm: () => void;
  onRerunOcr: () => void;
  onExport: () => void;
  onExportPage: () => void;
  onRunInfoOpen: () => void;
  exporting: boolean;
  pagesCount: number;
}

export default function ResultsToolbar({
  manga,
  chapter,
  data,
  currentPage,
  totalPages,
  translating,
  confirmTranslate,
  runInfo,
  setCurrentPage,
  setConfirmTranslate,
  setReadingOpen,
  onTranslateConfirm,
  onRerunOcr,
  onExport,
  onExportPage,
  onRunInfoOpen,
  exporting,
  pagesCount,
}: ResultsToolbarProps) {
  const costText = formatCost(data);
  const hasRunInfo = runInfo && (runInfo.ocr_run || runInfo.translate_run);

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
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        disabled={exporting}
        onClick={onExportPage}
        title="Joriy sahifani PNG export"
      >
        <Download className="h-3 w-3" />
        {exporting ? "..." : "Sahifa"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
        disabled={exporting}
        onClick={onExport}
        title="Barcha sahifalarni PNG export"
      >
        <Download className="h-3 w-3" />
        {exporting ? "..." : "Hammasi"}
      </Button>
      <Link to={`/edit/${manga}/${chapter}`}>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <Pencil className="h-3 w-3" />
          Tahrir
        </Button>
      </Link>

      {/* Right side: Run info + Cost */}
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {hasRunInfo && (
          <button
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={onRunInfoOpen}
            title="Run ma'lumotlari"
          >
            <Clock className="h-3 w-3" />
            Info
          </button>
        )}
        {costText && hasRunInfo && <div className="h-3 w-px bg-border" />}
        {costText && (
          <span className="mono text-[11px] text-muted-foreground">{costText}</span>
        )}
      </div>
    </div>
  );
}
