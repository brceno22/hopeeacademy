import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  const progressRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 1, ...x })),
  };
  const moodleService = {
    getUserIdFromToken: jest.fn(),
    isEnrolledInCourse: jest.fn(),
    request: jest.fn(),
  };
  const coursesService = {
    getCourseContents: jest.fn(),
  };

  const service = new ProgressService(
    progressRepository as any,
    moodleService as any,
    coursesService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    moodleService.isEnrolledInCourse.mockResolvedValue(true);
    coursesService.getCourseContents.mockResolvedValue([
      { modules: [{ id: 5, type: 'resource' }, { id: 6, type: 'forum' }] },
    ]);
    progressRepository.findOne.mockResolvedValue(null);
  });

  it('rejects when not enrolled', async () => {
    moodleService.isEnrolledInCourse.mockResolvedValue(false);
    await expect(service.markAsCompleted('tok', 1, 5, 'manual', 9)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects module that does not belong to course', async () => {
    await expect(service.markAsCompleted('tok', 1, 999, 'manual', 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks valid module as completed', async () => {
    const result = await service.markAsCompleted('tok', 1, 5, 'manual', 9);
    expect(result.success).toBe(true);
    expect(progressRepository.save).toHaveBeenCalled();
  });
});
