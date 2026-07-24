import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import { extractBearerToken } from '../auth/auth-token.util';
import { MarkProgressDto } from './dto/mark-progress.dto';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('mark')
  async markAsCompleted(
    @Body() body: MarkProgressDto,
    @Headers('authorization') authHeader: string,
  ) {
    const token = extractBearerToken(authHeader);
    return this.progressService.markAsCompleted(token, body.courseId, body.moduleId, body.type);
  }

  @Get('global')
  async getGlobalProgress(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.progressService.getGlobalProgress(token);
  }

  @Get('course/:courseId')
  async getCourseProgress(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Headers('authorization') authHeader: string,
  ) {
    const token = extractBearerToken(authHeader);
    return this.progressService.getCourseProgress(token, courseId);
  }
}
