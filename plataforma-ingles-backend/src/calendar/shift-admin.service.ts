import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { MoodleService } from '../moodle/moodle.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/calendar.dto';
import { ScheduleShift } from './schedule-shift.entity';
import { ShiftTeacher } from './shift-teacher.entity';

@Injectable()
export class ShiftAdminService {
  constructor(
    @InjectRepository(ScheduleShift)
    private readonly shiftRepo: Repository<ScheduleShift>,
    @InjectRepository(ShiftTeacher)
    private readonly teacherRepo: Repository<ShiftTeacher>,
    @InjectRepository(CourseFolder)
    private readonly folderRepo: Repository<CourseFolder>,
    private readonly moodleService: MoodleService,
  ) {}

  serializeShift(s: ScheduleShift) {
    return {
      id: s.id,
      name: s.name,
      folderId: s.folderId,
      folderName: s.folder?.name ?? null,
      moodleCourseId: s.moodleCourseId,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      title: s.title,
      description: s.description,
      meetUrl: s.meetUrl,
      validFrom: s.validFrom,
      validTo: s.validTo,
      isActive: s.isActive,
    };
  }

  async getShiftOrFail(id: number): Promise<ScheduleShift> {
    const shift = await this.shiftRepo.findOne({ where: { id }, relations: ['folder'] });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    return shift;
  }

  private async assertFolder(folderId: number) {
    const folder = await this.folderRepo.findOne({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Carpeta no encontrada');
    return folder;
  }

  normalizeDate(input?: string | null): string | null {
    if (input === undefined || input === null || input === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new BadRequestException('Fecha debe ser YYYY-MM-DD');
    }
    return input;
  }

  async adminListShifts() {
    const rows = await this.shiftRepo.find({
      relations: ['folder'],
      order: { name: 'ASC' },
    });
    return rows.map((s) => this.serializeShift(s));
  }

  async adminCreateShift(dto: CreateShiftDto) {
    await this.assertFolder(dto.folderId);
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }
    const saved = await this.shiftRepo.save(
      this.shiftRepo.create({
        name: dto.name.trim(),
        folderId: dto.folderId,
        moodleCourseId: dto.moodleCourseId ?? null,
        daysOfWeek: dto.daysOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        meetUrl: dto.meetUrl?.trim() || null,
        validFrom: this.normalizeDate(dto.validFrom ?? null),
        validTo: this.normalizeDate(dto.validTo ?? null),
        isActive: dto.isActive ?? true,
      }),
    );
    const withFolder = await this.shiftRepo.findOne({
      where: { id: saved.id },
      relations: ['folder'],
    });
    return this.serializeShift(withFolder!);
  }

  async adminUpdateShift(id: number, dto: UpdateShiftDto) {
    const shift = await this.shiftRepo.findOne({ where: { id }, relations: ['folder'] });
    if (!shift) throw new NotFoundException('Turno no encontrado');

    if (dto.folderId != null) {
      await this.assertFolder(dto.folderId);
      shift.folderId = dto.folderId;
    }
    if (dto.name != null) shift.name = dto.name.trim();
    if (dto.moodleCourseId !== undefined) shift.moodleCourseId = dto.moodleCourseId;
    if (dto.daysOfWeek) shift.daysOfWeek = dto.daysOfWeek;
    if (dto.startTime) shift.startTime = dto.startTime;
    if (dto.endTime) shift.endTime = dto.endTime;
    if (dto.title) shift.title = dto.title.trim();
    if (dto.description !== undefined) shift.description = dto.description;
    if (dto.meetUrl !== undefined) shift.meetUrl = dto.meetUrl;
    if (dto.validFrom !== undefined) shift.validFrom = this.normalizeDate(dto.validFrom);
    if (dto.validTo !== undefined) shift.validTo = this.normalizeDate(dto.validTo);
    if (dto.isActive != null) shift.isActive = dto.isActive;

    if (shift.startTime >= shift.endTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }

    await this.shiftRepo.save(shift);
    const refreshed = await this.shiftRepo.findOne({ where: { id }, relations: ['folder'] });
    return this.serializeShift(refreshed!);
  }

  async adminDeleteShift(id: number) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    await this.shiftRepo.remove(shift);
    return { message: 'Turno eliminado', id };
  }

  async teacherCanManageShift(
    _token: string,
    userId: number,
    shift: ScheduleShift,
  ): Promise<boolean> {
    const row = await this.teacherRepo.findOne({
      where: { shiftId: shift.id, moodleUserId: userId },
    });
    return Boolean(row);
  }

  async listTeacherShifts(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const assignments = await this.teacherRepo.find({
      where: { moodleUserId: userId },
      relations: ['shift', 'shift.folder'],
    });

    return assignments
      .map((a) => a.shift)
      .filter((s): s is ScheduleShift => Boolean(s?.isActive))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => this.serializeShift(s));
  }

  async assertTeacherShift(token: string, shiftId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const shift = await this.getShiftOrFail(shiftId);
    if (!(await this.teacherCanManageShift(token, userId, shift))) {
      throw new ForbiddenException('No podés gestionar este turno');
    }
    return { userId, shift };
  }
}
