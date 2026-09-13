import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ExamAdminService } from './exam-admin.service';
import { ExamGradebookService } from './exam-gradebook.service';
import { ExamStudentService } from './exam-student.service';
import { ExamsService } from './exams.service';
import { Exam } from './entities/exam.entity';

const TOKEN = 'tok';
const USER_ID = 99;

describe('ExamsService', () => {
  const examRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    remove: jest.fn(),
  };
  const attemptRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };
  const manager = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn((_Entity: unknown, data: unknown) => data),
    save: jest.fn(async (x: unknown) => x),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
  };
  const coursesService = {
    findAllForUser: jest.fn(),
    findAll: jest.fn(),
  };
  const calendarService = {
    listTeacherShifts: jest.fn(),
    assertTeacherShift: jest.fn(),
    listEnrollments: jest.fn(),
  };
  const programSync = {
    getCourseIdsForFolderTree: jest.fn(),
  };
  const moodleService = {
    getUsersByIds: jest.fn(),
    isEnrolledInCourse: jest.fn(),
  };

  const examMedia = {
    normalizeMediaPath: (v: string | null | undefined) => {
      const t = v?.trim() || null;
      if (!t) return null;
      if (t.startsWith('/exams/media/')) return t;
      throw new Error('bad media');
    },
  };

  const admin = new ExamAdminService(examRepo as never, examMedia as never);
  const student = new ExamStudentService(
    examRepo as never,
    attemptRepo as never,
    dataSource as never,
    coursesService as never,
    moodleService as never,
    admin,
  );
  const gradebook = new ExamGradebookService(
    examRepo as never,
    attemptRepo as never,
    coursesService as never,
    calendarService as never,
    programSync as never,
    moodleService as never,
  );
  const service = new ExamsService(admin, student, gradebook);

  const exam: Exam = {
    id: 1,
    courseId: 10,
    title: 'Test',
    description: '',
    active: true,
    maxAttempts: 2,
    passThreshold: 60,
    createdAt: new Date(),
    questions: [
      {
        id: 1,
        text: 'Q1',
        type: 'multiple_choice',
        imageUrl: null,
        audioUrl: null,
        wordBank: null,
        correctBlanks: null,
        order: 1,
        exam: undefined as any,
        options: [
          { id: 11, text: 'A', isCorrect: true, question: undefined as any },
          { id: 12, text: 'B', isCorrect: false, question: undefined as any },
        ],
      },
      {
        id: 2,
        text: 'Q2',
        type: 'true_false',
        imageUrl: null,
        audioUrl: null,
        wordBank: null,
        correctBlanks: null,
        order: 2,
        exam: undefined as any,
        options: [
          { id: 21, text: 'True', isCorrect: false, question: undefined as any },
          { id: 22, text: 'False', isCorrect: true, question: undefined as any },
        ],
      },
      {
        id: 3,
        text: 'They {{1}} happy and she {{2}} tall.',
        type: 'gap_fill',
        imageUrl: null,
        audioUrl: 'https://example.com/a.mp3',
        wordBank: ['are', 'is', 'am', 'be'],
        correctBlanks: { '1': 'are', '2': 'is' },
        order: 3,
        exam: undefined as any,
        options: [],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue(exam);
    manager.count.mockResolvedValue(0);
    examRepo.findOne.mockResolvedValue(exam);
    moodleService.isEnrolledInCourse.mockResolvedValue(true);
  });

  it('scores MC + TF + gap_fill together', async () => {
    const result = await service.submitAttempt(
      1,
      USER_ID,
      { '1': 11, '2': 22, '3': { '1': 'are', '2': 'is' } },
      TOKEN,
    );
    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
    expect(result.score).toBe(100);
  });

  it('gap_fill is case-insensitive and unanswered counts as wrong', async () => {
    const result = await service.submitAttempt(
      1,
      USER_ID,
      { '1': 11, '3': { '1': 'ARE', '2': 'wrong' } },
      TOKEN,
    );
    expect(result.correct).toBe(1);
    expect(result.score).toBe(33);
  });

  it('strips isCorrect and correctBlanks for students', async () => {
    const view = await service.getExamForStudent(1, TOKEN, USER_ID);
    expect(view.questions[0].options[0]).toEqual({ id: 11, text: 'A' });
    expect((view.questions[0].options[0] as { isCorrect?: boolean }).isCorrect).toBeUndefined();
    expect(view.questions[2].type).toBe('gap_fill');
    expect(view.questions[2].wordBank).toEqual(expect.arrayContaining(['are', 'is']));
    expect((view.questions[2] as { correctBlanks?: unknown }).correctBlanks).toBeUndefined();
    expect(view.questions[2].audioUrl).toBe('https://example.com/a.mp3');
  });

  it('blocks when max attempts reached', async () => {
    manager.count.mockResolvedValue(2);
    await expect(service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  describe('course access', () => {
    it('rejects reading an exam from a course the user is not enrolled in', async () => {
      moodleService.isEnrolledInCourse.mockResolvedValue(false);
      await expect(service.getExamForStudent(1, TOKEN, USER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(moodleService.isEnrolledInCourse).toHaveBeenCalledWith(TOKEN, 10, USER_ID);
    });

    it('rejects submitting to an exam from a course the user is not enrolled in', async () => {
      moodleService.isEnrolledInCourse.mockResolvedValue(false);
      await expect(service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rejects listing exams of a course the user is not enrolled in', async () => {
      moodleService.isEnrolledInCourse.mockResolvedValue(false);
      await expect(service.getExamsByCourse(10, TOKEN, USER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(examRepo.find).not.toHaveBeenCalled();
    });

    it('rejects reading own attempts for a course the user is not enrolled in', async () => {
      moodleService.isEnrolledInCourse.mockResolvedValue(false);
      await expect(service.getOwnAttempts(1, USER_ID, TOKEN)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows a teacher of the course, since isEnrolledInCourse covers any role', async () => {
      moodleService.isEnrolledInCourse.mockResolvedValue(true);
      await expect(service.getExamForStudent(1, TOKEN, 7)).resolves.toMatchObject({ id: 1 });
    });

    it('rejects submitting to an inactive exam', async () => {
      manager.findOne.mockResolvedValue({ ...exam, active: false });
      await expect(service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('concurrent attempts', () => {
    it('maps the unique index violation to 409 instead of exceeding maxAttempts', async () => {
      const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
      manager.save.mockRejectedValueOnce(uniqueViolation);

      await expect(service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('numbers attempts so the unique index can enforce the limit', async () => {
      manager.count.mockResolvedValue(1);
      await service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN);

      expect(manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ examId: 1, userId: USER_ID, attemptNumber: 2 }),
      );
    });

    it('only one of two simultaneous submits wins when maxAttempts is 1', async () => {
      manager.findOne.mockResolvedValue({ ...exam, maxAttempts: 1 });
      // Ambas transacciones leen 0 intentos previos; la base rechaza la segunda.
      manager.count.mockResolvedValue(0);
      const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
      manager.save.mockResolvedValueOnce({}).mockRejectedValueOnce(uniqueViolation);

      const results = await Promise.allSettled([
        service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN),
        service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });

    it('rethrows errors that are not unique violations', async () => {
      manager.save.mockRejectedValueOnce(new Error('connection lost'));
      await expect(service.submitAttempt(1, USER_ID, { '1': 11 }, TOKEN)).rejects.toThrow(
        'connection lost',
      );
    });
  });

  it('getMyExams returns pending/passed for enrolled courses only', async () => {
    coursesService.findAllForUser.mockResolvedValue([
      { id: 10, name: 'English A1', code: 'A1', description: '' },
    ]);
    examRepo.find.mockResolvedValue([
      {
        id: 1,
        courseId: 10,
        title: 'Unit 1',
        description: '',
        active: true,
        maxAttempts: 3,
        passThreshold: 60,
        createdAt: new Date(),
        questions: [],
      },
      {
        id: 2,
        courseId: 10,
        title: 'Unit 2',
        description: '',
        active: true,
        maxAttempts: 2,
        passThreshold: 60,
        createdAt: new Date(),
        questions: [],
      },
    ]);
    attemptRepo.find.mockResolvedValue([
      { id: 1, examId: 2, userId: 99, score: 80, answers: {}, finishedAt: new Date() },
    ]);

    const list = await service.getMyExams('tok', 99);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: 1,
      status: 'pending',
      attemptsUsed: 0,
      courseName: 'English A1',
    });
    expect(list[1]).toMatchObject({ id: 2, status: 'passed', attemptsUsed: 1, bestScore: 80 });
  });

  it('getShiftGrades builds student × exam matrix for teacher aula', async () => {
    calendarService.assertTeacherShift.mockResolvedValue({
      userId: 7,
      shift: { id: 3, name: 'Morning', folderId: 2, folder: { name: 'B1' } },
    });
    calendarService.listEnrollments.mockResolvedValue([
      { moodleUserId: 101, fullName: 'Ana', email: 'a@x.com' },
      { moodleUserId: 102, fullName: 'Bob', email: null },
    ]);
    programSync.getCourseIdsForFolderTree.mockResolvedValue([10]);
    coursesService.findAll.mockResolvedValue([
      { id: 10, name: 'English A1', code: 'A1', description: '' },
    ]);
    examRepo.find.mockResolvedValue([
      {
        id: 5,
        courseId: 10,
        title: 'Quiz 1',
        description: '',
        active: true,
        maxAttempts: 3,
        passThreshold: 60,
        createdAt: new Date(),
        questions: [],
      },
    ]);
    attemptRepo.find.mockResolvedValue([
      {
        id: 1,
        examId: 5,
        userId: 101,
        score: 90,
        answers: {},
        finishedAt: new Date('2026-07-01T12:00:00Z'),
      },
    ]);
    moodleService.getUsersByIds.mockResolvedValue([]);

    const book = await service.getShiftGrades('tok', 3);
    expect(book.shift).toMatchObject({ id: 3, name: 'Morning', folderName: 'B1' });
    expect(book.exams).toHaveLength(1);
    expect(book.exams[0].title).toBe('Quiz 1');
    expect(book.students).toHaveLength(2);
    const ana = book.students.find((s) => s.moodleUserId === 101)!;
    expect(ana.results[0]).toMatchObject({
      examId: 5,
      status: 'passed',
      bestScore: 90,
      attemptsUsed: 1,
    });
    const bob = book.students.find((s) => s.moodleUserId === 102)!;
    expect(bob.results[0]).toMatchObject({ status: 'pending', bestScore: null, attemptsUsed: 0 });
  });
});
