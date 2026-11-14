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
