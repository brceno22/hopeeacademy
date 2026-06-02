import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { AdminGuard } from '../auth/admin.guard';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // ── RUTAS PÚBLICAS (alumnos) ──────────────────────────────

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
    @Body() body: { userId: number; answers: Record<number, number> },
  ) {
    return this.examsService.submitAttempt(examId, body.userId, body.answers);
  }

  @Get(':id/attempts/:userId')
  getAttempts(
    @Param('id', ParseIntPipe) examId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.examsService.getAttemptsByUser(examId, userId);
  }

  // ── RUTAS ADMIN (protegidas) ──────────────────────────────

  @UseGuards(AdminGuard)
  @Post()
  createExam(@Body() body: any) {
    return this.examsService.createExam(body);
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  updateExam(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.examsService.updateExam(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  deleteExam(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.deleteExam(id);
  }

  // Traer todos los exámenes (para el panel admin)
  @UseGuards(AdminGuard)
  @Get()
  getAllExams() {
    return this.examsService.getAllExams();
  }
}