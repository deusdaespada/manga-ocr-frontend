# manga-ocr-frontend

> Web UI for the [manga-ocr](https://github.com/rustammdev/manga-ocr) pipeline — upload manga/manhwa pages, run OCR + translation, and review results.

The frontend pairs with the Python OCR & translation pipeline. It provides a dashboard-style UI for managing projects, browsing chapters, previewing results, and inspecting cleaned/translated pages.

## Features

- **Project dashboard** — folder view with drag-and-drop uploads
- **Chapter browser** — navigate manga series → chapters → pages
- **Results preview** — side-by-side original / cleaned / translated output
- **Dark admin theme** — custom panel with inline edit and confirmations
- **Modal-driven workflow** — compact UX for multi-step operations

## Stack

- **Vite** + **TypeScript**
- **Tailwind CSS**
- Connects to the `manga-ocr` backend

## Getting started

```bash
yarn install
yarn dev
```

Dev server runs on the port configured in `vite.config.ts`.

### Build

```bash
yarn build
yarn preview
```

## Project layout

```
src/
├── components/   # UI components (dashboard, modals, previews)
├── pages/        # Routed views
└── main.tsx      # Entry
```

## Related

- [`manga-ocr`](https://github.com/rustammdev/manga-ocr) — Python OCR + translation pipeline (Japanese/Korean → Uzbek)
