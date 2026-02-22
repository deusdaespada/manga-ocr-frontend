import type { Region } from "./types";

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      let chunk = "";
      for (const ch of word) {
        const chunkTest = chunk + ch;
        if (ctx.measureText(chunkTest).width <= maxWidth) {
          chunk = chunkTest;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildFontString(
  fontStyle: string,
  fontWeight: string,
  fontSize: number,
  fontFamily: string,
): string {
  // CSS font shorthand: [style] [weight] size family
  const style = fontStyle === "italic" ? "italic" : "normal";
  const weight = fontWeight === "normal" ? "400" : "bold";
  return `${style} ${weight} ${fontSize}px '${fontFamily}', 'Comic Neue', sans-serif`;
}

export function drawTranslatedTexts(ctx: CanvasRenderingContext2D, regions: Region[]) {
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  regions.forEach((r) => {
    if (!r.uz_text) return;
    const text = r.uz_text.toUpperCase().trim();
    if (!text) return;

    const padding = 6;
    const boxWidth = Math.max(10, r.bbox.w);
    const boxHeight = Math.max(10, r.bbox.h);
    const maxWidth = Math.max(10, boxWidth - padding * 2);
    const maxHeight = Math.max(10, boxHeight - padding * 2);

    const fontWeight = r.font_weight || "bold";
    const fontStyle = r.font_style || "normal";
    const fontFamily = r.font_family || "Comic Neue";

    let fontSize: number;
    if (r.font_size) {
      fontSize = r.font_size;
    } else {
      fontSize = Math.floor(Math.min(32, Math.max(12, boxHeight * 0.55)));
    }
    ctx.font = buildFontString(fontStyle, fontWeight, fontSize, fontFamily);
    let lines = wrapText(ctx, text, maxWidth);
    let lineHeight = Math.floor(fontSize * 1.2);

    if (!r.font_size) {
      while (fontSize > 10 && lines.length * lineHeight > maxHeight) {
        fontSize -= 1;
        lineHeight = Math.floor(fontSize * 1.2);
        ctx.font = buildFontString(fontStyle, fontWeight, fontSize, fontFamily);
        lines = wrapText(ctx, text, maxWidth);
      }
    }

    const totalTextHeight = lines.length * lineHeight;
    const startY = r.bbox.y + padding + Math.max(0, (maxHeight - totalTextHeight) / 2);

    ctx.save();
    const rot = r.rotation || 0;
    if (rot) {
      const cx = r.bbox.x + boxWidth / 2;
      const cy = r.bbox.y + boxHeight / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rot * Math.PI / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.beginPath();
    ctx.rect(r.bbox.x, r.bbox.y, boxWidth, boxHeight);
    ctx.clip();
    const fontColor = r.font_color || "#111827";
    ctx.fillStyle = fontColor.startsWith("#") ? fontColor : `rgba(17, 24, 39, 0.92)`;
    lines.forEach((line, idx) => {
      ctx.fillText(line, r.bbox.x + boxWidth / 2, startY + idx * lineHeight);
    });
    ctx.restore();
  });
}

/**
 * Sahifani yuqori sifatda export qilish uchun — rasm + matn overlay
 * Fontlar yuklangandan keyin chaqirilishi kerak
 */
export async function renderPageForExport(
  imageUrl: string,
  regions: Region[],
): Promise<HTMLCanvasElement> {
  // Fontlar tayyor bo'lishini kutish
  await document.fonts.ready;

  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  drawTranslatedTexts(ctx, regions);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
