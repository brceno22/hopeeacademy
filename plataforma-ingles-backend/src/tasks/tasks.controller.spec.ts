import type { MoodleUser } from '../auth/moodle-user.types';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

const USER: MoodleUser = { userId: 7, token: 'user-token' };

function makeHarness() {
  const tasksService = {
    getSubmissionStatus: jest.fn(),
    submitTask: jest.fn(),
  };

  const controller = new TasksController(tasksService as unknown as TasksService);
  return { controller, tasksService };
}

describe('TasksController', () => {
  it('getSubmissionStatus forwards the session token', () => {
    const { controller, tasksService } = makeHarness();

    controller.getSubmissionStatus(501, USER);

    expect(tasksService.getSubmissionStatus).toHaveBeenCalledWith(501, 'user-token');
  });

  it('submitTask takes the userId from the session, never from the body', () => {
    const { controller, tasksService } = makeHarness();

    controller.submitTask(
      501,
      {
        text: 'Mi ensayo',
        fileName: 'essay.pdf',
        fileBase64: 'BASE64',
        fileMimeType: 'application/pdf',
      },
      USER,
    );

    expect(tasksService.submitTask).toHaveBeenCalledWith(501, 'user-token', {
      userId: 7,
      text: 'Mi ensayo',
      fileName: 'essay.pdf',
      fileBase64: 'BASE64',
      fileMimeType: 'application/pdf',
    });
  });

  it('submitTask accepts a text-only body, leaving the file fields undefined', () => {
    const { controller, tasksService } = makeHarness();

    controller.submitTask(501, { text: 'Solo texto' }, USER);

    expect(tasksService.submitTask).toHaveBeenCalledWith(501, 'user-token', {
      userId: 7,
      text: 'Solo texto',
      fileName: undefined,
      fileBase64: undefined,
      fileMimeType: undefined,
    });
  });
});
