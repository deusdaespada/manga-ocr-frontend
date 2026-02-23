import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useScrollSync(
  originalWrapRef: RefObject<HTMLDivElement | null>,
  cleanWrapRef: RefObject<HTMLDivElement | null>,
  currentPage: number,
) {
  const syncingRef = useRef<"original" | "clean" | null>(null);
  const syncTimeoutRef = useRef<number>(0);

  useEffect(() => {
    const originalWrap = originalWrapRef.current;
    const cleanWrap = cleanWrapRef.current;
    if (!originalWrap || !cleanWrap) return;

    const syncScroll = (
      source: HTMLDivElement,
      target: HTMLDivElement,
      tag: "original" | "clean",
    ) => {
      if (syncingRef.current && syncingRef.current !== tag) return;
      syncingRef.current = tag;

      const sourceMax = source.scrollHeight - source.clientHeight;
      const targetMax = target.scrollHeight - target.clientHeight;

      if (sourceMax > 0 && targetMax > 0) {
        const ratio = source.scrollTop / sourceMax;
        target.scrollTop = Math.round(ratio * targetMax);
      } else {
        target.scrollTop = source.scrollTop;
      }
      target.scrollLeft = source.scrollLeft;

      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
        syncingRef.current = null;
      }, 30);
    };

    const onOriginal = () => syncScroll(originalWrap, cleanWrap, "original");
    const onClean = () => syncScroll(cleanWrap, originalWrap, "clean");

    originalWrap.addEventListener("scroll", onOriginal, { passive: true });
    cleanWrap.addEventListener("scroll", onClean, { passive: true });

    return () => {
      originalWrap.removeEventListener("scroll", onOriginal);
      cleanWrap.removeEventListener("scroll", onClean);
      clearTimeout(syncTimeoutRef.current);
    };
  }, [currentPage]);

  // Sahifa o'zgarganda scrollni reset qilish
  useEffect(() => {
    const originalWrap = originalWrapRef.current;
    const cleanWrap = cleanWrapRef.current;
    if (!originalWrap || !cleanWrap) return;
    originalWrap.scrollTop = 0;
    originalWrap.scrollLeft = 0;
    cleanWrap.scrollTop = 0;
    cleanWrap.scrollLeft = 0;
  }, [currentPage]);
}
