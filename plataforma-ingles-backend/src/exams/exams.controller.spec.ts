import { BadRequestException } from '@nestjs/common';
import type { MoodleUser } from '../auth/moodle-user.types';
import type { SubmitExamDto } from './dto/exam.dto';
import { ExamMediaService } from './exam-media.service';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

const USER: MoodleUser = { userId: 7, token: 'user-token' };

function makeHarness() {
  const examsService = {
    getAllExams: jest.fn(),
    getMyExams: jest.fn(),
    listTeacherShifts: jest.fn(),
    getShiftGrades: jest.fn(),
    getExamsByCourse: jest.fn(),
    getExamForStudent: jest.fn(),
    submitAttempt: jest.fn(),
    getOwnAttempts: jest.fn(),
    getAttemptsByUser: jest.fn(),
    createExam: jest.fn(),
    updateExam: jest.fn(),
    deleteExam: jest.fn(),
  };

  const examMedia = {
    saveUpload: jest.fn(),
    streamFile: jest.fn(),
  };

  const controller = new ExamsController(
    examsService as unknown as ExamsService,
    examMedia as unknown as ExamMediaService,
  );

  return { controller, examsService, examMedia };
}

/**
 * Regresión de P0: los endpoints de alumno deben pasar al service el token y el
 * userId de la sesión. Si alguien vuelve a omitir esos argumentos, el service
 * no puede verificar la matrícula y reaparece el IDOR de exámenes.
 */
describe('ExamsController', () => {
  describe('student endpoints pass the caller identity to the service', () => {
    it('getExam forwards the session token and userId', () => {
      const { controller, examsService } = makeHarness();

      controller.getExam(42, USER);

      expect(examsService.getExamForStudent).toHaveBeenCalledWith(42, 'user-token', 7);
    });

    it('getExamsByCourse forwards the session token and userId', () => {
      const { controller, examsService } = makeHarness();

      controller.getExamsByCourse(10, USER);

      expect(examsService.getExamsByCourse).toHaveBeenCalledWith(10, 'user-token', 7);
    });

    it('getMyExams forwards the session token and userId', () => {
      const { controller, examsService } = makeHarness();

      controller.getMyExams(USER);

      expect(examsService.getMyExams).toHaveBeenCalledWith('user-token', 7);
    });

    it('getMyAttempts goes through getOwnAttempts, which checks enrolment', () => {
      const { controller, examsService } = makeHarness();

      controller.getMyAttempts(42, USER);

      expect(examsService.getOwnAttempts).toHaveBeenCalledWith(42, 7, 'user-token');
      expect(examsService.getAttemptsByUser).not.toHaveBeenCalled();
    });

    it('submitAttempt uses the session userId, not one supplied by the client', () => {
      const { controller, examsService } = makeHarness();

      controller.submitAttempt(42, { answers: { '1': 3 } }, USER);

      expect(examsService.submitAttempt).toHaveBeenCalledWith(42, 7, { '1': 3 }, 'user-token');
    });

    it('getShiftGrades forwards the session token', () => {
      const { controller, examsService } = makeHarness();

      controller.getShiftGrades(5, USER);

      expect(examsService.getShiftGrades).toHaveBeenCalledWith('user-token', 5);
    });
  });

  describe('submitAttempt answer normalisation', () => {
    it('coerces scalar answers to numbers', () => {
      const { controller, examsService } = makeHarness();

      controller.submitAttempt(
        42,
        { answers: { '1': '3', '2': 4 } } as unknown as SubmitExamDto,
        USER,
      );

      expect(examsService.submitAttempt).toHaveBeenCalledWith(
        42,
        7,
        { '1': 3, '2': 4 },
        'user-token',
      );
    });

    it('keeps gap-fill answers as a map of strings and turns null blanks into empty ones', () => {
      const { controller, examsService } = makeHarness();

      controller.submitAttempt(
        42,
        { answers: { '1': { a: 'casa', b: null, c: 2 } } } as unknown as SubmitExamDto,
        USER,
      );

      expect(examsService.submitAttempt).toHaveBeenCalledWith(
        42,
        7,
        { '1': { a: 'casa', b: '', c: '2' } },
        'user-token',
      );
    });

    it('accepts an empty submission without throwing', () => {
      const { controller, examsService } = makeHarness();

      controller.submitAttempt(42, {} as unknown as SubmitExamDto, USER);

      expect(examsService.submitAttempt).toHaveBeenCalledWith(42, 7, {}, 'user-token');
    });
  });

  describe('admin endpoints', () => {
    it('getAttemptsAdmin reads the target user from the path, not from the session', () => {
      const { controller, examsService } = makeHarness();

      controller.getAttemptsAdmin(42, 99);

      expect(examsService.getAttemptsByUser).toHaveBeenCalledWith(42, 99);
    });

    it('uploadMedia rejects a request without a file instead of calling the service', () => {
      const { controller, examMedia } = makeHarness();

      expect(() => controller.uploadMedia(undefined)).toThrow(BadRequestException);
      expect(examMedia.saveUpload).not.toHaveBeenCalled();
    });

    it('uploadMedia delegates a present file to the media service', () => {
      const { controller, examMedia } = makeHarness();
      const file = {
        buffer: Buffer.from('x'),
        originalname: 'a.png',
        mimetype: 'image/png',
        size: 1,
      };

      controller.uploadMedia(file);

      expect(examMedia.saveUpload).toHaveBeenCalledWith(file);
    });
  });
});
