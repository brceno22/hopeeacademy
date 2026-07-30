import { CoursesCatalogService } from './courses-catalog.service';

describe('CoursesCatalogService assignCourse sync', () => {
  const folderRepo = {
    findOne: jest.fn(),
  };
  const linkRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const coursesService = {};
  const programSync = {
    syncCourseToExistingMembers: jest.fn(),
  };
  const cache = {
    del: jest.fn(),
    get: jest.fn().mockResolvedValue(0),
    set: jest.fn(),
  };

  const service = new CoursesCatalogService(
    folderRepo as any,
    linkRepo as any,
    coursesService as any,
    programSync as any,
    cache as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('assignCourse syncs existing members and rolls back link on Moodle failure', async () => {
    folderRepo.findOne.mockResolvedValue({ id: 2, name: 'B1' });
    linkRepo.findOne.mockResolvedValue(null);
    linkRepo.save.mockResolvedValue({ id: 50, folderId: 2, moodleCourseId: 123, sortOrder: 0 });
    programSync.syncCourseToExistingMembers.mockRejectedValue(new Error('Moodle fail'));

    await expect(service.assignCourse(2, { moodleCourseId: 123 })).rejects.toThrow('Moodle fail');
    expect(programSync.syncCourseToExistingMembers).toHaveBeenCalledWith(2, 123);
    expect(linkRepo.delete).toHaveBeenCalledWith(50);
  });

  it('assignCourse syncs on success', async () => {
    folderRepo.findOne.mockResolvedValue({ id: 2, name: 'B1' });
    linkRepo.findOne.mockResolvedValue(null);
    linkRepo.save.mockResolvedValue({ id: 50, folderId: 2, moodleCourseId: 123, sortOrder: 0 });
    programSync.syncCourseToExistingMembers.mockResolvedValue(undefined);

    const saved = await service.assignCourse(2, { moodleCourseId: 123 });
    expect(saved.id).toBe(50);
    expect(programSync.syncCourseToExistingMembers).toHaveBeenCalledWith(2, 123);
    expect(linkRepo.delete).not.toHaveBeenCalled();
  });
});

describe('CoursesCatalogService pruneEmptyFolders', () => {
  const service = new CoursesCatalogService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('removes folders without courses and keeps ancestors with enrolled content', () => {
    const tree = [
      {
        id: 1,
        parentId: null,
        name: 'Root',
        slug: 'mis-cursos',
        sortOrder: 0,
        courses: [],
        children: [
          {
            id: 2,
            parentId: 1,
            name: 'Programa 1',
            slug: null,
            sortOrder: 0,
            courses: [{ id: 10 } as any],
            children: [],
          },
          {
            id: 3,
            parentId: 1,
            name: 'Programa 2 vacío',
            slug: null,
            sortOrder: 1,
            courses: [],
            children: [],
          },
        ],
      },
      {
        id: 9,
        parentId: null,
        name: 'Orphan empty',
        slug: null,
        sortOrder: 1,
        courses: [],
        children: [],
      },
    ];

    const pruned = service.pruneEmptyFolders(tree as any);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].name).toBe('Root');
    expect(pruned[0].children).toHaveLength(1);
    expect(pruned[0].children[0].name).toBe('Programa 1');
  });
});
