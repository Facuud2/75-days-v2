/**
 * Recorte centrado de una imagen para la previsualización del perfil.
 *
 * Se usa solo en el cliente: el input de archivo entrega un `File` que hay que
 * decodificar antes de poder dibujarlo. El resultado es un data URL pequeño,
 * pensado para mostrar en el preview y no para guardar.
 */
export async function resolveImagePreview(
  src: string | null | undefined,
  width: number,
  height: number,
): Promise<string | null> {
  if (!src) return null;

  const image = new Image();
  // Solo hace falta CORS para las imágenes remotas (stock). Los data URL no lo
  // necesitan y, en algunos navegadores, marcarlos como crossOrigin los invalida.
  if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';

  const loaded = await new Promise<HTMLImageElement | null>((resolve) => {
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

  if (!loaded) return null;

  const sourceWidth = loaded.naturalWidth || loaded.width;
  const sourceHeight = loaded.naturalHeight || loaded.height;
  if (!sourceWidth || !sourceHeight) return null;

  const targetRatio = width / height;
  const sourceRatio = sourceWidth / sourceHeight;
  const cropWidth = sourceRatio > targetRatio ? sourceHeight * targetRatio : sourceWidth;
  const cropHeight = sourceRatio > targetRatio ? sourceHeight : sourceWidth / targetRatio;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(
    loaded,
    (sourceWidth - cropWidth) / 2,
    (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  try {
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    // Un canvas contaminado (imagen remota sin cabeceras CORS) no puede
    // exportarse; el preview simplemente no se muestra.
    return null;
  }
}

export interface CompressedAiImage {
  base64: string;
  mimeType: 'image/jpeg';
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface CompressAiImageOptions {
  maxDimension?: number;
  quality?: number;
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function estimateBase64Bytes(base64: string): number {
  const clean = base64.replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}

function computeBoundedDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  const longestSide = Math.max(sourceWidth, sourceHeight);
  if (longestSide <= maxDimension) {
    return {
      width: Math.max(1, Math.round(sourceWidth)),
      height: Math.max(1, Math.round(sourceHeight)),
    };
  }
  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

/**
 * Comprime y orienta una foto (cámara móvil o galería) para análisis con Gemini Vision.
 * Reduce imágenes de 12MP (~5-8 MB) a ~150-250 KB preservando nitidez de ingredientes.
 */
export async function compressImageForAI(
  file: File | Blob,
  options: CompressAiImageOptions = {},
): Promise<CompressedAiImage> {
  const maxDimension = options.maxDimension ?? 1024;
  const quality = options.quality ?? 0.8;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('compressImageForAI solo puede ejecutarse en el navegador.');
  }

  let drawable: CanvasImageSource | null = null;
  let sourceWidth = 0;
  let sourceHeight = 0;
  let cleanupBitmap: (() => void) | null = null;

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      drawable = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      cleanupBitmap = () => bitmap.close();
    } catch {
      drawable = null;
    }
  }

  if (!drawable) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        img.src = objectUrl;
      });
      drawable = loaded;
      sourceWidth = loaded.naturalWidth || loaded.width;
      sourceHeight = loaded.naturalHeight || loaded.height;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  try {
    if (!sourceWidth || !sourceHeight) {
      throw new Error('Dimensiones de imagen inválidas.');
    }

    const { width, height } = computeBoundedDimensions(sourceWidth, sourceHeight, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el lienzo de compresión.');
    }

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(drawable, 0, 0, width, height);

    const previewUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = stripDataUrlPrefix(previewUrl);
    if (!base64) {
      throw new Error('No se pudo codificar la imagen.');
    }

    return {
      base64,
      mimeType: 'image/jpeg',
      previewUrl,
      width,
      height,
      sizeBytes: estimateBase64Bytes(base64),
    };
  } finally {
    cleanupBitmap?.();
  }
}

/**
 * Captura el frame actual de un <video> (visor en vivo estilo BitePal) y lo exporta
 * listo para enviar a Gemini Vision.
 */
export function captureVideoFrameForAI(
  video: HTMLVideoElement,
  options: CompressAiImageOptions = {},
): CompressedAiImage {
  const maxDimension = options.maxDimension ?? 1024;
  const quality = options.quality ?? 0.82;

  const sourceWidth = video.videoWidth || video.clientWidth;
  const sourceHeight = video.videoHeight || video.clientHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('La cámara todavía no está lista para capturar.');
  }

  const { width, height } = computeBoundedDimensions(sourceWidth, sourceHeight, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo capturar la imagen de la cámara.');
  }

  ctx.drawImage(video, 0, 0, width, height);
  const previewUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = stripDataUrlPrefix(previewUrl);

  return {
    base64,
    mimeType: 'image/jpeg',
    previewUrl,
    width,
    height,
    sizeBytes: estimateBase64Bytes(base64),
  };
}
