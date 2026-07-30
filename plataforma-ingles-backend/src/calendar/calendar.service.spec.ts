import { CalendarService } from './calendar.service';
import { occurrenceStatus } from './calendar.util';

describe('CalendarService teacherCanManageShift', () => {
  const teacherRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const service = new CalendarService(
    {} as any,
    {} as any,
    teacherRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows teacher assigned to the shift', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 1, shiftId: 10, moodleUserId: 5 });
    const ok = await service.teacherCanManageShift('t', 5, { id: 10 } as any);
    expect(ok).toBe(true);
    expect(teacherRepo.findOne).toHaveBeenCalledWith({
      where: { shiftId: 10, moodleUserId: 5 },
    });
  });

  it('denies teacher not assigned to the shift', async () => {
    teacherRepo.findOne.mockResolvedValue(null);
    const ok = await service.teacherCanManageShift('t', 5, { id: 10 } as any);
    expect(ok).toBe(false);
  });
});

describe('CalendarService listTeacherShifts', () => {
  const teacherRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const moodleService = {
    getUserIdFromToken: jest.fn().mockResolvedValue(5),
  };

  const service = new CalendarService(
    {} as any,
    {} as any,
    teacherRepo as any,
    {} as any,
    {} as any,
    moodleService as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns only active assigned shifts', async () => {
    teacherRepo.find.mockResolvedValue([
      {
        shift: {
          id: 1,
          name: 'B1 Evening',
          isActive: true,
          folder: { name: 'B1' },
          folderId: 2,
          moodleCourseId: null,
          daysOfWeek: [1],
          startTime: '18:00',
          endTime: '20:00',
          title: 'Class',
          description: null,
          meetUrl: null,
          validFrom: null,
          validTo: null,
        },
      },
      {
        shift: {
          id: 2,
          name: 'Inactive',
          isActive: false,
          folder: null,
          folderId: 2,
          moodleCourseId: null,
          daysOfWeek: [1],
          startTime: '10:00',
          endTime: '12:00',
          title: 'Class',
          description: null,
          meetUrl: null,
          validFrom: null,
          validTo: null,
        },
      },
    ]);

    const shifts = await service.listTeacherShifts('token');
    expect(shifts).toHaveLength(1);
    expect(shifts[0].name).toBe('B1 Evening');
  });
});

describe('CalendarService enroll Moodle sync', () => {
  const shiftRepo = {
    findOne: jest.fn(),
  };
  const enrollmentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    remove: jest.fn(),
  };
  const teacherRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    remove: jest.fn(),
  };
  const programSync = {
    enrolUserInProgram: jest.fn(),
    unenrolUserFromProgramIfOrphan: jest.fn(),
  };

  const service = new CalendarService(
    shiftRepo as any,
    enrollmentRepo as any,
    teacherRepo as any,
    {} as any,
    {} as any,
    {} as any,
    programSync as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('enroll syncs student to Moodle and rolls back on failure', async () => {
    shiftRepo.findOne.mockResolvedValue({ id: 3, folderId: 10, folder: { name: 'B1' } });
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.save.mockResolvedValue({ id: 1, shiftId: 3, moodleUserId: 101 });
    programSync.enrolUserInProgram.mockRejectedValue(new Error('Moodle down'));

    await expect(service.enroll(3, { moodleUserId: 101 })).rejects.toThrow('Moodle down');
    expect(enrollmentRepo.remove).toHaveBeenCalled();
    expect(programSync.enrolUserInProgram).toHaveBeenCalledWith(10, 101, 'student');
  });

  it('assignTeacher syncs teacher role', async () => {
    shiftRepo.findOne.mockResolvedValue({ id: 3, folderId: 10 });
    teacherRepo.findOne.mockResolvedValue(null);
    teacherRepo.save.mockResolvedValue({ id: 2, shiftId: 3, moodleUserId: 55 });
    programSync.enrolUserInProgram.mockResolvedValue(undefined);

    await service.assignTeacher(3, { moodleUserId: 55 });
    expect(programSync.enrolUserInProgram).toHaveBeenCalledWith(10, 55, 'teacher');
  });

  it('unenroll skips Moodle unenrol when still in another shift of program', async () => {
    shiftRepo.findOne.mockResolvedValue({ id: 3, folderId: 10 });
    enrollmentRepo.findOne.mockResolvedValue({ id: 1, shiftId: 3, moodleUserId: 101 });
    programSync.unenrolUserFromProgramIfOrphan.mockResolvedValue(undefined);

    await service.unenroll(3, 101);
    expect(programSync.unenrolUserFromProgramIfOrphan).toHaveBeenCalledWith(10, 101, 'student');
  });
});

describe('occurrenceStatus', () => {
  it('classifies upcoming, live, and done', () => {
    const now = new Date('2026-07-30T18:30:00.000Z');
    expect(
      occurrenceStatus('2026-07-30T19:00:00.000Z', '2026-07-30T21:00:00.000Z', now),
    ).toBe('upcoming');
    expect(
      occurrenceStatus('2026-07-30T18:00:00.000Z', '2026-07-30T20:00:00.000Z', now),
    ).toBe('live');
    expect(
      occurrenceStatus('2026-07-30T16:00:00.000Z', '2026-07-30T18:00:00.000Z', now),
    ).toBe('done');
  });
});

describe('CalendarService getTeacherToday', () => {
  const teacherRepo = {
    find: jest.fn(),
  };
  const enrollmentRepo = {
    find: jest.fn(),
  };
  const eventRepo = {
    find: jest.fn().mockResolvedValue([]),
  };
  const moodleService = {
    getUserIdFromToken: jest.fn().mockResolvedValue(5),
  };

  const service = new CalendarService(
    {} as any,
    enrollmentRepo as any,
    teacherRepo as any,
    eventRepo as any,
    {} as any,
    moodleService as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns empty when teacher has no classrooms', async () => {
    teacherRepo.find.mockResolvedValue([]);
    const rows = await service.getTeacherToday('token', new Date('2026-07-30T12:00:00.000Z'));
    expect(rows).toEqual([]);
  });

  it('returns today occurrences with status for teacher-only shifts', async () => {
    // Thursday 2026-07-30 → weekday 4
    teacherRepo.find.mockResolvedValue([
      {
        shift: {
          id: 7,
          name: 'B1 Evening',
          isActive: true,
          folder: { name: 'B1' },
          daysOfWeek: [4],
          startTime: '18:00',
          endTime: '20:00',
          title: 'Hopee class',
          description: null,
          meetUrl: 'https://meet.example/b1',
          validFrom: null,
          validTo: null,
        },
      },
    ]);
    enrollmentRepo.find.mockResolvedValue([]);

    const now = new Date('2026-07-30T22:30:00.000Z'); // 17:30 Guayaquil → upcoming
    const rows = await service.getTeacherToday('token', now);
    expect(rows).toHaveLength(1);
    expect(rows[0].shiftId).toBe(7);
    expect(rows[0].meetUrl).toBe('https://meet.example/b1');
    expect(rows[0].status).toBe('upcoming');
  });

  it('getMyOccurrences includes teacher shifts when not enrolled as student', async () => {
    enrollmentRepo.find.mockResolvedValue([]);
    teacherRepo.find.mockResolvedValue([
      {
        shift: {
          id: 9,
          name: 'B2 Morning',
          isActive: true,
          folder: { name: 'B2' },
          daysOfWeek: [4],
          startTime: '10:00',
          endTime: '12:00',
          title: 'Class',
          description: null,
          meetUrl: null,
          validFrom: null,
          validTo: null,
        },
      },
    ]);

    const rows = await service.getMyOccurrences('token', '2026-07-30', '2026-07-30');
    expect(rows).toHaveLength(1);
    expect(rows[0].shiftId).toBe(9);
  });
});
