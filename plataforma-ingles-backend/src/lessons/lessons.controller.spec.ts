import type { MoodleUser } from '../auth/moodle-user.types';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

const USER: MoodleUser = { userId: 7, token: 'user-token' };

function makeHarness() {
  const lessonsService = {
    getLessonPages: jest.fn(),
    submitLessonAnswers: jest.fn(),
  };

  const controller = new LessonsController(lessonsService as unknown as LessonsService);
  return { controller, lessonsService };
}

describe('LessonsController', () => {
  it('getLessonPages forwards the session token', async () => {
    const { controller, lessonsService } = makeHarness();
    lessonsService.getLessonPages.mockResolvedValue([]);

    await controller.getLessonPages(501, USER);

    expect(lessonsService.getLessonPages).toHaveBeenCalledWith(501, 'user-token');
  });

  it('getLessonPages returns whatever the service resolves', async () => {
    const { controller, lessonsService } = makeHarness();
    const pages = [{ page: { id: 1 }, opciones: [] }];
    lessonsService.getLessonPages.mockResolvedValue(pages);

    await expect(controller.getLessonPages(501, USER)).resolves.toBe(pages);
  });

  it('submitLesson passes the answers from the body and the session token', async () => {
    const { controller, lessonsService } = makeHarness();
    lessonsService.submitLessonAnswers.mockResolvedValue({ success: true });

    await controller.submitLesson(501, { respuestas: { '1': 4 } }, USER);

    expect(lessonsService.submitLessonAnswers).toHaveBeenCalledWith(501, { '1': 4 }, 'user-token');
  });
});
