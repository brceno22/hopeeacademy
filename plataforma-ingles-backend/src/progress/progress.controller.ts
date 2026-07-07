import { Controller, Post, Get, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticación de Moodle');
    }
    return authHeader.split(' ')[1];
  }

  // A. Marcar módulo
  @Post('mark')
  async markAsCompleted(
    @Body('courseId') courseId: number,
    @Body('moduleId') moduleId: number,
    @Body('type') type: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.progressService.markAsCompleted(token, courseId, moduleId, type);
  }

  // C. Progreso Global (Nota: lo pongo arriba de :courseId para que Nest no lo confunda con un ID)
  @Get('global')
  async getGlobalProgress(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    return this.progressService.getGlobalProgress(token);
  }

  // B. Progreso Específico
  @Get('course/:courseId')
  async getCourseProgress(
    @Param('courseId') courseId: number,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.progressService.getCourseProgress(token, courseId);
  }
}