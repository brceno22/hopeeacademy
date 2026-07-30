import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { MarkProgressDto } from './dto/mark-progress.dto';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(MoodleAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('mark')
  async markAsCompleted(@Body() body: MarkProgressDto, @CurrentUser() user: MoodleUser) {
    return this.progressService.markAsCompleted(
      user.token,
      body.courseId,
      body.moduleId,
      body.type,
      user.userId,
    );
  }

  @Get('global')
  async getGlobalProgress(@CurrentUser() user: MoodleUser) {
    return this.progressService.getGlobalProgress(user.token, user.userId);
  }

  @Get('course/:courseId')
  async getCourseProgress(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.progressService.getCourseProgress(user.token, courseId, user.userId);
  }
}
