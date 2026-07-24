import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CreateExamDto, SubmitExamDto, UpdateExamDto } from './dto/exam.dto';
import { ExamsService } from './exams.service';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // Admin list must be registered before :id routes
  @UseGuards(AdminGuard)
  @Get()
  getAllExams() {
    return this.examsService.getAllExams();
  }

  @Get('course/:courseId')
  getExamsByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.examsService.getExamsByCourse(courseId);
  }

  @Get(':id')
  getExam(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.getExamById(id);
  }

  @Post(':id/submit')
  submitAttempt(
    @Param('id', ParseIntPipe) examId: number,
    @Body() body: SubmitExamDto,
  ) {
    const answers: Record<number, number> = {};
    for (const [key, value] of Object.entries(body.answers || {})) {
      answers[Number(key)] = Number(value);
    }
    return this.examsService.submitAttempt(examId, body.userId, answers);
  }

  @Get(':id/attempts/:userId')
  getAttempts(
    @Param('id', ParseIntPipe) examId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.examsService.getAttemptsByUser(examId, userId);
  }

  @UseGuards(AdminGuard)
  @Post()
  createExam(@Body() body: CreateExamDto) {
    return this.examsService.createExam(body);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  updateExam(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateExamDto) {
    return this.examsService.updateExam(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  deleteExam(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.deleteExam(id);
  }
}
