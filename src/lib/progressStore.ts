// Uzoq davom etuvchi operatsiyalar (tarjima, publish, auto pilot) progressini
// localStorage'da saqlaydi. Shu orqali sahifa refresh qilinganda yoki boshqa
// pagega o'tib qaytilganda progress bar UI'da qayta tiklanadi. Backend job'i
// davom etayotgani uchun mos WebSocket qayta ulanib, yangilanishlar davom etadi.

const PREFIX = "activeProgress:";
// Eskirgan snapshot'larni cheksiz ko'rsatmaslik uchun yosh chegarasi.
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 soat

export type TranslateSnapshot = {
  jobId: string;
  progress: number;
  message: string;
};

export type PublishSnapshot = {
  publishId: string;
  target: string; // "manga" yoki bob nomi
  progress: number;
  message: string;
  uploadedMb: number;
};

export type AutoPilotSnapshot = {
  autoPilotId: string;
  stage: string | null;
  progress: number;
  message: string;
  chapter: string | null;
};

export type ProgressSnapshot = {
  translate?: TranslateSnapshot;
  publish?: PublishSnapshot;
  autoPilot?: AutoPilotSnapshot;
  updatedAt: number;
};

type ProgressKind = "translate" | "publish" | "autoPilot";

function storageKey(manga: string): string {
  return `${PREFIX}${manga}`;
}

export function loadProgress(manga: string): ProgressSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(manga));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProgressSnapshot;
    if (!parsed.updatedAt || Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      localStorage.removeItem(storageKey(manga));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist(manga: string, snapshot: ProgressSnapshot): void {
  try {
    localStorage.setItem(
      storageKey(manga),
      JSON.stringify({ ...snapshot, updatedAt: Date.now() }),
    );
  } catch {
    // ignore (quota / private mode)
  }
}

/** Bitta operatsiya turini saqlaydi (boshqalariga tegmaydi). */
export function setProgress<K extends ProgressKind>(
  manga: string,
  kind: K,
  value: NonNullable<ProgressSnapshot[K]>,
): void {
  const current = loadProgress(manga) ?? { updatedAt: Date.now() };
  persist(manga, { ...current, [kind]: value });
}

/** Bitta operatsiya turini tozalaydi; hammasi bo'shasa kalitni o'chiradi. */
export function clearProgress(manga: string, kind: ProgressKind): void {
  const current = loadProgress(manga);
  if (!current) return;
  delete current[kind];
  if (!current.translate && !current.publish && !current.autoPilot) {
    try {
      localStorage.removeItem(storageKey(manga));
    } catch {
      // ignore
    }
  } else {
    persist(manga, current);
  }
}
