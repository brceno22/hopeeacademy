import { HttpService } from '@nestjs/axios/dist/http.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';

@Injectable()
export class AuthService {
  constructor (
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ){}

  async login(username: string, password: string) {
    let baseUrl = this.configService.get<string>('MOODLE_URL') || '';
    const urlLimpia = baseUrl.split('/webservice')[0];
    const urlFinal = `${urlLimpia}/login/token.php`;

    try {
      // 1. Obtener token
      const params = new URLSearchParams({ username, password, service: 'api_libre_dev' });
      const { data } = await firstValueFrom(
        this.httpService.get(`${urlFinal}?${params.toString()}`),
      );

      if (data?.error) {
        throw new UnauthorizedException('Usuario o contraseña incorrectos');
      }

      // 2. Obtener info del usuario con el token recién generado
      const infoParams = new URLSearchParams({
        wstoken: data.token,
        wsfunction: 'core_webservice_get_site_info',
        moodlewsrestformat: 'json',
      });

      const { data: siteInfo } = await firstValueFrom(
        this.httpService.get(`${baseUrl}?${infoParams.toString()}`),
      );
      console.log('🔑 TOKEN GENERADO:', data.token);

      return {
        message: 'Login exitoso',
        moodleToken: data.token,
        userId: siteInfo.userid,       // 👈 ID real del alumno en Moodle
        fullName: siteInfo.fullname,   // 👈 nombre completo
      };

    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('No se pudo validar las credenciales');
    }
  }
  

}
