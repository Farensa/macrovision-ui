export interface LoadedImageInfo {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
}

export function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = () => {
      reject(new Error("Gagal memuat dimensi gambar."));
    };
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<LoadedImageInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          reject(new Error("Gagal membaca berkas gambar."));
          return;
        }
        const dims = await loadImageDimensions(dataUrl);
        resolve({
          dataUrl,
          mimeType: file.type || "image/png",
          width: dims.width,
          height: dims.height,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    reader.readAsDataURL(file);
  });
}

export async function urlToLoadedImage(url: string): Promise<LoadedImageInfo> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Gagal mengambil gambar contoh.");
  }
  const blob = await response.blob();
  const mimeType = blob.type || "image/jpeg";
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Gagal mengonversi gambar ke base64."));
    reader.readAsDataURL(blob);
  });
  const dims = await loadImageDimensions(dataUrl);
  return {
    dataUrl,
    mimeType,
    width: dims.width,
    height: dims.height,
  };
}

export function percentToPixel(
  xPercent: number,
  yPercent: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: Math.round((xPercent / 100) * width),
    y: Math.round((yPercent / 100) * height),
  };
}
