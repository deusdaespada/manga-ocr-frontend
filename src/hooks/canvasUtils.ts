export function setupCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.style.width = `${img.clientWidth}px`;
  canvas.style.height = `${img.clientHeight}px`;
}

export function getCanvasCoords(canvas: HTMLCanvasElement, e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}
