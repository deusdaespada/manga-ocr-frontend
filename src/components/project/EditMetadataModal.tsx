import { X, Check, Loader2 } from "lucide-react";

import type { AgeRating, AuthorEntry, MangaStatus, ProjectMetadata, ScheduleDay } from "../../lib/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import GenrePicker from "../GenrePicker";
import MetadataExtraFields from "../MetadataExtraFields";

interface EditMetadataModalProps {
  open: boolean;
  metaDraft: ProjectMetadata;
  setMetaDraft: React.Dispatch<React.SetStateAction<ProjectMetadata>>;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function EditMetadataModal({
  open,
  metaDraft,
  setMetaDraft,
  saving,
  onSave,
  onClose,
}: EditMetadataModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-sm font-medium">Ma'lumotlarni tahrirlash</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tavsif</label>
              <Textarea
                value={metaDraft.description}
                onChange={(e) => setMetaDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Manga haqida..."
                className="min-h-[120px] text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">O'zbekcha</label>
                <Input
                  value={metaDraft.title_uz}
                  onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_uz: e.target.value }))}
                  placeholder="O'zbek tilidagi nomi"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Ruscha</label>
                <Input
                  value={metaDraft.title_ru}
                  onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_ru: e.target.value }))}
                  placeholder="Русское название"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Inglizcha</label>
                <Input
                  value={metaDraft.title_en}
                  onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_en: e.target.value }))}
                  placeholder="English title"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Yaponcha</label>
                <Input
                  value={metaDraft.title_ja}
                  onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_ja: e.target.value }))}
                  placeholder="日本語タイトル"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Koreyscha</label>
                <Input
                  value={metaDraft.title_ko}
                  onChange={(e) => setMetaDraft((prev) => ({ ...prev, title_ko: e.target.value }))}
                  placeholder="한국어 제목"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Janrlar</label>
              <GenrePicker
                value={metaDraft.tags}
                onChange={(genres) => setMetaDraft((prev) => ({ ...prev, tags: genres }))}
              />
            </div>
            <MetadataExtraFields
              status={(metaDraft.status as MangaStatus) ?? "ongoing"}
              setStatus={(v) => setMetaDraft((prev) => ({ ...prev, status: v }))}
              ageRating={(metaDraft.age_rating as AgeRating) ?? "13+"}
              setAgeRating={(v) => setMetaDraft((prev) => ({ ...prev, age_rating: v }))}
              year={metaDraft.year != null ? String(metaDraft.year) : ""}
              setYear={(v) => {
                const n = v.trim() ? parseInt(v.trim(), 10) : null;
                setMetaDraft((prev) => ({ ...prev, year: n && !Number.isNaN(n) ? n : null }));
              }}
              rating={metaDraft.rating != null ? String(metaDraft.rating) : ""}
              setRating={(v) => {
                const n = v.trim() ? parseFloat(v.trim()) : null;
                setMetaDraft((prev) => ({ ...prev, rating: n != null && !Number.isNaN(n) ? n : null }));
              }}
              scheduleDays={(metaDraft.schedule_days as ScheduleDay[]) ?? []}
              setScheduleDays={(v) => setMetaDraft((prev) => ({ ...prev, schedule_days: v }))}
              authors={(metaDraft.authors as AuthorEntry[]) ?? []}
              setAuthors={(v) => setMetaDraft((prev) => ({ ...prev, authors: v }))}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Bekor
          </Button>
          <Button size="sm" className="gap-1" disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
