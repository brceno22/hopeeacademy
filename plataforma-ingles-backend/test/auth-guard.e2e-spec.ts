import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MoodleAuthGuard } from '../src/auth/moodle-auth.guard';
import { ProgressController } from '../src/progress/progress.controller';
import { ProgressService } from '../src/progress/progress.service';

describe('Auth-guarded smoke (e2e-ish)', () => {
  let app: INestApplication;
  const progressService = {
    getGlobalProgress: jest.fn().mockResolvedValue({ totalCourses: 0 }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        { provide: ProgressService, useValue: progressService },
        {
          provide: MoodleAuthGuard,
          useValue: {
            canActivate: (ctx: any) => {
              const req = ctx.switchToHttp().getRequest();
              const auth = req.headers.authorization;
              if (!auth?.startsWith('Bearer ')) {
                throw new UnauthorizedException('missing');
              }
              req.user = { userId: 1, token: auth.slice(7) };
              return true;
            },
          },
        },
      ],
    })
      .overrideGuard(MoodleAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          const auth = req.headers.authorization;
          if (!auth?.startsWith('Bearer ')) {
            throw new UnauthorizedException('missing');
          }
          req.user = { userId: 1, token: auth.slice(7) };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated progress/global', async () => {
    await request(app.getHttpServer()).get('/progress/global').expect(401);
  });

  it('allows authenticated progress/global', async () => {
    await request(app.getHttpServer())
      .get('/progress/global')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(progressService.getGlobalProgress).toHaveBeenCalled();
  });
});
