import { useCallback, useEffect, useState } from "react";

import { api } from "../lib/api";
import type { FontInfo, FontStyleKey } from "../lib/types";

// Built-in fontlar uchun @font-face globals.css'da statik yozilgan. User
// (yuklangan) fontlar esa backend `fonts/` katalogida. Ularni FAQAT CSS
// @font-face bilan e'lon qilish KIFOYA EMAS: HTML canvas (editor preview /
// publish renderer) faqat allaqachon YUKLANGAN fontni chizadi va @font-face'ni
// o'zi yuklamaydi. Shuning uchun FontFace API bilan haqiqatan yuklab,
// `document.fonts`ga qo'shamiz — shunda ham DOM, ham canvas ko'radi.

const STYLE_DESCRIPTORS: Record<FontStyleKey, { style: string; weight: string }> = {
  normal: { style: "normal", weight: "400" },
  bold: { style: "normal", weight: "700" },
  italic: { style: "italic", weight: "400" },
  "bold-italic": { style: "italic", weight: "700" },
};

// Yuklangan FontFace'lar — key: `family|style|weight`. Qayta yuklamaslik va
// o'chirilgan fontni document.fonts'dan olib tashlash uchun saqlanadi.
const _loadedFaces = new Map<string, FontFace>();

function syncUserFontFaces(fonts: FontInfo[]): void {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  // Kerakli (family|style|weight) -> URL ro'yxatini yig'amiz.
  const wanted = new Map<string, { family: string; url: string; style: string; weight: string }>();
  for (const f of fonts) {
    if (f.source !== "user") continue;
    for (const key of Object.keys(STYLE_DESCRIPTORS) as FontStyleKey[]) {
      const filename = f.files?.[key];
      if (!filename) continue;
      const desc = STYLE_DESCRIPTORS[key];
      const k = `${f.family}|${desc.style}|${desc.weight}`;
      if (wanted.has(k)) continue;
      wanted.set(k, {
        family: f.family,
        url: `/api/fonts/file/${encodeURIComponent(filename)}`,
        style: desc.style,
        weight: desc.weight,
      });
    }
  }

  // Endi kerak bo'lmagan (o'chirilgan) fontlarni document.fonts'dan olib tashlash.
  for (const [k, face] of _loadedFaces) {
    if (!wanted.has(k)) {
      try {
        document.fonts.delete(face);
      } catch {
        /* ignore */
      }
      _loadedFaces.delete(k);
    }
  }

  // Yangi fontlarni yuklab, qo'shish.
  for (const [k, w] of wanted) {
    if (_loadedFaces.has(k)) continue;
    try {
      const face = new FontFace(w.family, `url("${w.url}")`, {
        style: w.style,
        weight: w.weight,
        display: "swap",
      });
      _loadedFaces.set(k, face);
      document.fonts.add(face);
      // Yuklab bo'lgach subscriber'larni xabardor qilamiz (UI/canvas qayta render).
      face
        .load()
        .then(() => notify())
        .catch(() => {
          // Yuklanmasa — qo'shilganini olib tashlaymiz (canvas fallback ishlatadi).
          try {
            document.fonts.delete(face);
          } catch {
            /* ignore */
          }
          _loadedFaces.delete(k);
        });
    } catch {
      _loadedFaces.delete(k);
    }
  }
}

// Modul darajasidagi kesh — bir nechta komponent baravar chaqirsa ham bitta
// so'rov yuboriladi va @font-face bir marta inject qilinadi.
let _cache: FontInfo[] | null = null;
let _roleDefaults: Record<string, string> = {};
let _categoryLabels: Record<string, string> = {};
let _inflight: Promise<FontInfo[]> | null = null;
const _subscribers = new Set<() => void>();

function notify() {
  for (const fn of _subscribers) fn();
}

async function loadFonts(force = false): Promise<FontInfo[]> {
  if (_cache && !force) return _cache;
  if (_inflight && !force) return _inflight;
  _inflight = api
    .getFonts()
    .then((res) => {
      _cache = res.fonts;
      _roleDefaults = res.role_defaults || {};
      _categoryLabels = res.category_labels || {};
      syncUserFontFaces(res.fonts);
      notify();
      return res.fonts;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
}

export type UseFontsResult = {
  fonts: FontInfo[];
  roleDefaults: Record<string, string>;
  categoryLabels: Record<string, string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // Yangi/o'chgan fontlardan keyin keshni darhol yangilash (so'rovsiz).
  setFonts: (fonts: FontInfo[]) => void;
};

export function useFonts(): UseFontsResult {
  const [, forceRender] = useState(0);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = () => forceRender((n) => n + 1);
    _subscribers.add(sub);
    if (!_cache) {
      setLoading(true);
      loadFonts()
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }
    return () => {
      _subscribers.delete(sub);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadFonts(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const setFonts = useCallback((fonts: FontInfo[]) => {
    _cache = fonts;
    syncUserFontFaces(fonts);
    notify();
  }, []);

  return {
    fonts: _cache ?? [],
    roleDefaults: _roleDefaults,
    categoryLabels: _categoryLabels,
    loading,
    error,
    refresh,
    setFonts,
  };
}
