import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { ClassRecording } from './class-recording.entity';
import { assertHttpUrl, toDriveEmbedUrl } from './drive-embed.util';
import { CreateRecordingDto, UpdateRecordingDto } from './dto/recording.dto';

@Injectable()
export class RecordingsService {
  constructor(
    @InjectRepository(ClassRecording)
    private readonly recordingRepo: Repository<ClassRecording>,
    @InjectRepository(CourseFolder)
    private readonly folderRepo: Repository<CourseFolder>,
  ) {}

  private serialize(rec: ClassRecording, folderName?: string | null) {
    return {
      id: rec.id,
      folderId: rec.folderId,
      folderName: folderName ?? rec.folder?.name ?? null,
      title: rec.title,
      driveUrl: rec.driveUrl,
      embedUrl: toDriveEmbedUrl(rec.driveUrl),
      recordedAt: rec.recordedAt,
      sortOrder: rec.sortOrder,
      isActive: rec.isActive,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    };
  }

  private normalizeDate(input: string | null | undefined, required = false): string | null {
    if (input === undefined) {
      if (required) throw new BadRequestException('recordedAt es requerido');
      return null;
    }
    if (input === null || input === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new BadRequestException('recordedAt debe ser YYYY-MM-DD');
    }
    return input;
  }

  async adminList(folderId?: number) {
    const where = folderId ? { folderId } : {};
    const rows = await this.recordingRepo.find({
      where,
      relations: ['folder'],
      order: { folderId: 'ASC', sortOrder: 'ASC', recordedAt: 'DESC', id: 'DESC' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async adminCreate(dto: CreateRecordingDto) {
    const folder = await this.folderRepo.findOne({ where: { id: dto.folderId } });
    if (!folder) throw new NotFoundException('Carpeta no encontrada');

    let driveUrl: string;
    try {
      driveUrl = assertHttpUrl(dto.driveUrl);
    } catch (e: unknown) {
      throw new BadRequestException(e instanceof Error ? e.message : 'URL inválida');
    }

    const recordedAt = dto.recordedAt !== undefined ? this.normalizeDate(dto.recordedAt) : null;

    const saved = await this.recordingRepo.save(
      this.recordingRepo.create({
        folderId: dto.folderId,
        title: dto.title.trim(),
        driveUrl,
        recordedAt,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      }),
    );
    saved.folder = folder;
    return this.serialize(saved, folder.name);
  }

  async adminUpdate(id: number, dto: UpdateRecordingDto) {
    const rec = await this.recordingRepo.findOne({
      where: { id },
      relations: ['folder'],
    });
    if (!rec) throw new NotFoundException('Grabación no encontrada');

    if (dto.folderId != null && dto.folderId !== rec.folderId) {
      const folder = await this.folderRepo.findOne({ where: { id: dto.folderId } });
      if (!folder) throw new NotFoundException('Carpeta no encontrada');
      rec.folderId = dto.folderId;
      rec.folder = folder;
    }

    if (dto.title != null) rec.title = dto.title.trim();
    if (dto.driveUrl != null) {
      try {
        rec.driveUrl = assertHttpUrl(dto.driveUrl);
      } catch (e: unknown) {
        throw new BadRequestException(e instanceof Error ? e.message : 'URL inválida');
      }
    }
    if (dto.recordedAt !== undefined) {
      rec.recordedAt = this.normalizeDate(dto.recordedAt);
    }
    if (dto.sortOrder != null) rec.sortOrder = dto.sortOrder;
    if (dto.isActive != null) rec.isActive = dto.isActive;

    const saved = await this.recordingRepo.save(rec);
    return this.serialize(saved);
  }

  async adminDelete(id: number) {
    const rec = await this.recordingRepo.findOne({ where: { id } });
    if (!rec) throw new NotFoundException('Grabación no encontrada');
    await this.recordingRepo.remove(rec);
    return { message: 'Grabación eliminada', id };
  }

  /** Lista agrupada por carpeta (solo activas + carpetas activas). */
  async listGroupedForStudents() {
    const rows = await this.recordingRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.folder', 'f')
      .where('r.isActive = :active', { active: true })
      .andWhere('f.isActive = :fActive', { fActive: true })
      .orderBy('f.sortOrder', 'ASC')
      .addOrderBy('f.name', 'ASC')
      .addOrderBy('r.sortOrder', 'ASC')
      .addOrderBy('r.recordedAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getMany();

    const byFolder = new Map<
      number,
      { folderId: number; folderName: string; parentId: number | null; recordings: ReturnType<RecordingsService['serialize']>[] }
    >();

    for (const r of rows) {
      if (!byFolder.has(r.folderId)) {
        byFolder.set(r.folderId, {
          folderId: r.folderId,
          folderName: r.folder?.name || `Clase ${r.folderId}`,
          parentId: r.folder?.parentId ?? null,
          recordings: [],
        });
      }
      byFolder.get(r.folderId)!.recordings.push(this.serialize(r));
    }

    return Array.from(byFolder.values());
  }

  async listByFolder(folderId: number) {
    const folder = await this.folderRepo.findOne({ where: { id: folderId, isActive: true } });
    if (!folder) throw new NotFoundException('Carpeta no encontrada');

    const rows = await this.recordingRepo.find({
      where: { folderId, isActive: true },
      relations: ['folder'],
      order: { sortOrder: 'ASC', recordedAt: 'DESC', id: 'DESC' },
    });

    return {
      folderId: folder.id,
      folderName: folder.name,
      recordings: rows.map((r) => this.serialize(r, folder.name)),
    };
  }

  async getOneForStudent(id: number) {
    const rec = await this.recordingRepo.findOne({
      where: { id, isActive: true },
      relations: ['folder'],
    });
    if (!rec || !rec.folder?.isActive) {
      throw new NotFoundException('Grabación no encontrada');
    }
    return this.serialize(rec);
  }
}
