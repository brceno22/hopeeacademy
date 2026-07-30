import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Logger,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import {
  candidatePluginfileBases,
  originsEquivalent,
  rewriteToMoodleOrigin,
} from './files-url.util';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private getMoodleOrigin(): string {
    const moodleUrl = this.configService.get<string>('MOODLE_URL') || '';
    if (!moodleUrl) {
      throw new BadRequestException('MOODLE_URL no está configurada');
    }
    try {
      const cleaned = moodleUrl.split('/webservice')[0].replace(/\/$/, '');
      return new URL(cleaned).origin;
    } catch {
      throw new BadRequestException('MOODLE_URL inválida');
    }
  }

  private assertAllowedMoodleUrl(fileUrl: string, moodleOrigin: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      throw new BadRequestException('URL de archivo inválida');
    }

    if (!originsEquivalent(parsed.origin, moodleOrigin)) {
      throw new BadRequestException('Solo se permiten archivos del host de Moodle configurado');
    }

    if (!parsed.pathname.toLowerCase().includes('pluginfile.php')) {
      throw new BadRequestException('Solo se permiten URLs de pluginfile de Moodle');
    }

    return parsed;
  }

  private cleanPluginfileUrl(url: string): string {
    const u = new URL(url);
    u.searchParams.delete('forcedownload');
    u.searchParams.delete('token');
    let out = u.toString();
    if (out.endsWith('?')) out = out.slice(0, -1);
    return out;
  }

  private withToken(baseUrl: string, token: string): string {
    const u = new URL(baseUrl);
    u.searchParams.set('token', token);
    return u.toString();
  }

  private isUsableFileBody(status: number, contentType: string, body: Buffer): boolean {
    if (status === 401 || status === 403 || status >= 400) return false;
    if (!body.length) return false;
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return false;
    }
    if (body.length < 512 && body.toString('utf8').trimStart().startsWith('{')) {
      return false;
    }
    const head = body.subarray(0, 200).toString('utf8').toLowerCase();
    if (head.includes('<!doctype html') || head.includes('<html')) return false;
    return true;
  }

  private async fetchMoodleFile(fileUrl: string): Promise<{
    status: number;
    contentType: string;
    body: Buffer;
  } | null> {
    try {
      const fileRes = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(fileUrl, {
          responseType: 'arraybuffer',
          maxRedirects: 5,
          timeout: 30_000,
          validateStatus: (status) => status < 500,
        }),
      );
      const contentTypeRaw =
        (fileRes.headers['content-type'] as string) || 'application/octet-stream';
      return {
        status: fileRes.status,
        contentType: contentTypeRaw.split(';')[0].trim().toLowerCase(),
        body: Buffer.from(fileRes.data),
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Moodle file fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  @Get('proxy')
  async proxyFile(
    @Query('url') url: string,
    @Query('token') tokenQuery: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    if (!url?.trim()) {
      throw new BadRequestException('Query param "url" es requerido');
    }

    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const userToken = (tokenQuery || bearer || '').trim();
    if (!userToken) {
      throw new UnauthorizedException('Token requerido (query token o Authorization Bearer)');
    }

    const moodleOrigin = this.getMoodleOrigin();
    this.assertAllowedMoodleUrl(url, moodleOrigin);

    const rewritten = rewriteToMoodleOrigin(url, moodleOrigin);
    const cleaned = this.cleanPluginfileUrl(rewritten);
    const isUserIcon = /\/user\/icon\//i.test(cleaned);
    const bases = candidatePluginfileBases(cleaned, isUserIcon);

    const serviceToken = (this.configService.get<string>('MOODLE_TOKEN') || '').trim();
    const tokens = Array.from(new Set([userToken, serviceToken].filter((t) => t.length > 0)));

    let lastHint = 'Moodle no devolvió el archivo';

    for (const token of tokens) {
      for (const base of bases) {
        const fileUrl = this.withToken(base, token);
        const fetched = await this.fetchMoodleFile(fileUrl);
        if (!fetched) {
          lastHint = 'No se pudo contactar Moodle para el archivo';
          continue;
        }

        if (!this.isUsableFileBody(fetched.status, fetched.contentType, fetched.body)) {
          const snippet = fetched.body.subarray(0, 180).toString('utf8').replace(/\s+/g, ' ');
          lastHint = `Moodle rechazó el archivo (${fetched.status}, ${fetched.contentType}): ${snippet.slice(0, 120)}`;
          this.logger.warn(`files/proxy miss: ${lastHint}`);
          continue;
        }

        let contentType = fetched.contentType;
        const looksPdf =
          contentType === 'application/pdf' ||
          /\.pdf(\?|$)/i.test(url) ||
          fetched.body.subarray(0, 4).toString('utf8') === '%PDF';
        if (looksPdf) contentType = 'application/pdf';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Permitir iframe desde el front (Helmet frameguard está off; CSP frame-ancestors en main)
        res.removeHeader('X-Frame-Options');
        res.send(fetched.body);
        return;
      }
    }

    res.status(401).json({
      message: 'Sesión inválida o archivo no accesible',
      detail: lastHint,
    });
  }
}
