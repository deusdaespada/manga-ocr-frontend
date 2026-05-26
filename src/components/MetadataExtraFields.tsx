import { Plus, X } from "lucide-react";

import type { AgeRating, AuthorEntry, AuthorRole, MangaStatus, ScheduleDay } from "../lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const AGE_RATINGS: { value: AgeRating; label: string }[] = [
  { value: "all_ages", label: "0+ Hammaga" },
  { value: "10+", label: "10+" },
  { value: "13+", label: "13+" },
  { value: "16+", label: "16+" },
  { value: "18+", label: "18+ Kattalar" },
];

const STATUSES: { value: MangaStatus; label: string }[] = [
  { value: "ongoing", label: "Davom etmoqda" },
  { value: "completed", label: "Tugagan" },
  { value: "hiatus", label: "To'xtatilgan" },
];

const ROLES: { value: AuthorRole; label: string }[] = [
  { value: "story", label: "Story" },
  { value: "art", label: "Art" },
  { value: "story_art", label: "Story & Art" },
  { value: "original", label: "Original" },
];

const SCHEDULE_DAYS: { value: ScheduleDay; label: string }[] = [
  { value: "mon", label: "Du" },
  { value: "tue", label: "Se" },
  { value: "wed", label: "Cho" },
  { value: "thu", label: "Pa" },
  { value: "fri", label: "Ju" },
  { value: "sat", label: "Sha" },
  { value: "sun", label: "Ya" },
];

interface MetadataExtraFieldsProps {
  status: MangaStatus;
  setStatus: (v: MangaStatus) => void;
  ageRating: AgeRating;
  setAgeRating: (v: AgeRating) => void;
  year: string;
  setYear: (v: string) => void;
  rating: string;
  setRating: (v: string) => void;
  scheduleDays: ScheduleDay[];
  setScheduleDays: (v: ScheduleDay[]) => void;
  authors: AuthorEntry[];
  setAuthors: (v: AuthorEntry[]) => void;
}

export default function MetadataExtraFields({
  status,
  setStatus,
  ageRating,
  setAgeRating,
  year,
  setYear,
  rating,
  setRating,
  scheduleDays,
  setScheduleDays,
  authors,
  setAuthors,
}: MetadataExtraFieldsProps) {
  function toggleDay(day: ScheduleDay) {
    if (scheduleDays.includes(day)) {
      setScheduleDays(scheduleDays.filter((d) => d !== day));
    } else {
      setScheduleDays([...scheduleDays, day]);
    }
  }

  function updateAuthor(idx: number, patch: Partial<AuthorEntry>) {
    setAuthors(authors.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function removeAuthor(idx: number) {
    setAuthors(authors.filter((_, i) => i !== idx));
  }

  function addAuthor() {
    if (authors.length >= 10) return;
    setAuthors([...authors, { name: "", role: "story" }]);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as MangaStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Yosh chegarasi</label>
          <Select value={ageRating} onValueChange={(v) => setAgeRating(v as AgeRating)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_RATINGS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Yili</label>
          <Input
            type="number"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2019"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Reyting (0–10)</label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={10}
            step={0.1}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="9.2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Chiqish jadvali</label>
        <div className="flex flex-wrap gap-1.5">
          {SCHEDULE_DAYS.map((d) => {
            const active = scheduleDays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Mualliflar</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addAuthor}
            disabled={authors.length >= 10}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Qo'shish
          </Button>
        </div>
        <div className="space-y-2">
          {authors.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 italic">Muallif qo'shilmagan</p>
          )}
          {authors.map((author, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={author.name}
                onChange={(e) => updateAuthor(idx, { name: e.target.value })}
                placeholder="Ism"
                className="flex-1"
              />
              <Select
                value={author.role}
                onValueChange={(v) => updateAuthor(idx, { role: v as AuthorRole })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAuthor(idx)}
                className="h-9 w-9 p-0 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
