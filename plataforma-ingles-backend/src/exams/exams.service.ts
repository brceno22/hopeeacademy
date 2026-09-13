import { Injectable } from '@nestjs/common';
import { CreateExamDto, UpdateExamDto } from './dto/exam.dto';
import { AttemptAnswerValue } from './entities/attempt.entity';
import { ExamAdminService } from './exam-admin.service';
import { ExamGradebookService } from './exam-gradebook.service';
import { ExamStudentService } from './exam-student.service';

export type { MyExamStatus, MyExamSummary, ShiftGradebook } from './exam.helpers';

@Injectable()
export class ExamsService {
  constructor(
    private readonly admin: ExamAdminService,
    private readonly student: ExamStudentService,
    private readonly gradebook: ExamGradebookService,
  ) {}

  getExamsByCourse(courseId: number, token: string, userId: number) {
    return this.student.getExamsByCourse(courseId, token, userId);
  }

  listTeacherShifts(token: string) {
    return this.gradebook.listTeacherShifts(token);
  }

  getShiftGrades(token: string, shiftId: number) {
    return this.gradebook.getShiftGrades(token, shiftId);
  }

  getMyExams(userToken: string, userId: number) {
    return this.student.getMyExams(userToken, userId);
  }

  getExamById(id: number) {
    return this.admin.getExamById(id);
  }

  getExamForStudent(id: number, token: string, userId: number) {
    return this.student.getExamForStudent(id, token, userId);
  }

  createExam(data: CreateExamDto) {
    return this.admin.createExam(data);
  }

  submitAttempt(
    examId: number,
    userId: number,
    answers: Record<string, AttemptAnswerValue>,
    token: string,
  ) {
    return this.student.submitAttempt(examId, userId, answers, token);
  }

  getAttemptsByUser(examId: number, userId: number) {
    return this.student.getAttemptsByUser(examId, userId);
  }

  getOwnAttempts(examId: number, userId: number, token: string) {
    return this.student.getOwnAttempts(examId, userId, token);
  }

  getAllExams() {
    return this.admin.getAllExams();
  }

  updateExam(id: number, data: UpdateExamDto) {
    return this.admin.updateExam(id, data);
  }

  deleteExam(id: number) {
    return this.admin.deleteExam(id);
  }
}
