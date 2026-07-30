import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ScheduleShift } from '../calendar/schedule-shift.entity';
import { ShiftEnrollment } from '../calendar/shift-enrollment.entity';
import { ShiftTeacher } from '../calendar/shift-teacher.entity';
import { MoodleService } from '../moodle/moodle.service';
import { CourseFolder } from './entities/course-folder.entity';
import { CourseFolderLink } from './entities/course-folder-link.entity';

export type ProgramMoodleRole = 'student' | 'teacher';

@Injectable()
export class ProgramEnrollmentSyncService {
  constructor(
    @InjectRepository(CourseFolder)
    private readonly folderRepo: Repository<CourseFolder>,
    @InjectRepository(CourseFolderLink)
    private readonly linkRepo: Repository<CourseFolderLink>,
    @InjectRepository(ScheduleShift)
    private readonly shiftRepo: Repository<ScheduleShift>,
    @InjectRepository(ShiftEnrollment)
    private readonly enrollmentRepo: Repository<ShiftEnrollment>,
    @InjectRepository(ShiftTeacher)
    private readonly teacherRepo: Repository<ShiftTeacher>,
    private readonly moodleService: MoodleService,
  ) {}

  /** Carpeta + todos los descendientes. */
  async getFolderTreeIds(rootFolderId: number): Promise<number[]> {
    const all = await this.folderRepo.find({ select: ['id', 'parentId'] });
    const byParent = new Map<number | null, number[]>();
    for (const f of all) {
      const key = f.parentId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(f.id);
      byParent.set(key, list);
    }

    const out: number[] = [];
    const stack = [rootFolderId];
    while (stack.length) {
      const id = stack.pop()!;
      out.push(id);
      for (const child of byParent.get(id) ?? []) {
        stack.push(child);
      }
    }
    return out;
  }

  async getCourseIdsForFolderTree(folderId: number): Promise<number[]> {
    const folderIds = await this.getFolderTreeIds(folderId);
    if (!folderIds.length) return [];
    const links = await this.linkRepo.find({
      where: { folderId: In(folderIds) },
      select: ['moodleCourseId'],
    });
    return [...new Set(links.map((l) => l.moodleCourseId))];
  }

  private roleId(role: ProgramMoodleRole): number {
    return role === 'teacher'
      ? this.moodleService.getTeacherRoleId()
      : this.moodleService.getStudentRoleId();
  }

  async enrolUserInProgram(
    folderId: number,
    moodleUserId: number,
    role: ProgramMoodleRole,
  ): Promise<void> {
    const courseIds = await this.getCourseIdsForFolderTree(folderId);
    if (!courseIds.length) return;

    const roleId = this.roleId(role);
    await this.moodleService.enrolUsers(
      courseIds.map((courseId) => ({
        courseId,
        userId: moodleUserId,
        roleId,
      })),
    );
  }

  /**
   * Desmatricula solo si el usuario no sigue en otro turno del mismo árbol
   * (como alumno o como profesor, según role).
   */
  async unenrolUserFromProgramIfOrphan(
    folderId: number,
    moodleUserId: number,
    role: ProgramMoodleRole,
  ): Promise<void> {
    const treeIds = await this.getFolderTreeIds(folderId);
    if (!treeIds.length) return;

    const shiftsInTree = await this.shiftRepo.find({
      where: { folderId: In(treeIds) },
      select: ['id'],
    });
    const shiftIds = shiftsInTree.map((s) => s.id);
    if (!shiftIds.length) {
      await this.unenrolFromCourses(folderId, moodleUserId);
      return;
    }

    if (role === 'student') {
      const still = await this.enrollmentRepo.findOne({
        where: { moodleUserId, shiftId: In(shiftIds) },
      });
      if (still) return;
    } else {
      const still = await this.teacherRepo.findOne({
        where: { moodleUserId, shiftId: In(shiftIds) },
      });
      if (still) return;
    }

    await this.unenrolFromCourses(folderId, moodleUserId);
  }

  private async unenrolFromCourses(folderId: number, moodleUserId: number): Promise<void> {
    const courseIds = await this.getCourseIdsForFolderTree(folderId);
    if (!courseIds.length) return;
    await this.moodleService.unenrolUsers(
      courseIds.map((courseId) => ({ courseId, userId: moodleUserId })),
    );
  }

  /**
   * Al linkear un curso a una carpeta: matricular alumnos/profesores
   * de turnos cuyo árbol de carpeta incluye esa carpeta
   * (turno en la carpeta o en un ancestro).
   */
  async syncCourseToExistingMembers(folderId: number, moodleCourseId: number): Promise<void> {
    const ancestorIds = await this.collectAncestorIdsIncludingSelf(folderId);
    const shifts = await this.shiftRepo.find({
      where: { folderId: In(ancestorIds) },
      select: ['id'],
    });
    const shiftIds = shifts.map((s) => s.id);
    if (!shiftIds.length) return;

    const [students, teachers] = await Promise.all([
      this.enrollmentRepo.find({
        where: { shiftId: In(shiftIds) },
        select: ['moodleUserId'],
      }),
      this.teacherRepo.find({
        where: { shiftId: In(shiftIds) },
        select: ['moodleUserId'],
      }),
    ]);

    const studentIds = [...new Set(students.map((s) => s.moodleUserId))];
    const teacherIds = [...new Set(teachers.map((t) => t.moodleUserId))];

    const studentRole = this.moodleService.getStudentRoleId();
    const teacherRole = this.moodleService.getTeacherRoleId();

    const enrolments = [
      ...studentIds.map((userId) => ({
        courseId: moodleCourseId,
        userId,
        roleId: studentRole,
      })),
      ...teacherIds.map((userId) => ({
        courseId: moodleCourseId,
        userId,
        roleId: teacherRole,
      })),
    ];

    await this.moodleService.enrolUsers(enrolments);
  }

  /** folderId + parents up to root (for matching shifts on ancestor program nodes). */
  private async collectAncestorIdsIncludingSelf(folderId: number): Promise<number[]> {
    const out: number[] = [];
    let current = await this.folderRepo.findOne({ where: { id: folderId } });
    while (current) {
      out.push(current.id);
      if (current.parentId == null) break;
      current = await this.folderRepo.findOne({ where: { id: current.parentId } });
    }
    return out;
  }
}
