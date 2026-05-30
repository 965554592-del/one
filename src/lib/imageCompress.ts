/**
 * Browser-side image compression + WebP conversion.
 *
 * For supported image inputs (JPEG / PNG / WebP / GIF first frame / BMP):
 *   1. Decode via HTMLImageElement.
 *   2. Downscale to MAX_DIM on the longest side if larger.
 *   3. Re-encode to WebP at QUALITY (or JPEG fallback if WebP unsupported).
 *   4. Return a new File with the same base name + new extension.
 *
 * If the file isn't a supported image, or compression would actually make
 * the file bigger (e.g. tiny icons), the original File is returned untouched.
 */

const MAX_DIM = 1440;        // px on the longest side (covers most desktops, saves ~44% pixels vs 1920)
const QUALITY = 0.82;        // 0..1 — 0.82 is a good size/quality tradeoff
const MIN_SAVING_BYTES = 5 * 1024; // don't bother if saving < 5 KB

const COMPRESSIBLE = /^image\/(jpeg|jpg|png|webp|bmp)$/i;

function canEncodeWebP(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Compress an image to a specific max dimension. Used to generate responsive
 * variants (e.g. 768px for mobile). Returns null if compression fails or isn't worth it.
 */
export async function compressImageToSize(file: File, maxDim: number, quality = QUALITY): Promise<File | null> {
  if (!file || !file.type || !COMPRESSIBLE.test(file.type)) return null;
  try {
    const img = await loadImage(file);
    const { width: w0, height: h0 } = img;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    if (scale >= 1) return null; // already smaller than target
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const useWebP = canEncodeWebP();
    const targetType = useWebP ? 'image/webp' : 'image/jpeg';
    const targetExt = useWebP ? 'webp' : 'jpg';
    const blob = await canvasToBlob(canvas, targetType, quality);
    if (!blob) return null;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}-${maxDim}w.${targetExt}`, { type: targetType, lastModified: Date.now() });
  } catch {
    return null;
  }
}

/**
 * Compress an image File. Returns the original if not compressible or no win.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file || !file.type || !COMPRESSIBLE.test(file.type)) return file;

  try {
    const img = await loadImage(file);
    const { width: w0, height: h0 } = img;
    if (!w0 || !h0) return file;

    const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const useWebP = canEncodeWebP();
    const targetType = useWebP ? 'image/webp' : 'image/jpeg';
    const targetExt = useWebP ? 'webp' : 'jpg';

    const blob = await canvasToBlob(canvas, targetType, QUALITY);
    if (!blob) return file;

    // Skip if compression didn't save anything meaningful.
    if (file.size - blob.size < MIN_SAVING_BYTES) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const newName = `${baseName}.${targetExt}`;
    return new File([blob], newName, { type: targetType, lastModified: Date.now() });
  } catch (err) {
    console.warn('[imageCompress] failed, using original:', err);
    return file;
  }
}
