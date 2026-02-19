import { ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";

interface TranslationText {
  pageIdx: number;
  regionIdx: number;
  original_text: string;
  uz_text: string;
}

interface TranslationTextsViewProps {
  texts: TranslationText[];
  onBack: () => void;
}

export default function TranslationTextsView({ texts, onBack }: TranslationTextsViewProps) {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tarjima matnlari</span>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5" />
          Orqaga
        </Button>
      </div>
      <div className="space-y-2">
        {texts.length === 0 ? (
          <div className="text-sm text-muted-foreground">Matn topilmadi.</div>
        ) : (
          texts.map((t, idx) => (
            <div key={`${t.pageIdx}-${t.regionIdx}-${idx}`} className="rounded-lg border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">Sahifa {t.pageIdx + 1}</div>
              <div className="mt-1 text-sm">{t.original_text}</div>
              <div className="mt-1.5 text-sm text-muted-foreground">
                {t.uz_text ? t.uz_text.toUpperCase() : "— Tarjima yo'q"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
