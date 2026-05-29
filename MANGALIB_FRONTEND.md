# MangaLib Downloader — Frontend integratsiya hujjati

> Backend MangaLib downloader to'liq tayyor. Bu hujjat frontend (`manga-ocr-frontend`,
> React + TS + Vite + Tailwind) uchun **aniq API kontrakti** va integratsiya
> bosqichlarini beradi. Mavjud **MangaDex** UI (search/detail/import) bilan bir xil
> uslubda yoziladi, lekin oqim biroz boshqacha (pastga qarang).

---

## 1. Oqim (MangaDex'dan farqi)

| | MangaDex | **MangaLib** |
|---|---|---|
| Boshlanish | Alohida search page → manga tanlash → import | Manga **avval qo'lda yaratiladi** |
| Link | — | Manga sahifasida **link biriktiriladi** (`/attach`) |
| Bob ro'yxati | Har safar API'dan feed | **DB ga saqlanadi** (attach paytida), keyin tez o'qiladi |
| Yuklash | Import chapter/manga | Saqlangan ro'yxatdan **xohlagan boblarni** download |
| Auto-pilot | — | Yangi **`enable_mangalib_download`** bosqichi |

**Foydalanuvchi qadamlari:**
1. Mangani odatdagidek yaratadi (`NewProjectPage`, o'zgarmaydi).
2. `ProjectPage` da **"MangaLib link biriktirish"** — URL qo'yadi → `/attach`.
   Biriktirilganda cover avtomat R2 ga chiqadi va boblar ro'yxati DB ga saqlanadi.
3. **"MangaLib boblari"** modal/panel — saqlangan ro'yxatni ko'rsatadi, bob tanlab
   `/download` qiladi (diapazon / aniq boblar / faqat yangilar).
4. (Ixtiyoriy) Auto-pilot modalida **"MangaLib: yangi boblarni yuklash"** belgisi.

---

## 2. API kontrakti

Barcha endpointlar `/api` prefiksida (mavjud `api.ts` bilan bir xil; proxy
allaqachon sozlangan).

### 2.1. `POST /api/mangalib/resolve`
Biriktirishdan oldin URL/slug ni tekshirib seriya preview qaytaradi.

Request:
```json
{ "url_or_slug": "https://mangalib.me/ru/manga/114307--kaoru-hana-wa-rinto-saku?ui=1" }
```
Response (200):
```json
{
  "slug": "114307--kaoru-hana-wa-rinto-saku",
  "title": "Очаровательный цветок расцветает с достоинством",
  "name": "", "rus_name": "...", "eng_name": "Kaoru Hana wa Rin to Saku",
  "summary": "...",
  "cover_url": "https://.../cover.jpg",
  "genres": ["Драма", "Комедия"],
  "tags": ["школа"],
  "authors": ["..."], "artists": ["..."],
  "type_label": "Манга", "status": "Онгоинг", "age_rating": "16+", "year": 2021,
  "chapter_count": 196,
  "first_chapter": 1.0,
  "last_chapter": 181.0
}
```
Xatolar: `400` (yaroqsiz slug), `502/503/429` (upstream).

### 2.2. `POST /api/mangalib/{manga}/attach`
Mavjud loyihaga link biriktiradi. **Cover → R2 deploy** + **katalog → DB**.

Request:
```json
{ "url_or_slug": "114307--kaoru-hana-wa-rinto-saku", "set_language_ru": true }
```
Response (200):
```json
{
  "ok": true,
  "mangalib_slug": "114307--kaoru-hana-wa-rinto-saku",
  "cover_url": "https://cdn.../thumbnails/<manga>/cover_1717000000.jpg",
  "title": "Очаровательный цветок ...",
  "chapter_count": 196,
  "chapters": [ { "number": 1.0, "volume": 1, "name": "...", "chapter_id": "1951251" }, ... ]
}
```
Xatolar:
- `404` — manga topilmadi
- `400` — yaroqsiz slug
- **`409`** — bu MangaLib slug allaqachon boshqa loyihaga biriktirilgan (UNIQUE)
- `502` — MangaLib upstream xato

> `set_language_ru: true` bo'lsa loyiha tili `ru` ga sozlanadi (RU→UZ tarjima uchun).

### 2.3. `DELETE /api/mangalib/{manga}/attach`
Linkni uzadi (slug + saqlangan katalog tozalanadi). Response: `{ "ok": true }`.

### 2.4. `GET /api/mangalib/{manga}/chapters`
DB dagi saqlangan bob ro'yxati + lokal holat. **Tarmoqsiz, tez.**

Response (200):
```json
{
  "mangalib_slug": "114307--...",
  "synced_at": "2026-05-29T22:00:00",
  "max_local_chapter": 12.0,
  "total": 196,
  "results": [
    { "number": 1.0, "volume": 1, "name": "...", "chapter_id": "1951251",
      "imported": true,  "is_new": false },
    { "number": 13.0, "volume": 2, "name": "...", "chapter_id": "...",
      "imported": false, "is_new": true }
  ]
}
```
- `imported` — bu bob lokal loyihada bormi.
- `is_new` — `number > max_local_chapter` (oxirgisidan keyingi).
- Xato `404` — katalog yo'q (avval `/attach` qiling).

### 2.5. `POST /api/mangalib/{manga}/sync`
Remote'dan katalogni qayta yuklab DB ni yangilaydi ("Yangilash" tugmasi).
Response: `{ "ok": true, "chapter_count": 200 }`.

### 2.6. `POST /api/mangalib/{manga}/download`
Tanlangan boblar uchun download job(lar). **Allaqachon mavjud boblar avtomat
chiqarib tashlanadi.**

Request — **bittasini** ishlating:
```jsonc
// a) faqat yangilar (oxirgi lokaldan keyingilar)
{ "only_new": true }

// b) diapazon
{ "from_chapter": 13, "to_chapter": 30 }

// c) aniq boblar
{ "chapter_numbers": [13, 14, 15.5] }
```
Response (200):
```json
{ "status": "started", "job_ids": ["ab12cd34ef56", "..."], "total": 18 }
```
Har bir `job_id` uchun progress — **mavjud `/ws/jobs/{id}`** orqali (pastga qarang).
Xato `400` — yuklab olinadigan yangi bob topilmadi.

### 2.7. WebSocket progress
Yangi WS endpoint **yo'q** — download joblar mavjud `/ws/jobs/{id}` ni ishlatadi.
Xabar formati boshqa joblar bilan bir xil:
```jsonc
{ "type": "log",  "message": "[PROGRESS:42]", "progress": 42 }
{ "type": "log",  "message": "53 ta sahifa yuklandi", "progress": 0 }
{ "type": "done", "message": "Yuklandi: <manga>/013", "progress": 100,
  "manga_slug": "...", "chapter": "013", "page_count": 53 }
{ "type": "error", "message": "...", "progress": 0 }
```
Mavjud `useJobWebSocket(jobId, onMessage)` hookini ishlating.

---

## 3. `api.ts` ga qo'shiladigan metodlar

`// ── MangaDex ──` blokidan keyin `// ── MangaLib ──` bloki qo'shing:

```ts
// ── MangaLib ──────────────────────────────────────────────────────────
resolveMangaLib(urlOrSlug: string): Promise<MangaLibSeries> {
  return fetch("/api/mangalib/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url_or_slug: urlOrSlug }),
  }).then(handle<MangaLibSeries>);
},
attachMangaLib(
  manga: string,
  urlOrSlug: string,
  setLanguageRu = true,
): Promise<MangaLibAttachResponse> {
  return fetch(`/api/mangalib/${encodeURIComponent(manga)}/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url_or_slug: urlOrSlug, set_language_ru: setLanguageRu }),
  }).then(handle<MangaLibAttachResponse>);
},
detachMangaLib(manga: string): Promise<{ ok: boolean }> {
  return fetch(`/api/mangalib/${encodeURIComponent(manga)}/attach`, {
    method: "DELETE",
  }).then(handle<{ ok: boolean }>);
},
getMangaLibChapters(manga: string): Promise<MangaLibChaptersResponse> {
  return fetch(`/api/mangalib/${encodeURIComponent(manga)}/chapters`)
    .then(handle<MangaLibChaptersResponse>);
},
syncMangaLib(manga: string): Promise<{ ok: boolean; chapter_count: number }> {
  return fetch(`/api/mangalib/${encodeURIComponent(manga)}/sync`, {
    method: "POST",
  }).then(handle<{ ok: boolean; chapter_count: number }>);
},
downloadMangaLib(
  manga: string,
  payload: MangaLibDownloadRequest,
): Promise<MangaLibDownloadResponse> {
  return fetch(`/api/mangalib/${encodeURIComponent(manga)}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handle<MangaLibDownloadResponse>);
},
```

---

## 4. `types.ts` ga qo'shiladigan tiplar

```ts
export type MangaLibSeries = {
  slug: string;
  title: string;
  name: string;
  rus_name: string;
  eng_name: string;
  summary: string;
  cover_url: string;
  genres: string[];
  tags: string[];
  authors: string[];
  artists: string[];
  type_label: string;
  status: string;
  age_rating: string;
  year: number | null;
  chapter_count: number;
  first_chapter: number | null;
  last_chapter: number | null;
};

export type MangaLibChapterEntry = {
  number: number;
  volume: number;
  name: string;
  chapter_id: string;
  imported: boolean;
  is_new: boolean;
};

export type MangaLibChaptersResponse = {
  mangalib_slug: string;
  synced_at: string;
  max_local_chapter: number | null;
  total: number;
  results: MangaLibChapterEntry[];
};

export type MangaLibAttachResponse = {
  ok: boolean;
  mangalib_slug: string;
  cover_url: string;
  title: string;
  chapter_count: number;
  chapters: Array<{
    number: number;
    volume: number;
    name: string;
    chapter_id: string;
  }>;
};

export type MangaLibDownloadRequest = {
  only_new?: boolean;
  from_chapter?: number | null;
  to_chapter?: number | null;
  chapter_numbers?: number[];
};

export type MangaLibDownloadResponse = {
  status: "started";
  job_ids: string[];
  total: number;
};
```

### AutoPilotConfig ni yangilash
```ts
export type AutoPilotConfig = {
  enable_mangalib_download?: boolean;   // YANGI
  enable_auto_merge: boolean;
  enable_ocr: boolean;
  enable_translate: boolean;
  enable_publish: boolean;
  force_ocr?: boolean;
  force_clean?: boolean;
};
```
(`AutoPilotStartResponse.config` ham `enable_mangalib_download` qaytaradi —
ixtiyoriy qo'shing.)

---

## 5. UI komponentlari (tavsiya)

### 5.1. `ProjectPage` da link holati
`Project.metadata.mangalib_slug` (backend `metadata` ichida qaytaradi) bo'yicha:
- **Bo'sh** → "MangaLib link biriktirish" tugmasi → modal (URL input + Resolve preview).
- **Mavjud** → "MangaLib boblari" tugmasi + "Linkni uzish".

> Eslatma: `Project` tipiga `metadata.mangalib_slug?: string | null` qo'shing
> (backend `asdict(metadata)` da keladi).

### 5.2. `MangaLibAttachModal.tsx` (yangi)
- URL/slug input.
- "Tekshir" → `api.resolveMangaLib(url)` → preview (cover, title, chapter_count).
- "Biriktirish" → `api.attachMangaLib(slug, url)`:
  - `409` bo'lsa: "Bu slug allaqachon boshqa loyihaga biriktirilgan" xabarini ko'rsating.
  - Muvaffaqiyat → modalni yoping, `ProjectPage` ni qayta yuklang (cover yangilanadi).

### 5.3. `MangaLibChaptersModal.tsx` (yangi)
- Ochilganda `api.getMangaLibChapters(slug)`.
- Jadval: number / volume / name / holat badge (`imported` ✓ / `is_new` 🆕).
- Yuqorida tugmalar:
  - **"Yangi boblarni tanlash"** → `is_new` larni checkbox bilan belgilash.
  - **Diapazon** inputlari (`from` / `to`).
  - **"Yangilash"** → `api.syncMangaLib(slug)` → ro'yxatni qayta yuklash.
- "Yuklash" → `api.downloadMangaLib(slug, payload)` → `job_ids` qaytadi.
  - Har `job_id` ni mavjud `useJobWebSocket` bilan kuzating yoki
    `JobsPage`/`JobProgressCard` orqali ko'rsating (MangaDex import bilan bir xil).

### 5.4. `AutoPilotModal.tsx` ga checkbox
- "MangaLib: yangi boblarni yuklash" → `config.enable_mangalib_download`.
- Faqat `metadata.mangalib_slug` mavjud bo'lsa ko'rsating (aks holda disabled).
- Progress: mavjud `useAutoPilotWebSocket` da `stage: "mangalib_download"` xabarlari
  keladi (`stage_started` / `log` / `stage_done`). `AutoPilotProgress` ga shu
  stage uchun label qo'shing: "⬇️ MangaLib yuklash".

---

## 6. Eslatmalar / qirralar (edge cases)

- **Slug unique:** bitta MangaLib slug faqat bitta loyihaga. `attach` `409`
  bersa foydalanuvchiga aniq xabar bering.
- **Bob nomi:** lokal bob nomi = MangaLib raqami (`005`, `005.5`). Frontda
  `number` ni `String(number)` yoki `number.toFixed()` bilan ko'rsating; lokal
  chapter bilan moslashda `imported` bayrog'iga ishoning (backend hisoblaydi).
- **Til:** attach `set_language_ru: true` bilan `ru` ga o'tadi. Foydalanuvchi
  Settings'da o'zgartira oladi.
- **Cover:** attach paytida R2 ga chiqadi (R2 sozlanmagan bo'lsa lokal
  `/files/data/<slug>/cover.jpg`). `cover_url` javobda qaytadi —
  `ProjectPage`/`MetadataSidebar` ni yangilang.
- **Katalog eskirishi:** yangi boblar chiqsa "Yangilash" (`/sync`) kerak;
  auto-pilot download bosqichi har safar DB katalogdan o'qiydi.
- **Progress polling:** download joblar `/ws/jobs/{id}` da; ko'p bob tanlansa
  `total` ta job qaytadi — `JobsPage` da hammasi ko'rinadi.

---

## 7. Tez boshlash (minimal)

1. `types.ts` ga 4-bo'limdagi tiplarni qo'shing.
2. `api.ts` ga 3-bo'limdagi metodlarni qo'shing.
3. `ProjectPage` ga "MangaLib link biriktirish" tugmasi + `MangaLibAttachModal`.
4. Biriktirilgach "MangaLib boblari" tugmasi + `MangaLibChaptersModal`
   (`getMangaLibChapters` → tanlash → `downloadMangaLib`).
5. (Ixtiyoriy) `AutoPilotModal` ga `enable_mangalib_download` checkbox.

Backend endpointlari tayyor va tekshirilgan; frontend faqat shu kontraktga
ulanadi.
