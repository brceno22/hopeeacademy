import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CalendarService } from '../calendar/calendar.service';
import { CoursesService } from '../courses/courses.service';
import { ProgramEnrollmentSyncService } from '../courses/program-enrollment-sync.service';
import { MoodleService } from '../moodle/moodle.service';
import { CreateExamDto, ExamQuestionDto, UpdateExamDto } from './dto/exam.dto';
import { Attempt, AttemptAnswerValue } from './entities/attempt.entity';
import { Exam } from './entities/exam.entity';
import { Question, QuestionType } from './entities/question.entity';
import { ExamMediaService } from './exam-media.service';

export type MyExamStatus = 'pending' | 'passed' | 'failed' | 'exhausted';

export interface MyExamSummary {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  description: string | null;
  maxAttempts: number;
  passThreshold: number;
  attemptsUsed: number;
  bestScore: number | null;
  status: MyExamStatus;
}

export interface ShiftGradeExamColumn {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  maxAttempts: number;
  passThreshold: number;
}

export interface ShiftGradeCell {
  examId: number;
  attemptsUsed: number;
  bestScore: number | null;
  lastScore: number | null;
  lastFinishedAt: string | null;
  status: MyExamStatus;
}

export interface ShiftGradeStudentRow {
  moodleUserId: number;
  fullName: string;
  email: string | null;
  results: ShiftGradeCell[];
}

export interface ShiftGradebook {
  shift: {
    id: number;
    name: string;
    folderId: number;
    folderName: string | null;
  };
  exams: ShiftGradeExamColumn[];
  students: ShiftGradeStudentRow[];
}

function resolveAttemptStatus(
  attemptsUsed: number,
  bestScore: number | null,
  maxAttempts: number,
  passThreshold: number,
): MyExamStatus {
  if (bestScore != null && bestScore >= passThreshold) return 'passed';
  if (attemptsUsed >= maxAttempts) return 'exhausted';
  if (attemptsUsed > 0) return 'failed';
  return 'pending';
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PASS_THRESHOLD = 60;

const BLANK_RE = /\{\{(\d+)\}\}/g;

function extractBlankKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(BLANK_RE)) keys.add(m[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

function normalizeWord(w: string): string {
  return w.trim().toLowerCase();
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function resolveType(q: { type?: string | null }): QuestionType {
  if (q.type === 'true_false' || q.type === 'gap_fill' || q.type === 'multiple_choice') {
    return q.type;
  }
  return 'multiple_choice';
}

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt)
    private readonly attemptRepo: Repository<Attempt>,
    private readonly dataSource: DataSource,
    private readonly examMedia: ExamMediaService,
    private readonly coursesService: CoursesService,
    private readonly calendarService: CalendarService,
    private readonly programSync: ProgramEnrollmentSyncService,
    private readonly moodleService: MoodleService,
  ) {}

  async getExamsByCourse(
    courseId: number,
  ): Promise<Array<Omit<Exam, 'questions'> & { questions?: undefined }>> {
    const exams = await this.examRepo.find({ where: { courseId, active: true } });
    return exams.map(({ questions: _q, ...rest }) => rest);
  }

  listTeacherShifts(token: string) {
    return this.calendarService.listTeacherShifts(token);
  }

  /** Gradebook: roster del aula × exámenes del árbol de carpetas del turno. */
  async getShiftGrades(token: string, shiftId: number): Promise<ShiftGradebook> {
    const { shift } = await this.calendarService.assertTeacherShift(token, shiftId);
    const enrollments = await this.calendarService.listEnrollments(shiftId);
    const courseIds = await this.programSync.getCourseIdsForFolderTree(shift.folderId);

    let courseNameById = new Map<number, string>();
    try {
      const allCourses = await this.coursesService.findAll();
      courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));
    } catch {
      // optional labels
    }

    const exams =
      courseIds.length > 0
        ? await this.examRepo.find({
            where: { courseId: In(courseIds), active: true },
            order: { createdAt: 'ASC' },
          })
        : [];

    const examColumns: ShiftGradeExamColumn[] = exams.map((exam) => ({
      id: exam.id,
      courseId: exam.courseId,
      courseName: courseNameById.get(exam.courseId) || `Course ${exam.courseId}`,
      title: exam.title,
      maxAttempts: exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      passThreshold: exam.passThreshold ?? DEFAULT_PASS_THRESHOLD,
    }));

    const studentIds = enrollments.map((e) => e.moodleUserId);
    const attempts =
      exams.length > 0 && studentIds.length > 0
        ? await this.attemptRepo.find({
            where: {
              examId: In(exams.map((e) => e.id)),
              userId: In(studentIds),
            },
            order: { finishedAt: 'DESC' },
          })
        : [];

    const attemptsByUserExam = new Map<string, Attempt[]>();
    for (const a of attempts) {
      const key = `${a.userId}:${a.examId}`;
      const list = attemptsByUserExam.get(key) || [];
      list.push(a);
      attemptsByUserExam.set(key, list);
    }

    let nameMap = new Map<number, { fullName: string; email: string | null }>();
    try {
      const users = await this.moodleService.getUsersByIds(studentIds, token);
      nameMap = new Map(
        users.map((u) => [
          u.id,
          { fullName: u.fullname || `User ${u.id}`, email: u.email || null },
        ]),
      );
    } catch {
      // listEnrollments may already have names
    }

    const students: ShiftGradeStudentRow[] = enrollments
      .map((e) => {
        const fromEnrol = e as {
          moodleUserId: number;
          fullName?: string;
          email?: string | null;
        };
        const info = nameMap.get(e.moodleUserId);
        const results: ShiftGradeCell[] = exams.map((exam) => {
          const maxAttempts = exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
          const passThreshold = exam.passThreshold ?? DEFAULT_PASS_THRESHOLD;
          const examAttempts = attemptsByUserExam.get(`${e.moodleUserId}:${exam.id}`) || [];
          const attemptsUsed = examAttempts.length;
          const bestScore =
            attemptsUsed > 0 ? Math.max(...examAttempts.map((a) => a.score)) : null;
          const last = examAttempts[0];
          return {
            examId: exam.id,
            attemptsUsed,
            bestScore,
            lastScore: last?.score ?? null,
            lastFinishedAt: last?.finishedAt ? new Date(last.finishedAt).toISOString() : null,
            status: resolveAttemptStatus(attemptsUsed, bestScore, maxAttempts, passThreshold),
          };
        });

        return {
          moodleUserId: e.moodleUserId,
          fullName: info?.fullName || fromEnrol.fullName || `User ${e.moodleUserId}`,
          email: info?.email ?? fromEnrol.email ?? null,
          results,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      shift: {
        id: shift.id,
        name: shift.name,
        folderId: shift.folderId,
        folderName: shift.folder?.name ?? null,
      },
      exams: examColumns,
      students,
    };
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
      const bestScore =
        attemptsUsed > 0 ? Math.max(...examAttempts.map((a) => a.score)) : null;

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
    return summaries.sort((a, b) => order[a.status] - order[b.status] || a.title.localeCompare(b.title));
  }

  async getExamById(id: number): Promise<Exam> {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Examen no encontrado');
    return exam;
  }

  /** Versión para alumno: sin isCorrect ni correctBlanks. */
  async getExamForStudent(id: number) {
    const exam = await this.getExamById(id);
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

  private normalizeQuestions(questions: ExamQuestionDto[]): Question[] {
    return questions.map((q, index) => {
      const type = resolveType(q);
      const order = q.order ?? q.sortOrder ?? index + 1;
      const imageUrl = this.examMedia.normalizeMediaPath(q.imageUrl);
      const audioUrl = this.examMedia.normalizeMediaPath(q.audioUrl);

      if (type === 'true_false') {
        const opts = q.options?.length
          ? q.options
          : [
              { text: 'True', isCorrect: true },
              { text: 'False', isCorrect: false },
            ];
        if (opts.length !== 2) {
          throw new BadRequestException('true_false requires exactly 2 options');
        }
        const correctCount = opts.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new BadRequestException('true_false requires exactly one correct option');
        }
        return {
          id: q.id,
          text: q.text.trim(),
          type,
          imageUrl,
          audioUrl,
          wordBank: null,
          correctBlanks: null,
          order,
          options: opts.map((o) => ({
            id: o.id,
            text: o.text.trim(),
            isCorrect: o.isCorrect,
          })),
        } as unknown as Question;
      }

      if (type === 'gap_fill') {
        const blanks = extractBlankKeys(q.text);
        if (!blanks.length) {
          throw new BadRequestException(
            'gap_fill text must include at least one blank like {{1}}',
          );
        }
        const correctBlanks = q.correctBlanks || {};
        for (const key of blanks) {
          if (!correctBlanks[key]?.trim()) {
            throw new BadRequestException(`gap_fill missing correct answer for blank {{${key}}}`);
          }
        }
        const wordBank = (q.wordBank || []).map((w) => w.trim()).filter(Boolean);
        const needed = blanks.map((k) => normalizeWord(correctBlanks[k]));
        const bankNorm = wordBank.map(normalizeWord);
        for (const w of needed) {
          if (!bankNorm.includes(w)) {
            throw new BadRequestException(
              `gap_fill wordBank must include all correct answers (missing "${w}")`,
            );
          }
        }
        return {
          id: q.id,
          text: q.text.trim(),
          type,
          imageUrl,
          audioUrl,
          wordBank,
          correctBlanks: Object.fromEntries(
            blanks.map((k) => [k, correctBlanks[k].trim()]),
          ),
          order,
          options: [],
        } as unknown as Question;
      }

      const options = q.options || [];
      if (options.length < 2) {
        throw new BadRequestException('multiple_choice requires at least 2 options');
      }
      if (!options.some((o) => o.isCorrect)) {
        throw new BadRequestException('multiple_choice requires at least one correct option');
      }
      return {
        id: q.id,
        text: q.text.trim(),
        type: 'multiple_choice' as const,
        imageUrl,
        audioUrl,
        wordBank: null,
        correctBlanks: null,
        order,
        options: options.map((o) => ({
          id: o.id,
          text: o.text.trim(),
          isCorrect: o.isCorrect,
        })),
      } as unknown as Question;
    });
  }

  async createExam(data: CreateExamDto): Promise<Exam> {
    const questions = this.normalizeQuestions(data.questions);
    const exam = this.examRepo.create({
      title: data.title,
      description: data.description ?? '',
      courseId: data.courseId,
      active: data.active ?? true,
      maxAttempts: data.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      passThreshold: data.passThreshold ?? DEFAULT_PASS_THRESHOLD,
      questions: questions as Question[],
    });
    return this.examRepo.save(exam) as Promise<Exam>;
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
  ) {
    return this.dataSource.transaction(async (manager) => {
      const exam = await manager.findOne(Exam, { where: { id: examId } });
      if (!exam) throw new NotFoundException('Examen no encontrado');

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
        score,
        answers,
      });
      await manager.save(attempt);

      return {
        success: true,
        score,
        correct,
        total,
        attemptsUsed: priorCount + 1,
        maxAttempts,
        message:
          score >= passThreshold ? '¡Aprobado!' : 'No aprobado. Podés intentarlo de nuevo.',
      };
    });
  }

  async getAttemptsByUser(examId: number, userId: number) {
    return this.attemptRepo.find({
      where: { examId, userId },
      order: { finishedAt: 'DESC' },
    });
  }

  async getAllExams(): Promise<Exam[]> {
    return this.examRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateExam(id: number, data: UpdateExamDto): Promise<Exam> {
    const exam = await this.getExamById(id);
    if (data.title != null) exam.title = data.title;
    if (data.description !== undefined) exam.description = data.description;
    if (data.courseId != null) exam.courseId = data.courseId;
    if (data.active != null) exam.active = data.active;
    if (data.maxAttempts != null) exam.maxAttempts = data.maxAttempts;
    if (data.passThreshold != null) exam.passThreshold = data.passThreshold;
    if (data.questions) {
      exam.questions = this.normalizeQuestions(data.questions);
    }
    return this.examRepo.save(exam) as Promise<Exam>;
  }

  async deleteExam(id: number): Promise<{ message: string }> {
    const exam = await this.getExamById(id);
    await this.examRepo.remove(exam);
    return { message: 'Examen eliminado' };
  }
}
