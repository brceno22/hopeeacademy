import { ProgramEnrollmentSyncService } from './program-enrollment-sync.service';

describe('ProgramEnrollmentSyncService', () => {
  const folderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const linkRepo = {
    find: jest.fn(),
  };
  const shiftRepo = {
    find: jest.fn(),
  };
  const enrollmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const teacherRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const moodleService = {
    getStudentRoleId: jest.fn().mockReturnValue(5),
    getTeacherRoleId: jest.fn().mockReturnValue(3),
    enrolUsers: jest.fn(),
    unenrolUsers: jest.fn(),
  };

  const service = new ProgramEnrollmentSyncService(
    folderRepo as any,
    linkRepo as any,
    shiftRepo as any,
    enrollmentRepo as any,
    teacherRepo as any,
    moodleService as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('getFolderTreeIds returns root and descendants', async () => {
    folderRepo.find.mockResolvedValue([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
      { id: 9, parentId: null },
    ]);

    const ids = await service.getFolderTreeIds(1);
    expect(ids.sort()).toEqual([1, 2, 3]);
  });

  it('getCourseIdsForFolderTree aggregates unique course ids', async () => {
    folderRepo.find.mockResolvedValue([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ]);
    linkRepo.find.mockResolvedValue([
      { moodleCourseId: 100 },
      { moodleCourseId: 200 },
      { moodleCourseId: 100 },
    ]);

    const ids = await service.getCourseIdsForFolderTree(1);
    expect(ids.sort()).toEqual([100, 200]);
  });

  it('enrolUserInProgram calls Moodle with student role', async () => {
    folderRepo.find.mockResolvedValue([{ id: 1, parentId: null }]);
    linkRepo.find.mockResolvedValue([{ moodleCourseId: 10 }, { moodleCourseId: 20 }]);
    moodleService.enrolUsers.mockResolvedValue(undefined);

    await service.enrolUserInProgram(1, 99, 'student');
    expect(moodleService.enrolUsers).toHaveBeenCalledWith([
      { courseId: 10, userId: 99, roleId: 5 },
      { courseId: 20, userId: 99, roleId: 5 },
    ]);
  });

  it('unenrolUserFromProgramIfOrphan does nothing if still enrolled in tree', async () => {
    folderRepo.find.mockResolvedValue([{ id: 1, parentId: null }]);
    shiftRepo.find.mockResolvedValue([{ id: 3 }, { id: 4 }]);
    enrollmentRepo.findOne.mockResolvedValue({ id: 1, shiftId: 4, moodleUserId: 99 });

    await service.unenrolUserFromProgramIfOrphan(1, 99, 'student');
    expect(moodleService.unenrolUsers).not.toHaveBeenCalled();
  });

  it('unenrolUserFromProgramIfOrphan unenrols when orphan', async () => {
    folderRepo.find.mockResolvedValue([{ id: 1, parentId: null }]);
    shiftRepo.find.mockResolvedValue([{ id: 3 }]);
    enrollmentRepo.findOne.mockResolvedValue(null);
    linkRepo.find.mockResolvedValue([{ moodleCourseId: 10 }]);

    await service.unenrolUserFromProgramIfOrphan(1, 99, 'student');
    expect(moodleService.unenrolUsers).toHaveBeenCalledWith([
      { courseId: 10, userId: 99 },
    ]);
  });

  it('syncCourseToExistingMembers enrols students and teachers of ancestor shifts', async () => {
    folderRepo.findOne
      .mockResolvedValueOnce({ id: 2, parentId: 1 })
      .mockResolvedValueOnce({ id: 1, parentId: null });
    shiftRepo.find.mockResolvedValue([{ id: 7 }, { id: 8 }]);
    enrollmentRepo.find.mockResolvedValue([{ moodleUserId: 101 }, { moodleUserId: 101 }]);
    teacherRepo.find.mockResolvedValue([{ moodleUserId: 55 }]);

    await service.syncCourseToExistingMembers(2, 999);

    expect(moodleService.enrolUsers).toHaveBeenCalledWith(
      expect.arrayContaining([
        { courseId: 999, userId: 101, roleId: 5 },
        { courseId: 999, userId: 55, roleId: 3 },
      ]),
    );
  });
});
