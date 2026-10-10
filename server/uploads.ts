// Image uploads stored on disk under DATA_DIR/uploads and served from /uploads.
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from './config';
import { newId } from './db';
import { badRequest } from './http';

const MAX_BYTES = 8 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  // Cap text fields too, otherwise one request with thousands of huge fields could exhaust memory.
  limits: { fileSize: MAX_BYTES, files: 6, fields: 20, fieldSize: 64 * 1024, fieldNameSize: 100, parts: 30 },
});

/** Limits how many upload requests one account (or one visitor) can make, so nobody can fill the disk. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.isProduction ? 60 : 10_000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => (req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip || '')}`),
  message: { error: "You've uploaded a lot of images in the last hour. Please wait a bit and try again." },
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

/** Reads the Orientation tag (1–8) from an EXIF APP1 payload ("Exif\0\0" + TIFF data); 1 when absent. */
function exifOrientation(payload: Buffer): number {
  if (payload.subarray(0, 6).toString('latin1') !== 'Exif\0\0') return 1;
  const tiff = payload.subarray(6);
  if (tiff.length < 8) return 1;
  const le = tiff.toString('latin1', 0, 2) === 'II';
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const ifd = le ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4);
  if (ifd + 2 > tiff.length) return 1;
  for (let n = 0, count = u16(ifd); n < count; n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > tiff.length) break;
    if (u16(entry) === 0x0112) {
      const v = u16(entry + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** A minimal EXIF segment holding only the Orientation tag, so phone photos still display the right way up. */
function orientationSegment(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // first IFD right after the header
  tiff.writeUInt16BE(1, 8); // one entry:
  tiff.writeUInt16BE(0x0112, 10); // Orientation
  tiff.writeUInt16BE(3, 12); // SHORT
  tiff.writeUInt32BE(1, 14); // count
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt32BE(0, 22); // no next IFD
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

/**
 * Removes hidden metadata from a JPEG — EXIF/XMP (camera details, often the GPS location where the photo was
 * taken), IPTC and comments — keeping only the orientation. Returns the original if the file looks unusual.
 */
export function stripJpegMetadata(buf: Buffer): Buffer {
  try {
    const out: Buffer[] = [buf.subarray(0, 2)];
    let insertAt = 1;
    let orientation = 1;
    let i = 2;
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff) return buf;
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++; // padding
        continue;
      }
      if (marker === 0xda) {
        // Start of the image data: everything from here on is kept as is.
        if (orientation !== 1) out.splice(insertAt, 0, orientationSegment(orientation));
        out.push(buf.subarray(i));
        return Buffer.concat(out);
      }
      if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
        out.push(buf.subarray(i, i + 2));
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2 || i + 2 + len > buf.length) return buf;
      const segment = buf.subarray(i, i + 2 + len);
      if (marker === 0xe1) {
        if (orientation === 1) orientation = exifOrientation(segment.subarray(4));
      } else if (marker !== 0xed && marker !== 0xfe) {
        out.push(segment);
        if (marker === 0xe0) insertAt = out.length; // EXIF belongs right after the JFIF header
      }
      i += 2 + len;
    }
    return buf;
  } catch {
    return buf;
  }
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
  fs.writeFileSync(path.join(dir, name), ext === 'jpg' ? stripJpegMetadata(file.buffer) : file.buffer);
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
