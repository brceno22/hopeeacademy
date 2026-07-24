import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SubmitLessonDto } from '../common/dto/moodle-actions.dto';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':id/pages')
  async getLessonPages(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.getLessonPages(id);
  }

  @Post(':id/submit')
  async submitLesson(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitLessonDto,
  ) {
    return this.lessonsService.submitLessonAnswers(id, body.respuestas, body.token);
  }
}
