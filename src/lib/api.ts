import type {
  GenreOption,
  JobInfo,
  JobStartResponse,
  OcrBackendInfo,
  Project,
  ProjectCreateRequest,
  ProjectMetadataUpdate,
  RestartResponse,
  ResultsData,
  RetranslateRequest,
  RetranslateResponse,
  RunInfo,
  Stats,
  Tag,
  TranslateResponse,
  TranslatorModelsMap,
  UploadResponse,
} from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return (await res.json()) as T;
}

export const api = {
  getProjects(): Promise<Project[]> {
    return fetch("/api/projects").then(handle<Project[]>);
  },
  getProject(slug: string): Promise<Project> {
    return fetch(`/api/projects/${encodeURIComponent(slug)}`).then(handle<Project>);
  },
  saveProjectSettings(slug: string, settings: Record<string, unknown>) {
    return fetch(`/api/projects/${encodeURIComponent(slug)}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then(handle);
  },
  createProject(payload: ProjectCreateRequest): Promise<Project> {
    return fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<Project>);
  },
  updateProjectMetadata(slug: string, metadata: ProjectMetadataUpdate) {
    return fetch(`/api/projects/${encodeURIComponent(slug)}/metadata`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    }).then(handle);
  },
  getTags(): Promise<Tag[]> {
    return fetch("/api/tags").then(handle<Tag[]>);
  },
  getGenres(search = ""): Promise<GenreOption[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return fetch(`/api/options/genres${q}`).then(handle<GenreOption[]>);
  },
  deleteProject(slug: string) {
    return fetch(`/api/projects/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }).then(handle);
  },
  deleteChapter(manga: string, chapter: string) {
    return fetch(`/api/projects/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}`, {
      method: "DELETE",
    }).then(handle);
  },
  getStats(): Promise<Stats> {
    return fetch("/api/stats").then(handle<Stats>);
  },
  getOcrBackends(): Promise<OcrBackendInfo[]> {
    return fetch("/api/ocr-backends").then(handle<OcrBackendInfo[]>);
  },
  getTranslatorModels(): Promise<TranslatorModelsMap> {
    return fetch("/api/translator-models").then(handle<TranslatorModelsMap>);
  },
  uploadFiles(slug: string, files: File[]): Promise<UploadResponse> {
    const form = new FormData();
    for (const f of files) {
      form.append("files", f);
    }
    return fetch(
      `/api/upload?manga_slug=${encodeURIComponent(slug)}`,
      { method: "POST", body: form }
    ).then(handle<UploadResponse>);
  },
  startJob(payload: Record<string, unknown>): Promise<JobStartResponse> {
    return fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<JobStartResponse>);
  },
  getJobs(): Promise<JobInfo[]> {
    return fetch("/api/jobs").then(handle<JobInfo[]>);
  },
  getJob(jobId: string): Promise<JobInfo> {
    return fetch(`/api/jobs/${encodeURIComponent(jobId)}`).then(handle<JobInfo>);
  },
  cancelJob(jobId: string) {
    return fetch(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
    }).then(handle);
  },
  restartJob(jobId: string): Promise<RestartResponse> {
    return fetch(`/api/jobs/${encodeURIComponent(jobId)}/restart`, {
      method: "POST",
    }).then(handle<RestartResponse>);
  },
  translateManga(payload: Record<string, unknown>): Promise<TranslateResponse> {
    return fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<TranslateResponse>);
  },
  translateChapter(payload: Record<string, unknown>): Promise<TranslateResponse> {
    return fetch("/api/translate-chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<TranslateResponse>);
  },
  getResults(manga: string, chapter: string): Promise<ResultsData> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}`).then(
      handle<ResultsData>
    );
  },
  getRunInfo(manga: string, chapter: string): Promise<RunInfo | null> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/run-info`).then(
      (res) => (res.ok ? (res.json() as Promise<RunInfo>) : null)
    );
  },
  addRegion(manga: string, chapter: string, pageIdx: number, payload: Record<string, unknown>) {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/regions/${pageIdx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle);
  },
  deleteRegion(manga: string, chapter: string, pageIdx: number, regionIdx: number) {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/regions/${pageIdx}/${regionIdx}`, {
      method: "DELETE",
    }).then(handle);
  },
  updateRegion(manga: string, chapter: string, pageIdx: number, regionIdx: number, payload: Record<string, unknown>) {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/regions/${pageIdx}/${regionIdx}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle);
  },
  inpaintArea(manga: string, chapter: string, pageIdx: number, bbox: { x: number; y: number; w: number; h: number }): Promise<{ ok: boolean; image_url: string }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/clean/${pageIdx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox }),
    }).then(handle<{ ok: boolean; image_url: string }>);
  },
  inpaintMask(manga: string, chapter: string, pageIdx: number, maskBase64: string): Promise<{ ok: boolean; image_url: string }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/clean-mask/${pageIdx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mask: maskBase64 }),
    }).then(handle<{ ok: boolean; image_url: string }>);
  },
  drawBubble(manga: string, chapter: string, pageIdx: number, bbox: { x: number; y: number; w: number; h: number }, shape: "rect" | "oval"): Promise<{ ok: boolean; image_url: string }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/draw-bubble/${pageIdx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox, shape }),
    }).then(handle<{ ok: boolean; image_url: string }>);
  },
  undoClean(manga: string, chapter: string, pageIdx: number): Promise<{ ok: boolean; image_url: string }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/clean-undo/${pageIdx}`, {
      method: "POST",
    }).then(handle<{ ok: boolean; image_url: string }>);
  },
  reocrPage(manga: string, chapter: string, pageIdx: number): Promise<{ ok: boolean; updated: number }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/reocr-page/${pageIdx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backend: "openai" }),
    }).then(handle<{ ok: boolean; updated: number }>);
  },
  reocrRegion(manga: string, chapter: string, pageIdx: number, regionIdx: number): Promise<{ ok: boolean; text: string }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/reocr-region`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_idx: pageIdx, region_idx: regionIdx, backend: "openai" }),
    }).then(handle<{ ok: boolean; text: string }>);
  },
  ocrBbox(manga: string, chapter: string, pageIdx: number, bbox: { x: number; y: number; w: number; h: number }): Promise<{ ok: boolean; region_idx: number; text: string }> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/ocr-bbox/${pageIdx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox }),
    }).then(handle<{ ok: boolean; region_idx: number; text: string }>);
  },
  retranslateRegions(manga: string, chapter: string, payload: RetranslateRequest): Promise<RetranslateResponse> {
    return fetch(`/api/results/${encodeURIComponent(manga)}/${encodeURIComponent(chapter)}/retranslate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<RetranslateResponse>);
  },
};
