import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, AlertCircle } from "lucide-react";

import { api } from "../lib/api";
import type {
  MangaDexManga,
  MangaDexSearchParams,
  MangaDexTag,
} from "../lib/types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const STATUS_OPTIONS = [
  { value: "any", label: "Status — barchasi" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
  { value: "cancelled", label: "Cancelled" },
];

const ORDER_OPTIONS = [
  { value: "relevance", label: "Tartiblash — Relevance" },
  { value: "followedCount", label: "Followers" },
  { value: "rating", label: "Rating" },
  { value: "latestUploadedChapter", label: "Latest chapter" },
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Updated" },
  { value: "title", label: "Title" },
];

const RATING_OPTIONS = [
  { value: "safe", label: "Safe" },
  { value: "suggestive", label: "Suggestive" },
  { value: "erotica", label: "Erotica" },
  { value: "pornographic", label: "Pornographic" },
];

const PAGE_SIZE = 24;

export default function MangaDexSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<MangaDexTag[]>([]);
  const [results, setResults] = useState<MangaDexManga[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [titleInput, setTitleInput] = useState(searchParams.get("title") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "any");
  const [order, setOrder] = useState(searchParams.get("order") ?? "relevance");
  const [tagIds, setTagIds] = useState<string[]>(
    searchParams.get("tags")?.split(",").filter(Boolean) ?? [],
  );
  const [contentRating, setContentRating] = useState<string[]>(
    searchParams.get("rating")?.split(",").filter(Boolean) ?? ["safe", "suggestive"],
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  // Tag picker — kichik dropdown
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => {
    api
      .getMangaDexTags()
      .then((data) => setTags(data.tags))
      .catch(() => setTags([]));
  }, []);

  const params: MangaDexSearchParams = useMemo(
    () => ({
      title: title.trim(),
      tag_ids: tagIds,
      status: status === "any" ? [] : [status],
      content_rating: contentRating,
      order,
      limit: PAGE_SIZE,
      offset,
    }),
    [title, tagIds, status, contentRating, order, offset],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .searchMangaDex(params)
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setTotal(data.total);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "MangaDex'ga ulanib bo'lmadi");
        setResults([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  function applySearch(nextOffset = 0) {
    const next = new URLSearchParams();
    if (titleInput.trim()) next.set("title", titleInput.trim());
    if (status !== "any") next.set("status", status);
    if (order !== "relevance") next.set("order", order);
    if (tagIds.length) next.set("tags", tagIds.join(","));
    if (contentRating.length && contentRating.join(",") !== "safe,suggestive") {
      next.set("rating", contentRating.join(","));
    }
    if (nextOffset > 0) next.set("offset", String(nextOffset));
    setTitle(titleInput.trim());
    setSearchParams(next, { replace: false });
  }

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id].slice(0, 10),
    );
  }

  function toggleRating(value: string) {
    setContentRating((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  }

  const filteredTags = useMemo(() => {
    const query = tagFilter.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(query));
  }, [tags, tagFilter]);

  const hasMore = offset + PAGE_SIZE < total;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Search Manga</h1>
        <p className="page-description">
          MangaDex katalogini qidiring va kerakli boblarni import qiling.
        </p>
      </div>

      {/* Search controls */}
      <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Sarlavha qidiring (1-256 belgi)"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch(0);
            }}
            maxLength={256}
            className="flex-1"
          />
          <Button onClick={() => applySearch(0)} disabled={loading}>
            <SearchIcon className="h-4 w-4" />
            {loading ? "Qidirilmoqda..." : "Qidirish"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={order} onValueChange={setOrder}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-1">
            {RATING_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRating(r.value)}
                className={
                  "rounded-md border px-2 py-1 text-xs transition " +
                  (contentRating.includes(r.value)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tag picker */}
        <details className="rounded-md border border-dashed">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm text-muted-foreground">
            Tag filter — {tagIds.length > 0 ? `${tagIds.length} tanlangan` : "ochish"}
          </summary>
          <div className="space-y-2 p-3 pt-2">
            <Input
              placeholder="Tag qidirish..."
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
            <div className="flex max-h-48 flex-wrap gap-1 overflow-auto">
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={
                    "rounded-full border px-2 py-0.5 text-xs transition " +
                    (tagIds.includes(tag.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent")
                  }
                >
                  {tag.name}
                </button>
              ))}
              {filteredTags.length === 0 && (
                <span className="text-xs text-muted-foreground">Tag topilmadi</span>
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">MangaDex xato</p>
            <p className="text-xs opacity-80">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => applySearch(offset)}
            >
              Qayta urinish
            </Button>
          </div>
        </div>
      )}

      {/* Results grid */}
      {!error && results.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <SearchIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Hech narsa topilmadi
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Boshqa sarlavha yoki filterlarni sinab ko'ring.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {results.map((manga) => (
          <Link
            key={manga.id}
            to={`/mangadex/${manga.id}`}
            className="group flex flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary/50"
          >
            <div className="aspect-[3/4] overflow-hidden bg-muted">
              {manga.cover_thumb_url ? (
                <img
                  src={manga.cover_thumb_url}
                  alt={manga.title_en}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2">
              <p className="truncate text-sm font-medium" title={manga.title_en}>
                {manga.title_en || "Not provided"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {manga.authors[0] || "Not provided"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {manga.status && (
                  <Badge variant="info" className="text-[10px]">{manga.status}</Badge>
                )}
                {manga.local_match_slug && (
                  <Badge variant="success" className="text-[10px]">imported</Badge>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {results.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString()} ta natija — sahifa {currentPage} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => applySearch(Math.max(0, offset - PAGE_SIZE))}
            >
              Oldingi
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore || loading}
              onClick={() => applySearch(offset + PAGE_SIZE)}
            >
              Keyingi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
