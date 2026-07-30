import { BadRequestException } from '@nestjs/common';
import { MicrolearningService } from './microlearning.service';

describe('MicrolearningService', () => {
  const contentRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const historyRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const streakRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const moodleService = { getUserIdFromToken: jest.fn() };
  const dataSource = {
    transaction: jest.fn(),
  };

  const service = new MicrolearningService(
    contentRepo as any,
    historyRepo as any,
    streakRepo as any,
    moodleService as any,
    dataSource as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    historyRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    contentRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 10 }, { id: 20 }]),
    });
  });

  it('rejects completing a content that is not today assigned', async () => {
    jest.spyOn(service, 'resolveTodayContentId').mockResolvedValue(10);
    await expect(service.markAsCompleted('tok', 99, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes assigned content inside a transaction', async () => {
    jest.spyOn(service, 'resolveTodayContentId').mockResolvedValue(10);
    historyRepo.findOne.mockResolvedValue(null);
    dataSource.transaction.mockImplementation(async (fn: any) =>
      fn({
        getRepository: (Entity: { name: string }) => {
          if (Entity.name === 'UserMicrolearningHistory') {
            return {
              create: (x: unknown) => x,
              save: jest.fn().mockResolvedValue({}),
            };
          }
          return {
            findOne: jest.fn().mockResolvedValue(null),
            create: (x: unknown) => x,
            save: jest.fn().mockImplementation(async (x) => x),
          };
        },
      }),
    );

    const result = await service.markAsCompleted('tok', 10, 1);
    expect(result.success).toBe(true);
    expect(dataSource.transaction).toHaveBeenCalled();
  });
});
