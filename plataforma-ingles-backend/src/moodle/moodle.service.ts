import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MoodleService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async request(
    wsFunction: string,
    extraParams: Record<string, any> = {},
    userToken?: string,
  ) {
    const baseUrl = this.configService.get<string>('MOODLE_URL');
    const token = userToken || this.configService.get<string>('MOODLE_TOKEN');

    const paramsObjeto: Record<string, any> = {
      wstoken: token,
      wsfunction: wsFunction,
      moodlewsrestformat: 'json',
      ...extraParams,
    };

    const urlFinal = `${baseUrl}?${new URLSearchParams(paramsObjeto).toString()}`;

    try {
      const { data } = await firstValueFrom(this.httpService.get(urlFinal));

      console.log(`📡 Moodle [${wsFunction}] respuesta:`, JSON.stringify(data).slice(0, 300));

      if (data?.exception) {
        throw new HttpException(
          `Moodle Error: ${data.message} | debuginfo: ${data.debuginfo ?? 'ninguno'}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return data;

    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error de conexión con Moodle';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async requestPostForm(
    wsFunction: string,
    extraParams: Record<string, any> = {},
    userToken?: string,
    ) {
    const baseUrl = this.configService.get<string>('MOODLE_URL') ?? '';
    const token = userToken ?? this.configService.get<string>('MOODLE_TOKEN') ?? '';
    console.log('📤 Params enviados:', JSON.stringify(extraParams).slice(0, 200));

    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('wstoken', token);
    form.append('wsfunction', wsFunction);
    form.append('moodlewsrestformat', 'json');

    for (const [key, value] of Object.entries(extraParams)) {
      form.append(key, String(value));
    }

    try {
      const { data } = await firstValueFrom(
          this.httpService.post(baseUrl, form, {
            headers: form.getHeaders(),
          })
        );

      console.log(`📡 Moodle FORM [${wsFunction}] respuesta:`, JSON.stringify(data).slice(0, 300));

      if (data?.exception) {
        throw new HttpException(
          `Moodle Error: ${data.message} | debuginfo: ${data.debuginfo ?? 'ninguno'}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      

      return data;

      } catch (error: unknown) {
        if (error instanceof HttpException) throw error;
        const message = error instanceof Error ? error.message : 'Error de conexión con Moodle';
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }
}