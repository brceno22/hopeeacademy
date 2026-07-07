import { Controller, Get, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { MicrolearningService } from './microlearning.service';
import { MicrolearningContent } from './microlearning-content.entity';


@Controller('microlearning')
export class MicrolearningController {
  constructor(private readonly microlearningService: MicrolearningService) {}

  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }
    return authHeader.split(' ')[1];
  }

  @Get('today')
  async getTodayContent(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    return this.microlearningService.getTodayContent(token);
  }

  @Post('complete')
  async markAsCompleted(
    @Body('contentId') contentId: number,
    @Headers('authorization') authHeader: string
  ) {
    const token = this.extractToken(authHeader);
    return this.microlearningService.markAsCompleted(token, contentId);
  }

  // Endpoint para que cargues contenido por Postman (sin Auth para que te sea fácil por ahora)
  @Post('admin/create')
  async createContent(@Body() body: any) {
    return this.microlearningService.createAdminContent(body);
  }
  
  @Post('admin/bulk')
  async createBulkContent(@Body() contents: any[]) {
    // Ahora llamamos al servicio, NO al repo directamente
    return this.microlearningService.createBulkContent(contents);
  }
}