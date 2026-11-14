export interface CropArea {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

export interface CropParams {
  imageWidth: number;
  imageHeight: number;
  cropWidth: number;
  cropHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Escala base necesaria para que la imagen cubra por completo el área de recorte
 * sin dejar bordes vacíos (comportamiento "cover").
 */
export function getCoverScale(
  imageWidth: number,
  imageHeight: number,
  cropWidth: number,
  cropHeight: number,
): number {
  if (imageWidth <= 0 || imageHeight <= 0 || cropWidth <= 0 || cropHeight <= 0) {
    return 1;
  }
  return Math.max(cropWidth / imageWidth, cropHeight / imageHeight);
}

/**
 * Desplazamiento máximo permitido (en píxeles del viewport) para que la imagen
 * nunca se despegue de los bordes del recorte.
 */
export function getMaxOffset(params: Omit<CropParams, 'offsetX' | 'offsetY'>): {
  maxOffsetX: number;
  maxOffsetY: number;
} {
  const baseScale = getCoverScale(
    params.imageWidth,
    params.imageHeight,
    params.cropWidth,
    params.cropHeight,
  );
  const safeZoom = clamp(params.zoom, MIN_ZOOM, MAX_ZOOM);
  const renderedWidth = params.imageWidth * baseScale * safeZoom;
  const renderedHeight = params.imageHeight * baseScale * safeZoom;

  return {
    maxOffsetX: Math.max(0, (renderedWidth - params.cropWidth) / 2),
    maxOffsetY: Math.max(0, (renderedHeight - params.cropHeight) / 2),
  };
}

export function clampOffset(
  offsetX: number,
  offsetY: number,
  params: Omit<CropParams, 'offsetX' | 'offsetY'>,
): { offsetX: number; offsetY: number } {
  const { maxOffsetX, maxOffsetY } = getMaxOffset(params);
  return {
    offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
  };
}

/**
 * Convierte el zoom y desplazamiento del usuario en coordenadas exactas sobre
 * la imagen original para dibujar el recorte final en un canvas.
 */
export function computeSourceCropArea(params: CropParams): CropArea {
  const { imageWidth, imageHeight, cropWidth, cropHeight } = params;
  const safeZoom = clamp(params.zoom, MIN_ZOOM, MAX_ZOOM);
  const baseScale = getCoverScale(imageWidth, imageHeight, cropWidth, cropHeight);
  const totalScale = baseScale * safeZoom;

  const renderedWidth = imageWidth * totalScale;
  const renderedHeight = imageHeight * totalScale;
  const { offsetX, offsetY } = clampOffset(params.offsetX, params.offsetY, {
    imageWidth,
    imageHeight,
    cropWidth,
    cropHeight,
    zoom: safeZoom,
  });

  const imgLeft = (cropWidth - renderedWidth) / 2 + offsetX;
  const imgTop = (cropHeight - renderedHeight) / 2 + offsetY;

  const sWidth = Math.min(imageWidth, cropWidth / totalScale);
  const sHeight = Math.min(imageHeight, cropHeight / totalScale);
  const sx = clamp(-imgLeft / totalScale, 0, Math.max(0, imageWidth - sWidth));
  const sy = clamp(-imgTop / totalScale, 0, Math.max(0, imageHeight - sHeight));

  return { sx, sy, sWidth, sHeight };
}

/**
 * Renderiza el área recortada de una imagen a un data URL JPEG listo para guardar.
 */
export async function renderCroppedImage(
  image: HTMLImageElement,
  params: CropParams,
  outputWidth: number,
  outputHeight: number,
  quality = 0.85,
): Promise<string> {
  const { sx, sy, sWidth, sHeight } = computeSourceCropArea(params);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo de recorte.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, outputWidth, outputHeight);

  return canvas.toDataURL('image/jpeg', quality);
}
