const MAX_PROOF_BYTES = 3 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const INITIAL_QUALITY = 0.82;
const MIN_QUALITY = 0.5;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer el archivo del comprobante.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir el comprobante.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('No se pudo leer el comprobante comprimido.'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el comprobante comprimido.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressPaymentProofImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El comprobante debe ser una imagen (JPG, PNG o WebP).');
  }

  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('El comprobante no puede superar 3 MB.');
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo procesar el comprobante en este navegador.');
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > 900_000 && quality > MIN_QUALITY) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > 900_000) {
    throw new Error('El comprobante sigue siendo muy pesado. Usa una foto con menor resolución.');
  }

  return blobToDataUrl(blob);
}
