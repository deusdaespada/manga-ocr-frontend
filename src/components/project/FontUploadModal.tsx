import { useRef, useState } from "react";
import { X, Upload, Loader2, Trash2, AlertTriangle, Check, Type } from "lucide-react";

import { api } from "../../lib/api";
import type {
  FontCategory,
  FontPreviewItem,
  FontStyleKey,
  FontUploadMeta,
} from "../../lib/types";
import { useFonts } from "../../hooks/useFonts";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface FontUploadModalProps {
  open: boolean;
  onClose: () => void;
}

// Preview natijasi + foydalanuvchi tahrirlagan meta (fayl bilan parallel).
type Row = {
  file: File;
  item: FontPreviewItem;
  family: string;
  category: FontCategory;
  style: FontStyleKey;
};

const CATEGORY_OPTIONS: { value: FontCategory; label: string }[] = [
  { value: "comic", label: "Dialog (bubble)" },
  { value: "sfx", label: "SFX / FX" },
  { value: "narration", label: "Narration / fikr" },
  { value: "clean", label: "Oddiy / universal" },
];

const STYLE_OPTIONS: { value: FontStyleKey; label: string }[] = [
  { value: "normal", label: "Regular" },
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "bold-italic", label: "Bold Italic" },
];

const ACCEPT = ".ttf,.otf,.ttc";

export default function FontUploadModal({ open, onClose }: FontUploadModalProps) {
  const { fonts, categoryLabels, setFonts } = useFonts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!open) return null;

  const userFonts = fonts.filter((f) => f.source === "user");
  const validRows = rows.filter((r) => r.item.valid);

  const resetSelection = () => {
    setRows([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (analyzing || uploading) return;
    resetSelection();
    onClose();
  };

  const onFilesPicked = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.previewFonts(files);
      // items[] preview FAYLLAR bilan bir tartibda qaytadi.
      const next: Row[] = files.map((file, i) => {
        const item = res.items[i] ?? { filename: file.name, valid: false, error: "Preview yo'q" };
        return {
          file,
          item,
          family: item.family ?? file.name.replace(/\.[^.]+$/, ""),
          category: item.category ?? "comic",
          style: item.styleKey ?? "normal",
        };
      });
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview xatosi");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleUpload = async () => {
    if (validRows.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const files = validRows.map((r) => r.file);
      const meta: FontUploadMeta[] = validRows.map((r) => ({
        family: r.family.trim(),
        category: r.category,
        style: r.style,
      }));
      const res = await api.uploadFonts(files, meta);
      setFonts(res.fonts);
      resetSelection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (family: string) => {
    setDeleting(family);
    setError(null);
    try {
      const res = await api.deleteFont(family);
      setFonts(res.fonts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "O'chirishda xatolik");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        e.stopPropagation();
        handleClose();
      }}
    >
      <div
        className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Font yuklash</span>
          </div>
          <button
            onClick={handleClose}
            disabled={analyzing || uploading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* 1-qadam: fayl tanlash */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => onFilesPicked(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing || uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {analyzing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
              <span className="text-sm">
                {analyzing ? "Tahlil qilinmoqda..." : "Font fayllarni tanlang (.ttf / .otf / .ttc)"}
              </span>
              <span className="text-[11px]">Bir nechta fayl tanlash mumkin (max 50)</span>
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 2-qadam: preview + tahrir */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Preview — tasdiqlashdan oldin family / kategoriya / uslubni tekshiring
              </p>
              {rows.map((row, idx) => (
                <div
                  key={`${row.file.name}-${idx}`}
                  className={`rounded-lg border p-3 ${
                    row.item.valid ? "border-border" : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground" title={row.file.name}>
                      {row.file.name}
                    </span>
                    {row.item.valid ? (
                      <span className="flex items-center gap-1 text-[11px] text-primary">
                        <Check className="h-3 w-3" /> O'qildi
                      </span>
                    ) : (
                      <span className="text-[11px] text-destructive">{row.item.error || "Yaroqsiz"}</span>
                    )}
                  </div>

                  {row.item.valid && (
                    <>
                      {row.item.preview && (
                        <img
                          src={row.item.preview}
                          alt={`${row.family} preview`}
                          className="mt-2 max-h-20 rounded border bg-white"
                        />
                      )}

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Family</span>
                          <Input
                            value={row.family}
                            onChange={(e) => updateRow(idx, { family: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Kategoriya</span>
                          <Select
                            value={row.category}
                            onValueChange={(v) => updateRow(idx, { category: v as FontCategory })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Uslub</span>
                          <Select
                            value={row.style}
                            onValueChange={(v) => updateRow(idx, { style: v as FontStyleKey })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STYLE_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className={row.item.hasLatin ? "" : "text-destructive"}>
                          Lotin: {row.item.hasLatin ? "bor" : "yo'q"}
                        </span>
                        <span className={row.item.hasCyrillic ? "" : "text-amber-500"}>
                          Kirill: {row.item.hasCyrillic ? "bor" : "yo'q"}
                        </span>
                        {typeof row.item.glyphs === "number" && <span>{row.item.glyphs} glif</span>}
                        {row.item.conflict && (
                          <span className="text-amber-500">
                            "{row.family}" mavjud
                            {row.item.conflictSource === "builtin" ? " (built-in)" : ""} — ustiga
                            yoziladi
                          </span>
                        )}
                      </div>

                      {row.item.warning && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-500">
                          <AlertTriangle className="h-3 w-3" /> {row.item.warning}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={resetSelection} disabled={uploading}>
                  Tozalash
                </Button>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={uploading || validRows.length === 0}
                  onClick={handleUpload}
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Tasdiqlash va yuklash ({validRows.length})
                </Button>
              </div>
            </div>
          )}

          {/* Mavjud user fontlar */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Yuklangan fontlar ({userFonts.length})
            </p>
            {userFonts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Hali font yuklanmagan. Built-in fontlar himoyalangan va bu yerda ko'rsatilmaydi.
              </p>
            ) : (
              <div className="space-y-1.5">
                {userFonts.map((f) => (
                  <div
                    key={f.family}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm" style={{ fontFamily: f.family }}>
                        {f.family}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {categoryLabels[f.category] || f.category}
                        {f.hasCyrillic ? " · Kirill" : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={deleting === f.family}
                      onClick={() => handleDelete(f.family)}
                    >
                      {deleting === f.family ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end border-t bg-card px-5 py-3">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={analyzing || uploading}>
            Yopish
          </Button>
        </div>
      </div>
    </div>
  );
}
