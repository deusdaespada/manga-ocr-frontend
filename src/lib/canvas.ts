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

    let fontSize: number;
    if (r.font_size) {
      // Qo'lda belgilangan o'lcham — auto-shrink qilinmaydi
      fontSize = r.font_size;
    } else {
      fontSize = Math.floor(Math.min(32, Math.max(12, boxHeight * 0.55)));
    }
    ctx.font = `700 ${fontSize}px 'Comic Neue'`;
    let lines = wrapText(ctx, text, maxWidth);
    let lineHeight = Math.floor(fontSize * 1.2);

    if (!r.font_size) {
      while (fontSize > 10 && lines.length * lineHeight > maxHeight) {
        fontSize -= 1;
        lineHeight = Math.floor(fontSize * 1.2);
        ctx.font = `700 ${fontSize}px 'Comic Neue'`;
        lines = wrapText(ctx, text, maxWidth);
      }
    }

    const totalTextHeight = lines.length * lineHeight;
    const startY = r.bbox.y + padding + Math.max(0, (maxHeight - totalTextHeight) / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.bbox.x, r.bbox.y, boxWidth, boxHeight);
    ctx.clip();
    ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
    lines.forEach((line, idx) => {
      ctx.fillText(line, r.bbox.x + boxWidth / 2, startY + idx * lineHeight);
    });
    ctx.restore();
  });
}
