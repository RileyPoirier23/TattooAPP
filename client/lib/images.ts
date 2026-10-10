// Shrinks large photos in the browser before uploading: phone photos are often bigger than the 8 MB limit,
// smaller files upload much faster on mobile data, and the re-drawn copy carries no hidden camera/GPS data.

const MAX_SIDE = 2400;
const LEAVE_ALONE_BELOW = 1.5 * 1024 * 1024;
const UPLOAD_LIMIT = 8 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

export async function prepareImage(file: File): Promise<File> {
  // GIFs may be animated, so they're left as they are.
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file); // applies the photo's rotation
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= LEAVE_ALONE_BELOW) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // PNGs keep transparency (logos); if one is still too big it's a photo, so JPEG is fine.
    let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    let blob = await toBlob(canvas, type, 0.88);
    if (blob && type === 'image/png' && blob.size > UPLOAD_LIMIT) {
      type = 'image/jpeg';
      blob = await toBlob(canvas, type, 0.88);
    }
    if (!blob || (blob.size >= file.size && file.size <= UPLOAD_LIMIT)) return file;
    const name = file.name.replace(/\.[^.]*$/, '') + (type === 'image/png' ? '.png' : '.jpg');
    return new File([blob], name, { type });
  } catch {
    return file; // the server still checks the file
  }
}

export const prepareImages = (files: Iterable<File>) => Promise.all(Array.from(files, prepareImage));
