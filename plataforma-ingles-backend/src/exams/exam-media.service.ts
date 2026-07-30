import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
};

const ALLOWED_MIME = new Set([
  ...Object.values(IMAGE_MIME),
  ...Object.values(AUDIO_MIME),
  'audio/x-wav',
  'audio/wave',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
};

const FILENAME_RE = /^[a-f0-9-]{36}\.[a-z0-9]+$/i;

const IMAGE_MAX = 5 * 1024 * 1024;
const AUDIO_MAX = 25 * 1024 * 1024;

@Injectable()
export class ExamMediaService implements OnModuleInit {
  private examsDir!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const root = this.config.get<string>('UPLOADS_DIR') || 'uploads';
    this.examsDir = resolve(process.cwd(), root, 'exams');
    mkdirSync(this.examsDir, { recursive: true });
  }

  getExamsDir(): string {
    return this.examsDir;
  }

  normalizeMediaPath(value: string | null | undefined): string | null {
    const v = value?.trim() || null;
    if (!v) return null;
    if (v.startsWith('/exams/media/')) {
      const name = v.slice('/exams/media/'.length);
      if (!FILENAME_RE.test(name)) {
        throw new BadRequestException('Invalid exam media path');
      }
      return `/exams/media/${name}`;
    }
    throw new BadRequestException(
      'imageUrl/audioUrl must be a Hopee upload path (/exams/media/...)',
    );
  }

  saveUpload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): { url: string } {
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Unsupported file type. Use JPEG/PNG/GIF/WebP or MP3/M4A/WAV/OGG/WebM',
      );
    }

    const isImage = mime.startsWith('image/');
    const max = isImage ? IMAGE_MAX : AUDIO_MAX;
    if (file.size > max) {
      throw new BadRequestException(
        isImage ? 'Image must be at most 5 MB' : 'Audio must be at most 25 MB',
      );
    }

    let ext = EXT_BY_MIME[mime];
    if (!ext) {
      const fromName = extname(file.originalname || '').toLowerCase();
      if (fromName && (IMAGE_MIME[fromName] || AUDIO_MIME[fromName])) {
        ext = fromName === '.jpeg' ? '.jpg' : fromName;
      } else {
        throw new BadRequestException('Could not determine file extension');
      }
    }

    const filename = `${randomUUID()}${ext}`;
    const dest = join(this.examsDir, filename);
    writeFileSync(dest, file.buffer);
    return { url: `/exams/media/${filename}` };
  }

  streamFile(filename: string, res: Response): void {
    if (!FILENAME_RE.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
    const full = join(this.examsDir, filename);
    const resolved = resolve(full);
    if (!resolved.startsWith(this.examsDir) || !existsSync(resolved)) {
      throw new NotFoundException('Media not found');
    }

    const ext = extname(filename).toLowerCase();
    const contentType =
      IMAGE_MIME[ext] || AUDIO_MIME[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    createReadStream(resolved).pipe(res);
  }
}
