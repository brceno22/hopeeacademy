import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { CreateFileTicketsDto } from './dto/file-ticket.dto';
import { FileTicketService } from './file-ticket.service';
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
    private readonly fileTickets: FileTicketService,
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

  /**
   * Emite tickets de corta duración para consumir /files/proxy desde atributos
   * `src`, donde no se pueden enviar headers. Es batch porque una página de
   * curso puede tener decenas de imágenes.
   */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(MoodleAuthGuard)
  @Post('tickets')
  @HttpCode(HttpStatus.OK)
  async createTickets(
    @Body() body: CreateFileTicketsDto,
    @CurrentUser() user: MoodleUser,
  ): Promise<{ tickets: Record<string, string> }> {
    const moodleOrigin = this.getMoodleOrigin();
    const tickets: Record<string, string> = {};

    for (const url of body.urls) {
      // Rechaza acá lo que no sea pluginfile del Moodle configurado, así el
      // proxy nunca recibe un ticket para una URL arbitraria.
      this.assertAllowedMoodleUrl(url, moodleOrigin);
      tickets[url] = await this.fileTickets.issue({
        fileUrl: url,
        userId: user.userId,
        moodleToken: user.token,
      });
    }

    return { tickets };
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('proxy')
  async proxyFile(@Query('ticket') ticket: string, @Res() res: Response) {
    if (!ticket?.trim()) {
      throw new BadRequestException('Query param "ticket" es requerido');
    }

    const resolved = await this.fileTickets.resolve(ticket.trim());
    if (!resolved) {
      throw new UnauthorizedException('Ticket inválido o expirado');
    }

    const { fileUrl: url, moodleToken } = resolved;

    const moodleOrigin = this.getMoodleOrigin();
    this.assertAllowedMoodleUrl(url, moodleOrigin);

    const rewritten = rewriteToMoodleOrigin(url, moodleOrigin);
    const cleaned = this.cleanPluginfileUrl(rewritten);
    const isUserIcon = /\/user\/icon\//i.test(cleaned);
    const bases = candidatePluginfileBases(cleaned, isUserIcon);

    // Sólo el token del dueño del ticket: usar el MOODLE_TOKEN de servicio como
    // fallback permitiría acceder a archivos ajenos.
    for (const base of bases) {
      const signedUrl = this.withToken(base, moodleToken);
      const fetched = await this.fetchMoodleFile(signedUrl);
      if (!fetched) {
        this.logger.warn('files/proxy: no se pudo contactar Moodle para el archivo');
        continue;
      }

      if (!this.isUsableFileBody(fetched.status, fetched.contentType, fetched.body)) {
        const snippet = fetched.body.subarray(0, 180).toString('utf8').replace(/\s+/g, ' ');
        this.logger.warn(
          `files/proxy miss (${fetched.status}, ${fetched.contentType}): ${snippet.slice(0, 120)}`,
        );
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

    // Sin detalle de la respuesta de Moodle: filtraba fragmentos del upstream.
    res.status(401).json({ message: 'Sesión inválida o archivo no accesible' });
  }
}
