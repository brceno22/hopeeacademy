import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  const sessionRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 1, ...x })),
  };
  const checkInRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    remove: jest.fn(),
  };
  const shiftRepo = {
    findOne: jest.fn(),
  };
  const enrollmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const calendarService = {
    assertTeacherShift: jest.fn(),
    listTeacherShifts: jest.fn(),
  };
  const moodleService = {
    getUserIdFromToken: jest.fn().mockResolvedValue(9),
    getUsersByIds: jest.fn().mockResolvedValue([
      { id: 101, fullname: 'Ada Lovelace', email: 'ada@example.com' },
      { id: 102, fullname: 'Alan Turing', email: 'alan@example.com' },
    ]),
  };

  const service = new AttendanceService(
    sessionRepo as any,
    checkInRepo as any,
    shiftRepo as any,
    enrollmentRepo as any,
    calendarService as any,
    moodleService as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('createOrGetSession uses shiftId and opens when requested', async () => {
    calendarService.assertTeacherShift.mockResolvedValue({
      userId: 9,
      shift: { id: 3, name: 'B1 Evening', moodleCourseId: null },
    });
    sessionRepo.save.mockImplementation(async (x) => ({ id: 50, ...x }));

    sessionRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 50,
        shiftId: 3,
        sessionDate: '2026-07-29',
        title: 'B1 Evening',
        status: 'closed',
        moodleCourseId: null,
        openedByUserId: null,
        openedAt: null,
        closedAt: null,
      });

    const result = await service.createOrGetSession('tok', {
      shiftId: 3,
      sessionDate: '2026-07-29',
      open: true,
    });

    expect(result.status).toBe('open');
    expect(result.shiftId).toBe(3);
  });

  it('getSessionRoster only includes shift enrollments', async () => {
    calendarService.assertTeacherShift.mockResolvedValue({ userId: 9, shift: { id: 3 } });
    sessionRepo.findOne.mockResolvedValue({
      id: 50,
      shiftId: 3,
      sessionDate: '2026-07-29',
      title: 'Class',
      status: 'open',
      moodleCourseId: null,
      openedByUserId: 9,
      openedAt: new Date(),
      closedAt: null,
    });
    shiftRepo.findOne.mockResolvedValue({
      id: 3,
      name: 'B1 Evening',
      meetUrl: 'https://meet.example',
      startTime: '18:00',
      endTime: '20:00',
      folder: { name: 'B1' },
    });
    enrollmentRepo.find.mockResolvedValue([
      { moodleUserId: 101, createdAt: new Date() },
      { moodleUserId: 102, createdAt: new Date() },
    ]);
    checkInRepo.find.mockResolvedValue([
      { moodleUserId: 101, status: 'present', checkedInAt: new Date(), markedByUserId: 9 },
    ]);

    const roster = await service.getSessionRoster('tok', 50);
    expect(roster.roster).toHaveLength(2);
    expect(roster.presentCount).toBe(1);
    expect(roster.absentCount).toBe(1);
    expect(roster.roster.find((r) => r.moodleUserId === 101)?.present).toBe(true);
    expect(roster.roster.find((r) => r.moodleUserId === 102)?.present).toBe(false);
  });

  it('markAttendance requires open session and upserts status', async () => {
    const session = {
      id: 50,
      shiftId: 3,
      sessionDate: '2026-07-29',
      title: 'Class',
      status: 'open',
      moodleCourseId: null,
      openedByUserId: 9,
      openedAt: new Date(),
      closedAt: null,
    };
    sessionRepo.findOne.mockResolvedValue(session);
    calendarService.assertTeacherShift.mockResolvedValue({ userId: 9, shift: { id: 3 } });
    enrollmentRepo.findOne.mockResolvedValue({ shiftId: 3, moodleUserId: 101 });
    checkInRepo.findOne.mockResolvedValue(null);

    enrollmentRepo.find.mockResolvedValue([{ moodleUserId: 101, createdAt: new Date() }]);
    checkInRepo.find.mockResolvedValue([
      { moodleUserId: 101, status: 'present', checkedInAt: new Date(), markedByUserId: 9 },
    ]);
    shiftRepo.findOne.mockResolvedValue({
      id: 3,
      name: 'B1 Evening',
      meetUrl: null,
      startTime: '18:00',
      endTime: '20:00',
      folder: { name: 'B1' },
    });

    const present = await service.markAttendance('tok', 50, 101, { present: true });
    expect(checkInRepo.save).toHaveBeenCalled();
    expect(present.presentCount).toBe(1);

    checkInRepo.findOne.mockResolvedValue({
      id: 7,
      sessionId: 50,
      moodleUserId: 101,
      status: 'present',
      markedByUserId: 9,
    });
    checkInRepo.find.mockResolvedValue([
      { moodleUserId: 101, status: 'absent', checkedInAt: new Date(), markedByUserId: 9 },
    ]);
    const absent = await service.markAttendance('tok', 50, 101, { present: false });
    expect(absent.presentCount).toBe(0);
    expect(checkInRepo.remove).not.toHaveBeenCalled();
  });

  it('markAttendance rejects when session is closed', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 50, shiftId: 3, status: 'closed' });
    calendarService.assertTeacherShift.mockResolvedValue({ userId: 9, shift: { id: 3 } });

    await expect(
      service.markAttendance('tok', 50, 101, { present: true }),
    ).rejects.toThrow('La asistencia debe estar abierta');
  });

  it('markAttendance rejects students not in the shift', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 50, shiftId: 3, status: 'open' });
    calendarService.assertTeacherShift.mockResolvedValue({ userId: 9, shift: { id: 3 } });
    enrollmentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.markAttendance('tok', 50, 999, { present: true }),
    ).rejects.toThrow('El alumno no está matriculado en este turno');
  });

  it('closeSession finalizes unmarked students as absent', async () => {
    const session = {
      id: 50,
      shiftId: 3,
      sessionDate: '2026-07-29',
      title: 'Class',
      status: 'open',
      moodleCourseId: null,
      openedByUserId: 9,
      openedAt: new Date(),
      closedAt: null,
    };
    sessionRepo.findOne.mockResolvedValue(session);
    calendarService.assertTeacherShift.mockResolvedValue({ userId: 9, shift: { id: 3 } });
    enrollmentRepo.find.mockResolvedValue([
      { moodleUserId: 101 },
      { moodleUserId: 102 },
    ]);
    checkInRepo.find.mockResolvedValue([
      { moodleUserId: 101, status: 'present' },
    ]);
    sessionRepo.save.mockImplementation(async (x) => x);

    const result = await service.closeSession('tok', 50);
    expect(result.status).toBe('closed');
    expect(checkInRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          moodleUserId: 102,
          status: 'absent',
          sessionId: 50,
        }),
      ]),
    );
  });

  it('getMyHistory returns present and absent for closed sessions', async () => {
    moodleService.getUserIdFromToken.mockResolvedValue(101);
    enrollmentRepo.find.mockResolvedValue([{ shiftId: 3, moodleUserId: 101 }]);
    sessionRepo.find.mockResolvedValue([
      {
        id: 50,
        shiftId: 3,
        sessionDate: '2026-07-29',
        status: 'closed',
        closedAt: new Date('2026-07-29T22:00:00Z'),
        title: 'Class',
        moodleCourseId: null,
        openedByUserId: 9,
        openedAt: new Date(),
        shift: { name: 'B1 Evening', folder: { name: 'B1' } },
      },
      {
        id: 51,
        shiftId: 3,
        sessionDate: '2026-07-28',
        status: 'closed',
        closedAt: new Date('2026-07-28T22:00:00Z'),
        title: 'Class',
        moodleCourseId: null,
        openedByUserId: 9,
        openedAt: new Date(),
        shift: { name: 'B1 Evening', folder: { name: 'B1' } },
      },
    ]);
    checkInRepo.find.mockResolvedValue([
      { sessionId: 50, moodleUserId: 101, status: 'present', checkedInAt: new Date() },
      { sessionId: 51, moodleUserId: 101, status: 'absent', checkedInAt: new Date() },
    ]);

    const history = await service.getMyHistory('tok');
    expect(history).toHaveLength(2);
    expect(history[0].present).toBe(true);
    expect(history[0].status).toBe('present');
    expect(history[0].shiftName).toBe('B1 Evening');
    expect(history[0].folderName).toBe('B1');
    expect(history[1].present).toBe(false);
    expect(history[1].status).toBe('absent');
  });
});
