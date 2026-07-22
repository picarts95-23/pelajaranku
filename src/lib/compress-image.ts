/**
 * Kompresi gambar di sisi klien sebelum upload.
 * Menghemat biaya storage & bandwidth (Lovable Cloud) dan mempercepat upload di HP.
 *
 * Default: maks 1600px sisi terpanjang, JPEG kualitas 0.72.
 * Rata-rata foto tugas 3–5 MB dari HP → ~150–400 KB setelah dikompresi.
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number; mimeType?: string } = {},
): Promise<File> {
  const { maxDim = 1600, quality = 0.72, mimeType = "image/jpeg" } = opts;

  // Lewati file kecil (<300KB) atau non-gambar; tidak worth-kan biaya CPU.
  if (!file.type.startsWith("image/") || file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmapSafe(file);
    if (!bitmap) return file;

    const { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mimeType, quality),
    );
    if (!blob || blob.size >= file.size) return file; // tidak ada penghematan
    const ext = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] ?? "jpg";
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.${ext}`, { type: mimeType });
  } catch {
    return file;
  }
}

async function createImageBitmapSafe(file: File): Promise<ImageBitmap | null> {
  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file);
    }
  } catch {
    // fallback via <img>
  }
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // @ts-expect-error HTMLImageElement is drawable; typed as ImageBitmap for signature
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
