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

  if (typeof loaded.decode === 'function') {
    await loaded.decode().catch(() => undefined);
  }

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
  /** Miniatura cuadrada 160x160 generada directamente desde el mismo canvas. */
  thumbnailUrl: string;
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

function createSquareThumbnailFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  size = 160,
  quality = 0.82,
): string | null {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  if (!sourceWidth || !sourceHeight) return null;

  const cropSide = Math.min(sourceWidth, sourceHeight);
  const sx = (sourceWidth - cropSide) / 2;
  const sy = (sourceHeight - cropSide) / 2;

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = size;
  thumbCanvas.height = size;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (!thumbCtx) return null;

  thumbCtx.fillStyle = '#09090b';
  thumbCtx.fillRect(0, 0, size, size);
  thumbCtx.drawImage(sourceCanvas, sx, sy, cropSide, cropSide, 0, 0, size, size);

  try {
    return thumbCanvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

/**
 * Verifica que `drawImage` haya pintado píxeles reales sobre un canvas transparente.
 * En iOS Safari/WebKit, ciertas rutas (`createImageBitmap` o object URLs revocados
 * antes de rasterizar) fallan en silencio dejando el canvas con alpha=0, que luego
 * `toDataURL('image/jpeg')` convierte en un cuadrado negro sólido.
 */
function hasPaintedPixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  try {
    const steps = 5;
    for (let yi = 0; yi < steps; yi++) {
      const y = Math.min(height - 1, Math.floor(((yi + 0.5) * height) / steps));
      for (let xi = 0; xi < steps; xi++) {
        const x = Math.min(width - 1, Math.floor(((xi + 0.5) * width) / steps));
        const data = ctx.getImageData(x, y, 1, 1).data;
        if (data.length >= 4 && data[3] > 0) {
          return true;
        }
      }
    }
    return false;
  } catch {
    // Entornos sin soporte completo de getImageData (ej. mocks en tests)
    return true;
  }
}

interface DecodedSource {
  drawable: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeImageElement(src: string): Promise<HTMLImageElement> {
  const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    img.src = src;
  });
  if (typeof loaded.decode === 'function') {
    await loaded.decode().catch(() => undefined);
  }
  return loaded;
}

async function loadFromObjectUrl(file: File | Blob): Promise<DecodedSource> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await decodeImageElement(objectUrl);
    return {
      drawable: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function loadFromImageBitmap(file: File | Blob): Promise<DecodedSource> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap unavailable');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  return {
    drawable: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    cleanup: () => bitmap.close(),
  };
}

async function loadFromDataUrl(file: File | Blob): Promise<DecodedSource> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer la imagen seleccionada.'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
  const image = await decodeImageElement(dataUrl);
  return {
    drawable: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    cleanup: () => {},
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

  // En iOS Safari/WebKit, HTMLImageElement con objectUrl + decode() es mucho más
  // confiable para fotos de galería (HEIC/12MP+) que createImageBitmap, y nunca
  // debemos revocar el objectUrl hasta después de drawImage + toDataURL.
  const loaders: Array<() => Promise<DecodedSource>> = [
    () => loadFromObjectUrl(file),
    () => loadFromImageBitmap(file),
    () => loadFromDataUrl(file),
  ];

  let lastError: unknown = null;

  for (const load of loaders) {
    let source: DecodedSource | null = null;
    try {
      source = await load();
      if (!source.width || !source.height) {
        throw new Error('Dimensiones de imagen inválidas.');
      }

      const { width, height } = computeBoundedDimensions(
        source.width,
        source.height,
        maxDimension,
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo inicializar el lienzo de compresión.');
      }

      // Dibujamos primero sobre canvas transparente para detectar fallos silenciosos
      // de rasterización (alpha=0 en todo el lienzo) antes de rellenar el fondo.
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(source.drawable, 0, 0, width, height);

      if (!hasPaintedPixels(ctx, width, height)) {
        lastError = new Error('La imagen seleccionada se decodificó vacía.');
        continue;
      }

      // Relleno detrás de píxeles transparentes (ej. PNG con transparencia) para JPEG.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      const previewUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = stripDataUrlPrefix(previewUrl);
      if (!base64) {
        throw new Error('No se pudo codificar la imagen.');
      }

      const thumbnailUrl = createSquareThumbnailFromCanvas(canvas, 160, 0.82) ?? previewUrl;

      return {
        base64,
        mimeType: 'image/jpeg',
        previewUrl,
        thumbnailUrl,
        width,
        height,
        sizeBytes: estimateBase64Bytes(base64),
      };
    } catch (err) {
      lastError = err;
    } finally {
      source?.cleanup();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No se pudo leer la imagen seleccionada.');
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
  const thumbnailUrl = createSquareThumbnailFromCanvas(canvas, 160, 0.82) ?? previewUrl;

  return {
    base64,
    mimeType: 'image/jpeg',
    previewUrl,
    thumbnailUrl,
    width,
    height,
    sizeBytes: estimateBase64Bytes(base64),
  };
}
