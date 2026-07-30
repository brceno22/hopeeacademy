import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { CreateExamDto, SubmitExamDto, UpdateExamDto } from './dto/exam.dto';
import { ExamMediaService } from './exam-media.service';
import { ExamsService } from './exams.service';

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly examMedia: ExamMediaService,
  ) {}

  // Admin list must be registered before :id routes
  @UseGuards(AdminGuard)
  @Get()
  getAllExams() {
    return this.examsService.getAllExams();
  }

  @UseGuards(AdminGuard)
  @Post('admin/media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @UploadedFile()
    file?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('File is required (field name: file)');
    }
    return this.examMedia.saveUpload(file);
  }

  /** Public media for exam questions (images / audio). */
  @Get('media/:filename')
  getMedia(@Param('filename') filename: string, @Res() res: Response) {
    return this.examMedia.streamFile(filename, res);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('mine')
  getMyExams(@CurrentUser() user: MoodleUser) {
    return this.examsService.getMyExams(user.token, user.userId);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('teacher/shifts')
  getTeacherShifts(@CurrentUser() user: MoodleUser) {
    return this.examsService.listTeacherShifts(user.token);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('teacher/shifts/:shiftId/grades')
  getShiftGrades(
    @Param('shiftId', ParseIntPipe) shiftId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.examsService.getShiftGrades(user.token, shiftId);
  }

  @UseGuards(MoodleAuthGuard)
  @Get('course/:courseId')
  getExamsByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.examsService.getExamsByCourse(courseId);
  }

  @UseGuards(MoodleAuthGuard)
  @Get(':id')
  getExam(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.getExamForStudent(id);
  }

  @UseGuards(MoodleAuthGuard)
  @Post(':id/submit')
  submitAttempt(
    @Param('id', ParseIntPipe) examId: number,
    @Body() body: SubmitExamDto,
    @CurrentUser() user: MoodleUser,
  ) {
    const answers: Record<string, number | Record<string, string>> = {};
    for (const [key, value] of Object.entries(body.answers || {})) {
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        const blanks: Record<string, string> = {};
        for (const [bk, bv] of Object.entries(value)) {
          blanks[String(bk)] = String(bv ?? '');
        }
        answers[String(key)] = blanks;
      } else {
        answers[String(key)] = Number(value);
      }
    }
    return this.examsService.submitAttempt(examId, user.userId, answers);
  }

  @UseGuards(MoodleAuthGuard)
  @Get(':id/attempts')
  getMyAttempts(
    @Param('id', ParseIntPipe) examId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.examsService.getAttemptsByUser(examId, user.userId);
  }

  @UseGuards(AdminGuard)
  @Get(':id/attempts/:userId')
  getAttemptsAdmin(
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
