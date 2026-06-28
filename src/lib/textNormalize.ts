// Render uchun matnni font qo'llab-quvvatlaydigan belgilarga normalizatsiya.
// Backend `manga_pipeline/text_normalize.py` bilan AYNAN bir xil — editor
// preview (canvas) = publish (Pillow renderer) bo'lishi uchun SHART.
//
// Anime Ace (default dialog fonti) atigi ~107 ta belgini qo'llaydi. Fontda
// yo'q Unicode belgilar (oʻ/gʻ modifier apostrofi U+02BB/U+02BC, em-dash,
// yapon tinish belgilari va h.k.) tofu (□) bo'lib chiqmasligi uchun keng
// qo'llanadigan ASCII ekvivalentiga almashtiriladi.

// Belgi -> almashtiruvchi(lar). text_normalize.py `_CHAR_MAP` nusxasi.
const CHAR_MAP: Record<string, string> = {
  // Apostrof / modifier harflar (oʻ, gʻ, taʼlim)
  "\u02bb": "'",
  "\u02bc": "'",
  "\u02b9": "'",
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u2032": "'",
  "\u0060": "'",
  "\u00b4": "'",
  // Qo'shtirnoq
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u2033": '"',
  "\u00ab": '"',
  "\u00bb": '"',
  // Tire / chiziqlar
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2212": "-",
  // Uch nuqta
  "\u2026": "...",
  // Bo'shliqlar
  "\u00a0": " ",
  "\u3000": " ",
  "\u200b": "",
  // Yapon / CJK tinish belgilari (OCR qoldig'i)
  "\u3001": ",",
  "\u3002": ".",
  "\u300c": '"',
  "\u300d": '"',
  "\u300e": '"',
  "\u300f": '"',
  "\u3008": "<",
  "\u3009": ">",
  "\u30fb": " ",
  "\u301c": "~",
  "\uff5e": "~",
};

/**
 * Matndagi fontda yo'q (tofu) belgilarni xavfsiz ASCII'ga almashtiradi.
 * Ikki bosqich (backend bilan bir xil):
 *   1. Fullwidth ASCII (U+FF01..U+FF5E) -> oddiy ASCII (cp - 0xFEE0).
 *   2. Qolgan maxsus belgilar `CHAR_MAP` bo'yicha almashtiriladi.
 */
export function normalizeForFont(text: string): string {
  if (!text) return text;
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xff01 && cp <= 0xff5e) {
      out += String.fromCodePoint(cp - 0xfee0);
      continue;
    }
    const repl = CHAR_MAP[ch];
    out += repl === undefined ? ch : repl;
  }
  return out;
}
