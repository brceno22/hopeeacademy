import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';

@Controller('files')
export class FilesController {
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

    if (parsed.origin !== moodleOrigin) {
      throw new BadRequestException('Solo se permiten archivos del host de Moodle configurado');
    }

    const path = parsed.pathname.toLowerCase();
    if (!path.includes('pluginfile.php')) {
      throw new BadRequestException('Solo se permiten URLs de pluginfile de Moodle');
    }

    return parsed;
  }

  @Get('proxy')
  async proxyFile(
    @Query('url') url: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!url?.trim()) {
      throw new BadRequestException('Query param "url" es requerido');
    }
    if (!token?.trim()) {
      throw new UnauthorizedException('Query param "token" es requerido');
    }

    const moodleOrigin = this.getMoodleOrigin();
    this.assertAllowedMoodleUrl(url, moodleOrigin);

    // Prefer webservice/pluginfile.php for course files; user icons work on
    // plain pluginfile.php + token (webservice path 404s / access denied).
    let fileUrl = url
      .replace(/[?&]forcedownload=1/g, '')
      .replace(/([?&])token=[^&]*/g, '')
      .replace(/[?&]$/, '');

    const isUserIcon = /\/user\/icon\//i.test(fileUrl);
    if (
      !isUserIcon &&
      fileUrl.includes('pluginfile.php') &&
      !fileUrl.includes('/webservice/')
    ) {
      fileUrl = fileUrl.replace('/pluginfile.php', '/webservice/pluginfile.php');
    }

    const separator = fileUrl.includes('?') ? '&' : '?';
    fileUrl = `${fileUrl}${separator}token=${encodeURIComponent(token)}`;

    try {
      const fileRes = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(fileUrl, {
          responseType: 'arraybuffer',
          maxRedirects: 5,
          timeout: 30_000,
          validateStatus: (status) => status < 500,
        }),
      );

      if (fileRes.status === 401 || fileRes.status === 403) {
        res.status(401).json({ message: 'Token inválido o sin permiso para el archivo' });
        return;
      }

      if (fileRes.status >= 400) {
        res.status(502).json({ message: 'Moodle no pudo servir el archivo' });
        return;
      }

      const contentType =
        (fileRes.headers['content-type'] as string) || 'application/octet-stream';
      const body = Buffer.from(fileRes.data);

      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        res.status(401).json({ message: 'Sesión inválida o archivo no accesible' });
        return;
      }

      // Moodle sometimes returns JSON error with a misleading content-type
      if (body.length < 512 && body.toString('utf8').trimStart().startsWith('{')) {
        res.status(401).json({ message: 'Sesión inválida o archivo no accesible' });
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      res.status(502).json({ message: 'No se pudo cargar el archivo', detail: message });
    }
  }
}
