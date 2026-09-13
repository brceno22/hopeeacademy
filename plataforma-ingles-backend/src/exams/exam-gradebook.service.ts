import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CalendarService } from '../calendar/calendar.service';
import { CoursesService } from '../courses/courses.service';
import { ProgramEnrollmentSyncService } from '../courses/program-enrollment-sync.service';
import { MoodleService } from '../moodle/moodle.service';
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PASS_THRESHOLD,
  resolveAttemptStatus,
  ShiftGradeCell,
  ShiftGradeExamColumn,
  ShiftGradeStudentRow,
  ShiftGradebook,
} from './exam.helpers';
import { Attempt } from './entities/attempt.entity';
import { Exam } from './entities/exam.entity';

@Injectable()
export class ExamGradebookService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt)
    private readonly attemptRepo: Repository<Attempt>,
    private readonly coursesService: CoursesService,
    private readonly calendarService: CalendarService,
    private readonly programSync: ProgramEnrollmentSyncService,
    private readonly moodleService: MoodleService,
  ) {}

  listTeacherShifts(token: string) {
    return this.calendarService.listTeacherShifts(token);
  }

  /** Gradebook: roster del aula × exámenes del árbol de carpetas del turno. */
  async getShiftGrades(token: string, shiftId: number): Promise<ShiftGradebook> {
    const { shift } = await this.calendarService.assertTeacherShift(token, shiftId);
    const enrollments = await this.calendarService.listEnrollments(shiftId);
    const courseIds = await this.programSync.getCourseIdsForFolderTree(shift.folderId);

    let courseNameById = new Map<number, string>();
    try {
      const allCourses = await this.coursesService.findAll();
      courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));
    } catch {
      // optional labels
    }

    const exams =
      courseIds.length > 0
        ? await this.examRepo.find({
            where: { courseId: In(courseIds), active: true },
            order: { createdAt: 'ASC' },
          })
        : [];

    const examColumns: ShiftGradeExamColumn[] = exams.map((exam) => ({
      id: exam.id,
      courseId: exam.courseId,
      courseName: courseNameById.get(exam.courseId) || `Course ${exam.courseId}`,
      title: exam.title,
      maxAttempts: exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      passThreshold: exam.passThreshold ?? DEFAULT_PASS_THRESHOLD,
    }));

    const studentIds = enrollments.map((e) => e.moodleUserId);
    const attempts =
      exams.length > 0 && studentIds.length > 0
        ? await this.attemptRepo.find({
            where: {
              examId: In(exams.map((e) => e.id)),
              userId: In(studentIds),
            },
            order: { finishedAt: 'DESC' },
          })
        : [];

    const attemptsByUserExam = new Map<string, Attempt[]>();
    for (const a of attempts) {
      const key = `${a.userId}:${a.examId}`;
      const list = attemptsByUserExam.get(key) || [];
      list.push(a);
      attemptsByUserExam.set(key, list);
    }

    let nameMap = new Map<number, { fullName: string; email: string | null }>();
    try {
      const users = await this.moodleService.getUsersByIds(studentIds, token);
      nameMap = new Map(
        users.map((u) => [
          u.id,
          { fullName: u.fullname || `User ${u.id}`, email: u.email || null },
        ]),
      );
    } catch {
      // listEnrollments may already have names
    }

    const students: ShiftGradeStudentRow[] = enrollments
      .map((e) => {
        const fromEnrol = e as {
          moodleUserId: number;
          fullName?: string;
          email?: string | null;
        };
        const info = nameMap.get(e.moodleUserId);
        const results: ShiftGradeCell[] = exams.map((exam) => {
          const maxAttempts = exam.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
          const passThreshold = exam.passThreshold ?? DEFAULT_PASS_THRESHOLD;
          const examAttempts = attemptsByUserExam.get(`${e.moodleUserId}:${exam.id}`) || [];
          const attemptsUsed = examAttempts.length;
          const bestScore = attemptsUsed > 0 ? Math.max(...examAttempts.map((a) => a.score)) : null;
          const last = examAttempts[0];
          return {
            examId: exam.id,
            attemptsUsed,
            bestScore,
            lastScore: last?.score ?? null,
            lastFinishedAt: last?.finishedAt ? new Date(last.finishedAt).toISOString() : null,
            status: resolveAttemptStatus(attemptsUsed, bestScore, maxAttempts, passThreshold),
          };
        });

        return {
          moodleUserId: e.moodleUserId,
          fullName: info?.fullName || fromEnrol.fullName || `User ${e.moodleUserId}`,
          email: info?.email ?? fromEnrol.email ?? null,
          results,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      shift: {
        id: shift.id,
        name: shift.name,
        folderId: shift.folderId,
        folderName: shift.folder?.name ?? null,
      },
      exams: examColumns,
      students,
    };
  }
}
