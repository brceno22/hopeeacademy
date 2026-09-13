import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MoodleClientService } from './moodle-client.service';
import { MoodleEnrolmentService } from './moodle-enrolment.service';
import { MoodleService } from './moodle.service';
import { MoodleUsersService } from './moodle-users.service';

describe('MoodleService', () => {
  let service: MoodleService;
  let client: MoodleClientService;
  let cacheStore: Map<string, unknown>;

  beforeEach(async () => {
    cacheStore = new Map();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoodleService,
        MoodleClientService,
        MoodleUsersService,
        MoodleEnrolmentService,
        { provide: HttpService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://moodle.test') },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(async (key: string) => cacheStore.get(key)),
            set: jest.fn(async (key: string, value: unknown) => {
              cacheStore.set(key, value);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MoodleService>(MoodleService);
    client = module.get<MoodleClientService>(MoodleClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchUsers', () => {
    it('returns empty for short query', async () => {
      await expect(service.searchUsers('a')).resolves.toEqual([]);
    });

    it('queries Moodle per search and caches that query', async () => {
      const request = jest.spyOn(client, 'request').mockResolvedValue({
        users: [
          {
            id: 10,
            firstname: 'Gonzalo',
            lastname: 'Briceno',
            email: 'gonzalo@x.com',
            username: 'gbriceno',
          },
          {
            id: 11,
            firstname: 'Ana',
            lastname: 'Lopez',
            email: 'ana@x.com',
            username: 'ana',
          },
          { id: 1, firstname: 'Guest', lastname: 'User', email: '', username: 'guest' },
        ],
      });

      const go = await service.searchUsers('go', 25);
      expect(go).toHaveLength(1);
      expect(go[0].fullname).toMatch(/Gonzalo/i);
      const afterGo = request.mock.calls.length;
      expect(afterGo).toBeGreaterThan(0);

      const ana = await service.searchUsers('ana', 25);
      expect(ana).toHaveLength(1);
      expect(ana[0].username).toBe('ana');
      expect(request.mock.calls.length).toBeGreaterThan(afterGo);
      const afterAna = request.mock.calls.length;

      const goAgain = await service.searchUsers('go', 25);
      expect(goAgain).toHaveLength(1);
      expect(request.mock.calls.length).toBe(afterAna);
    });
  });
});
