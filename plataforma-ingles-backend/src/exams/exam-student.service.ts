import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CoursesService } from '../courses/courses.service';
import { MoodleService } from '../moodle/moodle.service';
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PASS_THRESHOLD,
  extractBlankKeys,
  isUniqueViolation,
  MyExamStatus,
  MyExamSummary,
  normalizeWord,
  resolveAttemptStatus,
  resolveType,
  shuffle,
} from './exam.helpers';
import { Attempt, AttemptAnswerValue } from './entities/attempt.entity';
import { Exam } from './entities/exam.entity';
import { Question } from './entities/question.entity';
import { ExamAdminService } from './exam-admin.service';

@Injectable()
export class ExamStudentService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt)
    private readonly attemptRepo: Repository<Attempt>,
    private readonly dataSource: DataSource,
    private readonly coursesService: CoursesService,
    private readonly moodleService: MoodleService,
    private readonly examAdmin: ExamAdminService,
  ) {}

  /**
   * `isEnrolledInCourse` usa core_enrol_get_users_courses, que devuelve los cursos
   * del usuario en cualquier rol: los profesores del curso también pasan.
   */
  async assertCourseAccess(token: string, courseId: number, userId: number) {
    const enrolled = await this.moodleService.isEnrolledInCourse(token, courseId, userId);
    if (!enrolled) {
      throw new ForbiddenException('No estás matriculado en este curso');
    }
  }

  async getExamsByCourse(
    courseId: number,
    token: string,
    userId: number,
  ): Promise<Array<Omit<Exam, 'questions'> & { questions?: undefined }>> {
    await this.assertCourseAccess(token, courseId, userId);
    const exams = await this.examRepo.find({ where: { courseId, active: true } });
    return exams.map(({ questions: _q, ...rest }) => rest);
  }

  /** Exámenes activos de cursos en los que el alumno está inscrito. */
  async getMyExams(userToken: string, userId: number): Promise<MyExamSummary[]> {
    const courses = await this.coursesService.findAllForUser(userToken, userId);
    if (!courses.length) return [];

    const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
    const courseIds = courses.map((c) => c.id);

    const exams = await this.examRepo.find({
      where: { courseId: In(courseIds), active: true },
      order: { createdAt: 'DESC' },
    });
    if (!exams.length) return [];

    const attempts = await this.attemptRepo.find({
      where: { userId, examId: In(exams.map((e) => e.id)) },
      order: { finishedAt: 'DESC' },
    });

    const attemptsByExam = new Map<number, Attempt[]>();
    for (const a of attempts) {
      const list = attemptsByExam.get(a.examId) || [];
      list.push(a);
      attemptsByExam.set(a.examId, list);
    }

    const summaries: MyExamSummary[] = exams.map((exam) => {
      const maxAttempts = exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
      const passThreshold = exam.passThreshold ?? DEFAULT_PASS_THRESHOLD;
      const examAttempts = attemptsByExam.get(exam.id) || [];
      const attemptsUsed = examAttempts.length;
      const bestScore = attemptsUsed > 0 ? Math.max(...examAttempts.map((a) => a.score)) : null;

      return {
        id: exam.id,
        courseId: exam.courseId,
        courseName: courseNameById.get(exam.courseId) || `Course ${exam.courseId}`,
        title: exam.title,
        description: exam.description ?? null,
        maxAttempts,
        passThreshold,
        attemptsUsed,
        bestScore,
        status: resolveAttemptStatus(attemptsUsed, bestScore, maxAttempts, passThreshold),
      };
    });

    const order: Record<MyExamStatus, number> = {
      pending: 0,
      failed: 1,
      exhausted: 2,
      passed: 3,
    };
    return summaries.sort(
      (a, b) => order[a.status] - order[b.status] || a.title.localeCompare(b.title),
    );
  }

  /** Versión para alumno: sin isCorrect ni correctBlanks. */
  async getExamForStudent(id: number, token: string, userId: number) {
    const exam = await this.examAdmin.getExamById(id);
    await this.assertCourseAccess(token, exam.courseId, userId);
    return {
      id: exam.id,
      courseId: exam.courseId,
      title: exam.title,
      description: exam.description,
      active: exam.active,
      createdAt: exam.createdAt,
      maxAttempts: exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      passThreshold: exam.passThreshold ?? DEFAULT_PASS_THRESHOLD,
      questions: (exam.questions || []).map((q) => {
        const type = resolveType(q);
        return {
          id: q.id,
          text: q.text,
          type,
          imageUrl: q.imageUrl ?? null,
          audioUrl: q.audioUrl ?? null,
          wordBank:
            type === 'gap_fill' && Array.isArray(q.wordBank) ? shuffle(q.wordBank) : undefined,
          sortOrder: q.order,
          options:
            type === 'gap_fill'
              ? []
              : (q.options || []).map((o) => ({
                  id: o.id,
                  text: o.text,
                })),
        };
      }),
    };
  }

  private getAnswer(
    answers: Record<string, AttemptAnswerValue>,
    questionId: number,
  ): AttemptAnswerValue | undefined {
    if (answers[String(questionId)] !== undefined) return answers[String(questionId)];
    return (answers as Record<number, AttemptAnswerValue>)[questionId];
  }

  private isQuestionCorrect(question: Question, answer: AttemptAnswerValue | undefined): boolean {
    const type = resolveType(question);
    if (answer === undefined || answer === null) return false;

    if (type === 'gap_fill') {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      const correct = question.correctBlanks || {};
      const blanks = extractBlankKeys(question.text);
      if (!blanks.length) return false;
      return blanks.every((key) => {
        const given = answer[key];
        const expected = correct[key];
        if (given == null || expected == null) return false;
        return normalizeWord(String(given)) === normalizeWord(String(expected));
      });
    }

    const optionId = typeof answer === 'number' ? answer : Number(answer);
    if (!Number.isFinite(optionId)) return false;
    const selected = (question.options || []).find((o) => o.id === optionId);
    return Boolean(selected?.isCorrect);
  }

  async submitAttempt(
    examId: number,
    userId: number,
    answers: Record<string, AttemptAnswerValue>,
    token: string,
  ) {
    // Fuera de la transacción: es una llamada HTTP a Moodle.
    const target = await this.examRepo.findOne({ where: { id: examId } });
    if (!target) throw new NotFoundException('Examen no encontrado');
    await this.assertCourseAccess(token, target.courseId, userId);

    return this.dataSource.transaction(async (manager) => {
      const exam = await manager.findOne(Exam, { where: { id: examId } });
      if (!exam) throw new NotFoundException('Examen no encontrado');
      if (!exam.active) throw new ForbiddenException('Este examen no está disponible');

      const maxAttempts = exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
      const passThreshold = exam.passThreshold ?? DEFAULT_PASS_THRESHOLD;

      const priorCount = await manager.count(Attempt, { where: { examId, userId } });
      if (priorCount >= maxAttempts) {
        throw new ForbiddenException(`Alcanzaste el máximo de ${maxAttempts} intentos`);
      }

      let correct = 0;
      const total = exam.questions?.length ?? 0;

      for (const question of exam.questions || []) {
        const answer = this.getAnswer(answers, question.id);
        if (this.isQuestionCorrect(question, answer)) correct++;
      }

      const score = total > 0 ? Math.round((correct / total) * 100) : 0;

      const attempt = manager.create(Attempt, {
        examId,
        userId,
        attemptNumber: priorCount + 1,
        score,
        answers,
      });

      try {
        await manager.save(attempt);
      } catch (err: unknown) {
        // 23505 = unique_violation: otro submit concurrente ya tomó este número
        // de intento, así que este excedería maxAttempts.
        if (isUniqueViolation(err)) {
          throw new ConflictException(
            'Otro intento se registró al mismo tiempo. Volvé a cargar la página.',
          );
        }
        throw err;
      }

      return {
        success: true,
        score,
        correct,
        total,
        attemptsUsed: priorCount + 1,
        maxAttempts,
        message: score >= passThreshold ? '¡Aprobado!' : 'No aprobado. Podés intentarlo de nuevo.',
      };
    });
  }

  async getAttemptsByUser(examId: number, userId: number) {
    return this.attemptRepo.find({
      where: { examId, userId },
      order: { finishedAt: 'DESC' },
    });
  }

  /** Intentos propios del alumno: exige matrícula en el curso del examen. */
  async getOwnAttempts(examId: number, userId: number, token: string) {
    const exam = await this.examAdmin.getExamById(examId);
    await this.assertCourseAccess(token, exam.courseId, userId);
    return this.getAttemptsByUser(examId, userId);
  }
}
