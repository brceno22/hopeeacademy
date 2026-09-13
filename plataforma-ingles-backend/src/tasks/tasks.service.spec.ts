import { BadGatewayException } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';
import type { MoodleModuleRaw } from '../moodle/moodle.types';
import { TasksService } from './tasks.service';

function makeHarness() {
  const moodle = {
    request: jest.fn(),
    requestPostForm: jest.fn(),
  };

  const service = new TasksService(moodle as unknown as MoodleService);
  return { service, moodle };
}

function makeModule(overrides: Partial<MoodleModuleRaw> = {}): MoodleModuleRaw {
  return {
    id: 11,
    name: 'Essay 1',
    modname: 'assign',
    instance: 501,
    description: '<p>Write 200 words</p>',
    url: 'https://moodle.example.com/mod/assign/view.php?id=11',
    ...overrides,
  };
}

describe('TasksService', () => {
  describe('formatTask', () => {
    it('maps a Moodle module to the shape the frontend consumes', () => {
      const { service } = makeHarness();

      expect(service.formatTask(makeModule())).toEqual({
        id: 11,
        name: 'Essay 1',
        type: 'assign',
        category: 'tarea',
        description: '<p>Write 200 words</p>',
        url: 'https://moodle.example.com/mod/assign/view.php?id=11',
        fileUrl: null,
        instanceId: 501,
      });
    });

    it('takes the first attachment as fileUrl when the module has contents', () => {
      const { service } = makeHarness();
      const mod = makeModule({
        contents: [
          { fileurl: 'https://moodle.example.com/a.pdf' },
          { fileurl: 'https://moodle.example.com/b.pdf' },
        ],
      });

      expect(service.formatTask(mod).fileUrl).toBe('https://moodle.example.com/a.pdf');
    });

    it('defaults missing description and url to empty strings', () => {
      const { service } = makeHarness();
      const mod = makeModule({ description: undefined, url: undefined });

      expect(service.formatTask(mod)).toMatchObject({ description: '', url: '' });
    });
  });

  describe('getSubmissionStatus', () => {
    it('asks Moodle for the status of that assignment with the caller token', async () => {
      const { service, moodle } = makeHarness();
      moodle.request.mockResolvedValue({ lastattempt: {} });

      await service.getSubmissionStatus(501, 'user-token');

      expect(moodle.request).toHaveBeenCalledWith(
        'mod_assign_get_submission_status',
        { assignid: 501 },
        'user-token',
      );
    });
  });

  describe('submitTask', () => {
    it('submits text only, without touching the file upload endpoint', async () => {
      const { service, moodle } = makeHarness();
      moodle.request.mockResolvedValue({});

      await expect(service.submitTask(501, 'user-token', { text: 'Mi ensayo' })).resolves.toEqual({
        success: true,
        message: 'Tarea entregada correctamente',
      });

      expect(moodle.requestPostForm).not.toHaveBeenCalled();
      expect(moodle.request).toHaveBeenCalledWith(
        'mod_assign_save_submission',
        expect.objectContaining({
          assignmentid: 501,
          'plugindata[onlinetext_editor][text]': 'Mi ensayo',
          'plugindata[files_filemanager]': '0',
        }),
        'user-token',
      );
    });

    it('uploads the file first and attaches the returned draft itemid', async () => {
      const { service, moodle } = makeHarness();
      moodle.requestPostForm.mockResolvedValue({ itemid: 9876 });
      moodle.request.mockResolvedValue({});

      await service.submitTask(501, 'user-token', {
        userId: 7,
        fileName: 'essay.pdf',
        fileBase64: 'BASE64',
      });

      expect(moodle.requestPostForm).toHaveBeenCalledWith(
        'core_files_upload',
        expect.objectContaining({
          filename: 'essay.pdf',
          filecontent: 'BASE64',
          instanceid: '7',
        }),
        'user-token',
      );
      expect(moodle.request).toHaveBeenCalledWith(
        'mod_assign_save_submission',
        expect.objectContaining({ 'plugindata[files_filemanager]': '9876' }),
        'user-token',
      );
    });

    it('falls back to draft itemid 0 when the upload returns no itemid', async () => {
      const { service, moodle } = makeHarness();
      moodle.requestPostForm.mockResolvedValue({});
      moodle.request.mockResolvedValue({});

      await service.submitTask(501, 'user-token', {
        fileName: 'essay.pdf',
        fileBase64: 'BASE64',
      });

      expect(moodle.request).toHaveBeenCalledWith(
        'mod_assign_save_submission',
        expect.objectContaining({ 'plugindata[files_filemanager]': '0' }),
        'user-token',
      );
    });

    it('surfaces a Moodle warning as a 502 instead of reporting success', async () => {
      const { service, moodle } = makeHarness();
      moodle.request.mockResolvedValue([
        { warningcode: 'couldnotsavesubmission', message: 'La entrega está cerrada' },
      ]);

      await expect(service.submitTask(501, 'user-token', { text: 'tarde' })).rejects.toMatchObject({
        status: 502,
        message: 'La entrega está cerrada',
      });
    });

    it('still reports a 502 when the warning carries no message', async () => {
      const { service, moodle } = makeHarness();
      moodle.request.mockResolvedValue([{ warningcode: 'couldnotsavesubmission' }]);

      await expect(service.submitTask(501, 'user-token', { text: 'tarde' })).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('treats an empty warnings array as a successful submission', async () => {
      const { service, moodle } = makeHarness();
      moodle.request.mockResolvedValue([]);

      await expect(service.submitTask(501, 'user-token', { text: 'ok' })).resolves.toMatchObject({
        success: true,
      });
    });
  });
});
