export type FontEntry = {
  family: string;
  category: "comic" | "handwritten" | "title" | "clean";
  hasBold: boolean;
  hasItalic: boolean;
};

export const MANGA_FONTS: FontEntry[] = [
  // Comic / Bubble text
  { family: "Comic Neue", category: "comic", hasBold: true, hasItalic: true },
  { family: "Bangers", category: "comic", hasBold: false, hasItalic: false },
  { family: "Permanent Marker", category: "comic", hasBold: false, hasItalic: false },
  { family: "Pangolin", category: "comic", hasBold: false, hasItalic: false },
  { family: "Luckiest Guy", category: "comic", hasBold: false, hasItalic: false },

  // Handwritten
  { family: "Patrick Hand", category: "handwritten", hasBold: false, hasItalic: false },
  { family: "Caveat", category: "handwritten", hasBold: true, hasItalic: false },
  { family: "Neucha", category: "handwritten", hasBold: false, hasItalic: false },
  { family: "Indie Flower", category: "handwritten", hasBold: false, hasItalic: false },
  { family: "Architects Daughter", category: "handwritten", hasBold: false, hasItalic: false },
  { family: "Gloria Hallelujah", category: "handwritten", hasBold: false, hasItalic: false },
  { family: "Shadows Into Light", category: "handwritten", hasBold: false, hasItalic: false },

  // Title / Display
  { family: "Russo One", category: "title", hasBold: false, hasItalic: false },
  { family: "Bungee", category: "title", hasBold: false, hasItalic: false },
  { family: "Black Ops One", category: "title", hasBold: false, hasItalic: false },

  // Clean / Universal
  { family: "Nunito", category: "clean", hasBold: true, hasItalic: true },
  { family: "Rubik", category: "clean", hasBold: true, hasItalic: true },
  { family: "Arial", category: "clean", hasBold: true, hasItalic: true },
  { family: "serif", category: "clean", hasBold: true, hasItalic: true },
];

const CATEGORY_LABELS: Record<FontEntry["category"], string> = {
  comic: "Komik",
  handwritten: "Qo'lyozma",
  title: "Sarlavha",
  clean: "Oddiy",
};

export function getFontsByCategory() {
  const grouped: Record<string, FontEntry[]> = {};
  for (const font of MANGA_FONTS) {
    const label = CATEGORY_LABELS[font.category];
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(font);
  }
  return grouped;
}

export function getFontEntry(family: string): FontEntry | undefined {
  return MANGA_FONTS.find((f) => f.family === family);
}
