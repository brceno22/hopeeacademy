import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { SubmitLessonDto } from '../common/dto/moodle-actions.dto';
import { LessonsService } from './lessons.service';

@Controller('lessons')
@UseGuards(MoodleAuthGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':id/pages')
  async getLessonPages(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.lessonsService.getLessonPages(id, user.token);
  }

  @Post(':id/submit')
  async submitLesson(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitLessonDto,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.lessonsService.submitLessonAnswers(id, body.respuestas, user.token);
  }
}
