import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import FormData from 'form-data';
import { firstValueFrom } from 'rxjs';
import { MoodleExceptionPayload, MoodleParams } from './moodle.types';

@Injectable()
export class MoodleClientService {
  private readonly logger = new Logger(MoodleClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async request<T = unknown>(
    wsFunction: string,
    extraParams: MoodleParams = {},
    userToken?: string,
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('MOODLE_URL');
    if (!baseUrl) {
      throw new BadGatewayException('MOODLE_URL no está configurada');
    }

    const token = userToken || this.configService.get<string>('MOODLE_TOKEN');
    if (!token) {
      throw new UnauthorizedException('Token de Moodle no disponible');
    }

    const paramsObjeto: Record<string, string> = {
      wstoken: token,
      wsfunction: wsFunction,
      moodlewsrestformat: 'json',
    };

    for (const [key, value] of Object.entries(extraParams)) {
      if (value === undefined || value === null) continue;
      paramsObjeto[key] = String(value);
    }

    const urlFinal = `${baseUrl}?${new URLSearchParams(paramsObjeto).toString()}`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<T | MoodleExceptionPayload>(urlFinal),
      );
      this.assertNoMoodleException(data, wsFunction);
      return data as T;
    } catch (error: unknown) {
      throw this.mapError(error, wsFunction);
    }
  }

  async requestPostForm<T = unknown>(
    wsFunction: string,
    extraParams: MoodleParams = {},
    userToken?: string,
  ): Promise<T> {
    const baseUrl = this.configService.get<string>('MOODLE_URL') ?? '';
    if (!baseUrl) {
      throw new BadGatewayException('MOODLE_URL no está configurada');
    }

    const token = userToken ?? this.configService.get<string>('MOODLE_TOKEN') ?? '';
    if (!token) {
      throw new UnauthorizedException('Token de Moodle no disponible');
    }

    const form = new FormData();
    form.append('wstoken', token);
    form.append('wsfunction', wsFunction);
    form.append('moodlewsrestformat', 'json');

    for (const [key, value] of Object.entries(extraParams)) {
      if (value === undefined || value === null) continue;
      form.append(key, String(value));
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<T | MoodleExceptionPayload>(baseUrl, form, {
          headers: form.getHeaders(),
        }),
      );
      this.assertNoMoodleException(data, wsFunction);
      return data as T;
    } catch (error: unknown) {
      throw this.mapError(error, wsFunction);
    }
  }

  private assertNoMoodleException(data: unknown, wsFunction: string): void {
    if (!data || typeof data !== 'object') return;
    const payload = data as MoodleExceptionPayload;
    if (!payload.exception && !payload.errorcode) return;

    const code = (payload.errorcode || payload.exception || '').toLowerCase();
    const message = payload.message || 'Error en Moodle Web Services';

    this.logger.warn(`Moodle [${wsFunction}] exception: ${code} — ${message}`);

    // Enrolment often succeeds; Moodle then fails sending welcome/notification email.
    if (this.isMessageNotSentNoise(wsFunction, code, message)) {
      this.logger.warn(
        `Moodle [${wsFunction}]: ignoring notification failure (enrolment likely OK)`,
      );
      return;
    }

    if (
      code.includes('invalidtoken') ||
      code.includes('accessexception') ||
      code.includes('invalid_token') ||
      message.toLowerCase().includes('invalid token')
    ) {
      throw new UnauthorizedException('Sesión de Moodle inválida o expirada');
    }

    if (
      code.includes('coursenotfound') ||
      code.includes('invalidrecord') ||
      code.includes('notfound') ||
      message.toLowerCase().includes('not found')
    ) {
      throw new NotFoundException(message);
    }

    if (
      code.includes('notenrolled') ||
      code.includes('requirelogin') ||
      message.toLowerCase().includes('not enrolled')
    ) {
      throw new UnauthorizedException('No estás matriculado o no tenés permiso para este recurso');
    }

    if (
      code.includes('cannotcreatediscussion') ||
      code.includes('cannotadddiscussion') ||
      message.toLowerCase().includes('could not create new discussion')
    ) {
      throw new ForbiddenException(
        'No se pudo crear la discusión en Moodle. Revisá permisos del foro, grupos y que no sea solo de avisos.',
      );
    }

    if (
      code.includes('nopostforum') ||
      code.includes('cannotreply') ||
      code.includes('cannotaddpost') ||
      message.toLowerCase().includes('not allowed to post')
    ) {
      throw new ForbiddenException(
        'No tenés permiso para responder en este foro. En Moodle: el foro de Announcements (news) no admite replies de alumnos; en foros normales revisá mod/forum:replypost y el modo de grupos.',
      );
    }

    throw new BadGatewayException({
      message: `Error de Moodle: ${message}`,
      errorcode: payload.errorcode,
      wsFunction,
    });
  }

  /** SMTP/notification failures after enrol_manual — not a real enrolment failure. */
  private isMessageNotSentNoise(wsFunction: string, code: string, message: string): boolean {
    if (wsFunction !== 'enrol_manual_enrol_users' && wsFunction !== 'enrol_manual_unenrol_users') {
      return false;
    }
    const text = `${code} ${message}`.toLowerCase();
    return text.includes('message was not sent') || text.includes('error/message was not sent');
  }

  /** Traduce un fallo de transporte a la HttpException equivalente. */
  mapError(error: unknown, wsFunction: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const axiosError = error as AxiosError;
    const code = axiosError?.code || '';
    const status = axiosError?.response?.status;

    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED'
    ) {
      this.logger.error(`Moodle unreachable [${wsFunction}]: ${code}`);
      return new BadGatewayException(
        'No se pudo conectar con Moodle. Verificá que el servicio esté disponible.',
      );
    }

    if (status === 401 || status === 403) {
      return new UnauthorizedException('Acceso denegado por Moodle');
    }

    if (status === 404) {
      return new NotFoundException('Recurso no encontrado en Moodle');
    }

    const message =
      axiosError?.message ||
      (error instanceof Error ? error.message : 'Error de conexión con Moodle');

    this.logger.error(`Moodle [${wsFunction}] failed: ${message}`);
    return new BadGatewayException(`Error al comunicarse con Moodle: ${message}`);
  }
}
