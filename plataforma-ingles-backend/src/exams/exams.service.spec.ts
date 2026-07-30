import { ForbiddenException } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { Exam } from './entities/exam.entity';

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
  };

  const service = new ExamsService(
    examRepo as any,
    attemptRepo as any,
    dataSource as any,
    {
      normalizeMediaPath: (v: string | null | undefined) => {
        const t = v?.trim() || null;
        if (!t) return null;
        if (t.startsWith('/exams/media/')) return t;
        throw new Error('bad media');
      },
    } as any,
    coursesService as any,
    calendarService as any,
    programSync as any,
    moodleService as any,
  );

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
  });

  it('scores MC + TF + gap_fill together', async () => {
    const result = await service.submitAttempt(1, 99, {
      '1': 11,
      '2': 22,
      '3': { '1': 'are', '2': 'is' },
    });
    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
    expect(result.score).toBe(100);
  });

  it('gap_fill is case-insensitive and unanswered counts as wrong', async () => {
    const result = await service.submitAttempt(1, 99, {
      '1': 11,
      '3': { '1': 'ARE', '2': 'wrong' },
    });
    expect(result.correct).toBe(1);
    expect(result.score).toBe(33);
  });

  it('strips isCorrect and correctBlanks for students', async () => {
    examRepo.findOne.mockResolvedValue(exam);
    const view = await service.getExamForStudent(1);
    expect(view.questions[0].options[0]).toEqual({ id: 11, text: 'A' });
    expect((view.questions[0].options[0] as { isCorrect?: boolean }).isCorrect).toBeUndefined();
    expect(view.questions[2].type).toBe('gap_fill');
    expect(view.questions[2].wordBank).toEqual(expect.arrayContaining(['are', 'is']));
    expect((view.questions[2] as { correctBlanks?: unknown }).correctBlanks).toBeUndefined();
    expect(view.questions[2].audioUrl).toBe('https://example.com/a.mp3');
  });

  it('blocks when max attempts reached', async () => {
    manager.count.mockResolvedValue(2);
    await expect(service.submitAttempt(1, 99, { '1': 11 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
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
    expect(list[0]).toMatchObject({ id: 1, status: 'pending', attemptsUsed: 0, courseName: 'English A1' });
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
