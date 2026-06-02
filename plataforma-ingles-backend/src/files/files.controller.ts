import { Controller, Get, Query, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Controller('files')
export class FilesController {
  private sessionCookies: string = '';
  private cookiesExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private async getMoodleSession(): Promise<string> {
    if (this.sessionCookies && Date.now() < this.cookiesExpiry) {
      return this.sessionCookies;
    }

    const moodleBase = 'http://127.0.0.1:8080';
    const adminUser = this.configService.get<string>('MOODLE_ADMIN_USER') ?? 'admin';
    const adminPass = this.configService.get<string>('MOODLE_ADMIN_PASS') ?? 'admin';

    // 1. Obtener logintoken
    const loginPageRes = await firstValueFrom(
      this.httpService.get(`${moodleBase}/login/index.php`, {
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
    );

    const loginTokenMatch = loginPageRes.data.match(/name="logintoken" value="([^"]+)"/);
    const loginToken = loginTokenMatch ? loginTokenMatch[1] : '';
    const initialCookies = (loginPageRes.headers['set-cookie'] as string[] || [])
      .map(c => c.split(';')[0]).join('; ');

    console.log('🔑 loginToken:', loginToken ? 'OK' : 'NO encontrado');

    // 2. POST login
    const params = new URLSearchParams({
      username: adminUser,
      password: adminPass,
      logintoken: loginToken,
      anchor: '',
    });

    const loginRes = await firstValueFrom(
      this.httpService.post(`${moodleBase}/login/index.php`, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': initialCookies,
          'User-Agent': 'Mozilla/5.0',
          'Referer': `${moodleBase}/login/index.php`,
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
      })
    );

    const postCookies = (loginRes.headers['set-cookie'] as string[] || [])
      .map(c => c.split(';')[0]).join('; ');
    
    // Combinamos cookies iniciales + post
    const cookieMap: Record<string, string> = {};
    [...initialCookies.split('; '), ...postCookies.split('; ')].forEach(c => {
      const eqIdx = c.indexOf('=');
      if (eqIdx > 0) {
        const k = c.substring(0, eqIdx).trim();
        const v = c.substring(eqIdx + 1).trim();
        if (k && v) cookieMap[k] = v;
      }
    });
    let currentCookies = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');

    console.log('📄 Login status:', loginRes.status, '| location:', loginRes.headers['location']);

    // 3. Seguir TODOS los redirects manualmente
    let location = loginRes.headers['location'] as string;
    let redirectCount = 0;
    
    while (location && redirectCount < 5) {
      const fullUrl = location.startsWith('http') ? location : `${moodleBase}${location}`;
      console.log(`🔀 Redirect ${redirectCount + 1}:`, fullUrl);

      const redirectRes = await firstValueFrom(
        this.httpService.get(fullUrl, {
          headers: { 
            'Cookie': currentCookies,
            'User-Agent': 'Mozilla/5.0',
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 500,
        })
      );

      const newCookies = (redirectRes.headers['set-cookie'] as string[] || [])
        .map(c => c.split(';')[0]);
      
      newCookies.forEach(c => {
        const eqIdx = c.indexOf('=');
        if (eqIdx > 0) {
          const k = c.substring(0, eqIdx).trim();
          const v = c.substring(eqIdx + 1).trim();
          if (k && v) cookieMap[k] = v;
        }
      });
      currentCookies = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');

      location = redirectRes.headers['location'] as string;
      redirectCount++;
      
      console.log(`📄 Redirect status: ${redirectRes.status} | next: ${location || 'ninguno'}`);
    }

    console.log('🍪 Cookies finales:', currentCookies);

    // 4. Verificar login
    const checkRes = await firstValueFrom(
      this.httpService.get(`${moodleBase}/my/`, {
        headers: { 'Cookie': currentCookies, 'User-Agent': 'Mozilla/5.0' },
        maxRedirects: 5,
      })
    );

    const isLoggedIn = !checkRes.data.includes('name="logintoken"');
    console.log('✅ Login exitoso:', isLoggedIn);

    this.sessionCookies = currentCookies;
    this.cookiesExpiry = Date.now() + 60 * 60 * 1000;
    return this.sessionCookies;
  }

  @Get('proxy')
  async proxyFile(
    @Query('url') url: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    try {
      let fileUrl = url
        .replace('webservice/pluginfile.php', 'pluginfile.php')
        .replace(/[?&]forcedownload=1/g, '');

      console.log('📄 Proxy fetching:', fileUrl);

      const cookies = await this.getMoodleSession();

      const fileRes = await firstValueFrom(
        this.httpService.get(fileUrl, {
          headers: { Cookie: cookies },
          responseType: 'arraybuffer',
          maxRedirects: 5,
        })
      );

      const contentType = (fileRes.headers['content-type'] as string) || 'application/octet-stream';

      if (contentType.includes('text/html')) {
        this.sessionCookies = '';
        res.status(401).json({ error: 'Sesión expirada' });
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(Buffer.from(fileRes.data as ArrayBuffer));

    } catch (error: any) {
      console.error('❌ Error en proxy:', error.message);
      res.status(500).json({ error: 'No se pudo cargar el archivo' });
    }
  }
}