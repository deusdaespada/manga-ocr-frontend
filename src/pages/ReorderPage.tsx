import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Loader2,
  Trash2,
  Merge,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api } from "../lib/api";
import type { PageInfo } from "../lib/types";
import { Button } from "../components/ui/button";

type Mode = "reorder" | "merge";

/* ─── Sortable image card ─── */
function SortablePageCard({
  page,
  index,
}: {
  page: PageInfo;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.filename });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative w-[200px] overflow-hidden rounded-lg border-2 border-transparent hover:border-muted-foreground/30"
    >
      <img
        src={page.image_url}
        alt={page.filename}
        className="block w-full h-auto"
        draggable={false}
      />

      {/* Index badge */}
      <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[10px] font-bold text-white shadow">
        {index + 1}
      </div>

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Filename */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
        <span className="block truncate text-[10px] font-medium text-white/90" dir="rtl">
          {page.filename}
        </span>
      </div>
    </div>
  );
}

/* ─── Static image card for merge mode ─── */
function MergePageCard({
  page,
  index,
  isSelected,
  isRangeStart,
  orderIdx,
  onClick,
}: {
  page: PageInfo;
  index: number;
  isSelected: boolean;
  isRangeStart: boolean;
  orderIdx: number;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative w-[200px] cursor-pointer rounded-lg border-2 transition-all ${
        isRangeStart
          ? "border-blue-500 ring-2 ring-blue-400/40"
          : isSelected
            ? "border-primary ring-2 ring-primary/30"
            : "border-transparent hover:border-muted-foreground/30"
      }`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      <img
        src={page.image_url}
        alt={page.filename}
        className="block w-full h-auto"
        draggable={false}
      />

      {/* Index badge */}
      <div className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow ${
        isSelected ? "bg-primary" : isRangeStart ? "bg-blue-500" : "bg-black/70"
      }`}>
        {isSelected ? orderIdx + 1 : index + 1}
      </div>

      {/* Range start label */}
      {isRangeStart && (
        <div className="absolute left-9 top-1.5 rounded-md bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
          Boshi
        </div>
      )}

      {/* Filename */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
        <span className="block truncate text-[10px] font-medium text-white/90" dir="rtl">
          {page.filename}
        </span>
      </div>
    </div>
  );
}

/* ─── Drag overlay image ─── */
function DragOverlayCard({ page }: { page: PageInfo }) {
  return (
    <div className="w-48 overflow-hidden rounded-lg border-2 border-primary shadow-2xl">
      <img
        src={page.image_url}
        alt={page.filename}
        className="w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

/* ─── Main page ─── */
export default function ReorderPage() {
  const { manga, chapter } = useParams<{ manga: string; chapter: string }>();
  const navigate = useNavigate();

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [merging, setMerging] = useState(false);

  // Mode
  const [mode, setMode] = useState<Mode>("reorder");

  // Reorder state
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [hasReordered, setHasReordered] = useState(false);

  // Merge state
  const [selected, setSelected] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (!manga || !chapter) return;
    loadPages();
  }, [manga, chapter]);

  async function loadPages(silent = false) {
    if (!manga || !chapter) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.getChapterPages(manga, chapter);
      setPages(data.images);
      resetState();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function resetState() {
    setSelected([]);
    setRangeStart(null);
    setHasReordered(false);
    setDragActiveId(null);
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    resetState();
  }

  /* ── Drag & drop handlers ── */
  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragActiveId(null);

    if (!over || active.id === over.id) return;

    setPages((prev) => {
      const oldIndex = prev.findIndex((p) => p.filename === active.id);
      const newIndex = prev.findIndex((p) => p.filename === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setHasReordered(true);
  }

  /* ── Merge selection ── */
  function handleMergeClick(filename: string) {
    if (!rangeStart) {
      setRangeStart(filename);
      setSelected([]);
      return;
    }
    if (rangeStart === filename) {
      setRangeStart(null);
      setSelected([]);
      return;
    }
    const startIdx = pages.findIndex((p) => p.filename === rangeStart);
    const endIdx = pages.findIndex((p) => p.filename === filename);
    if (startIdx < 0 || endIdx < 0) return;

    const from = Math.min(startIdx, endIdx);
    const to = Math.max(startIdx, endIdx);
    const rangeFiles = pages.slice(from, to + 1).map((p) => p.filename);
    setSelected(rangeFiles);
    setRangeStart(null);
  }

  /* ── Actions ── */
  async function handleSaveOrder() {
    if (!manga || !chapter) return;
    setSaving(true);
    try {
      const fullOrder = pages.map((p) => p.filename);
      await api.reorderPages(manga, chapter, fullOrder);
      toast.success("Sahifalar tartibga solindi");
      setHasReordered(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMergeImages() {
    if (!manga || !chapter || selected.length < 2) return;
    if (
      !confirm(
        `${selected.length} ta rasmni bitta rasmga birlashtirilsinmi? (vertikal qo'shiladi)`
      )
    )
      return;

    setMerging(true);
    try {
      const res = await api.mergeImages(manga, chapter, selected);
      toast.success(
        `${res.merged_count} ta rasm birlashtirildi → ${res.merged_into}`
      );
      await loadPages(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMerging(false);
    }
  }

  async function handleDelete() {
    const toDelete = selected.length > 0 ? selected : rangeStart ? [rangeStart] : [];
    if (!manga || !chapter || toDelete.length === 0) return;
    if (
      !confirm(
        `${toDelete.length} ta rasmni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await api.deletePages(manga, chapter, toDelete);
      if (res.chapter_deleted) {
        toast.success("Barcha rasmlar o'chirildi, chapter ham o'chirildi");
        navigate(`/project/${manga}`);
        return;
      }
      toast.success(
        `${res.deleted} ta rasm o'chirildi, ${res.remaining} ta qoldi`
      );
      await loadPages(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const draggedPage = dragActiveId
    ? pages.find((p) => p.filename === dragActiveId)
    : null;

  if (!manga || !chapter) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Sahifa topilmadi</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 space-y-2 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/project/${manga}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">
            Tartib — {chapter}-bob
          </h1>
          <span className="text-xs text-muted-foreground">
            {pages.length} rasm
          </span>
        </div>

        {/* Mode switch + actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={mode === "reorder" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => switchMode("reorder")}
            >
              <GripVertical className="mr-1.5 h-3.5 w-3.5" />
              Tartib
            </Button>
            <Button
              variant={mode === "merge" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => switchMode("merge")}
            >
              <Merge className="mr-1.5 h-3.5 w-3.5" />
              Birlashtirish
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Reorder actions */}
          {mode === "reorder" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPages(true)}
                disabled={!hasReordered}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Qaytarish
              </Button>
              <Button
                size="sm"
                onClick={handleSaveOrder}
                disabled={saving || !hasReordered}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </>
          )}

          {/* Merge actions */}
          {mode === "merge" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSelected([]); setRangeStart(null); }}
                disabled={selected.length === 0 && !rangeStart}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>

              {selected.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMergeImages}
                  disabled={merging}
                >
                  {merging ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Merge className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Birlashtirish ({selected.length})
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || (selected.length === 0 && !rangeStart)}
              >
                {deleting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                O'chirish ({selected.length || (rangeStart ? 1 : 0)})
              </Button>
            </>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground">
          {mode === "reorder"
            ? "Rasmni bosib turib boshqa joyga suring. Tartib o'zgargach Saqlash tugmasini bosing."
            : rangeStart
              ? "Endi tugash rasmini bosing — oradagi barcha rasmlar tanlanadi."
              : "Boshlanish rasmini bosing, keyin tugash rasmini bosing — oraliq avtomatik tanlanadi."}
        </p>
      </div>

      {/* Grid */}
      <div className="p-4">
        {mode === "reorder" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map((p) => p.filename)}
              strategy={rectSortingStrategy}
            >
              <div className="flex flex-wrap gap-3">
                {pages.map((page, i) => (
                  <SortablePageCard
                    key={page.filename}
                    page={page}
                    index={i}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {draggedPage ? <DragOverlayCard page={draggedPage} /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="flex flex-wrap gap-3">
            {pages.map((page, i) => (
              <MergePageCard
                key={page.filename}
                page={page}
                index={i}
                isSelected={selected.includes(page.filename)}
                isRangeStart={rangeStart === page.filename}
                orderIdx={selected.indexOf(page.filename)}
                onClick={() => handleMergeClick(page.filename)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
