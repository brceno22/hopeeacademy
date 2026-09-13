import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramEnrollmentSyncService } from '../courses/program-enrollment-sync.service';
import { MoodleService } from '../moodle/moodle.service';
import { EnrollDto } from './dto/calendar.dto';
import { ShiftEnrollment } from './shift-enrollment.entity';
import { ShiftTeacher } from './shift-teacher.entity';
import { ShiftAdminService } from './shift-admin.service';

@Injectable()
export class ShiftRosterService {
  constructor(
    @InjectRepository(ShiftEnrollment)
    private readonly enrollmentRepo: Repository<ShiftEnrollment>,
    @InjectRepository(ShiftTeacher)
    private readonly teacherRepo: Repository<ShiftTeacher>,
    private readonly moodleService: MoodleService,
    private readonly programSync: ProgramEnrollmentSyncService,
    private readonly shiftAdmin: ShiftAdminService,
  ) {}

  private async enrichMembers<T extends { moodleUserId: number }>(
    rows: T[],
  ): Promise<
    Array<
      T & {
        fullName: string;
        email: string | null;
        username: string | null;
      }
    >
  > {
    const ids = rows.map((r) => r.moodleUserId);
    let nameMap = new Map<
      number,
      { fullName: string; email: string | null; username: string | null }
    >();
    try {
      const users = await this.moodleService.getUsersByIds(ids);
      nameMap = new Map(
        users.map((u) => [
          u.id,
          {
            fullName: u.fullname || `User ${u.id}`,
            email: u.email || null,
            username: u.username || null,
          },
        ]),
      );
    } catch {
      // optional
    }
    return rows.map((r) => {
      const info = nameMap.get(r.moodleUserId);
      return {
        ...r,
        fullName: info?.fullName || `User ${r.moodleUserId}`,
        email: info?.email ?? null,
        username: info?.username ?? null,
      };
    });
  }

  async listEnrollments(shiftId: number) {
    await this.shiftAdmin.getShiftOrFail(shiftId);
    const rows = await this.enrollmentRepo.find({
      where: { shiftId },
      order: { createdAt: 'DESC' },
    });
    const base = rows.map((e) => ({
      id: e.id,
      shiftId: e.shiftId,
      moodleUserId: e.moodleUserId,
      assignedByUserId: e.assignedByUserId,
      createdAt: e.createdAt,
    }));
    return this.enrichMembers(base);
  }

  async enroll(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    const shift = await this.shiftAdmin.getShiftOrFail(shiftId);
    const existing = await this.enrollmentRepo.findOne({
      where: { shiftId, moodleUserId: dto.moodleUserId },
    });
    if (existing) return existing;

    const saved = await this.enrollmentRepo.save(
      this.enrollmentRepo.create({
        shiftId,
        moodleUserId: dto.moodleUserId,
        assignedByUserId: assignedByUserId ?? null,
      }),
    );

    try {
      await this.programSync.enrolUserInProgram(shift.folderId, dto.moodleUserId, 'student');
    } catch (err) {
      await this.enrollmentRepo.remove(saved);
      throw err;
    }

    return saved;
  }

  async unenroll(shiftId: number, moodleUserId: number) {
    const shift = await this.shiftAdmin.getShiftOrFail(shiftId);
    const row = await this.enrollmentRepo.findOne({
      where: { shiftId, moodleUserId },
    });
    if (!row) throw new NotFoundException('Alumno no está en este turno');
    await this.enrollmentRepo.remove(row);
    await this.programSync.unenrolUserFromProgramIfOrphan(shift.folderId, moodleUserId, 'student');
    return { message: 'Alumno quitado del turno' };
  }

  async listTeachers(shiftId: number) {
    await this.shiftAdmin.getShiftOrFail(shiftId);
    const rows = await this.teacherRepo.find({
      where: { shiftId },
      order: { createdAt: 'DESC' },
    });
    const base = rows.map((t) => ({
      id: t.id,
      shiftId: t.shiftId,
      moodleUserId: t.moodleUserId,
      assignedByUserId: t.assignedByUserId,
      createdAt: t.createdAt,
    }));
    return this.enrichMembers(base);
  }

  async assignTeacher(shiftId: number, dto: EnrollDto, assignedByUserId?: number | null) {
    const shift = await this.shiftAdmin.getShiftOrFail(shiftId);
    const existing = await this.teacherRepo.findOne({
      where: { shiftId, moodleUserId: dto.moodleUserId },
    });
    if (existing) return existing;

    const saved = await this.teacherRepo.save(
      this.teacherRepo.create({
        shiftId,
        moodleUserId: dto.moodleUserId,
        assignedByUserId: assignedByUserId ?? null,
      }),
    );

    try {
      await this.programSync.enrolUserInProgram(shift.folderId, dto.moodleUserId, 'teacher');
    } catch (err) {
      await this.teacherRepo.remove(saved);
      throw err;
    }

    return saved;
  }

  async unassignTeacher(shiftId: number, moodleUserId: number) {
    const shift = await this.shiftAdmin.getShiftOrFail(shiftId);
    const row = await this.teacherRepo.findOne({
      where: { shiftId, moodleUserId },
    });
    if (!row) throw new NotFoundException('Profesor no está asignado a este turno');
    await this.teacherRepo.remove(row);
    await this.programSync.unenrolUserFromProgramIfOrphan(shift.folderId, moodleUserId, 'teacher');
    return { message: 'Profesor quitado del turno' };
  }
}
