// Image uploads stored on disk under DATA_DIR/uploads and served from /uploads.
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from './config';
import { newId } from './db';
import { badRequest } from './http';

const MAX_BYTES = 8 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 6 },
});

/** Detect the real image type from the file's first bytes (never trust the browser's mime type). */
function detectImageType(buf: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

/** Saves an uploaded image and returns its public URL (e.g. /uploads/2026-10/abc.jpg). */
export function saveImage(file: Express.Multer.File | undefined): string {
  if (!file) throw badRequest('No image was uploaded.');
  const ext = detectImageType(file.buffer);
  if (!ext) throw badRequest('Please upload a JPG, PNG, GIF or WebP image.');
  const month = new Date().toISOString().slice(0, 7);
  const dir = path.join(config.uploadsDir, month);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${newId()}.${ext}`;
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return `/uploads/${month}/${name}`;
}

/** Deletes a previously uploaded file. Ignores URLs that aren't ours. */
export function deleteUpload(url: string | null | undefined) {
  if (!url || !url.startsWith('/uploads/')) return;
  const rel = url.slice('/uploads/'.length);
  const full = path.resolve(config.uploadsDir, rel);
  if (!full.startsWith(path.resolve(config.uploadsDir) + path.sep)) return;
  fs.rm(full, { force: true }, () => {});
}
